-- ═══════════════════════════════════════════════════════════════════════
-- 0003 — ระบบลา: leave_requests, leave_quotas, holidays
--
-- ของเดิม quotas/{uid}/years/{year} เก็บเป็น object 3 ก้อน
--   { sick: {total,used,remaining}, personal: {...}, vacation: {...} }
-- → แบนเป็น long format (user_id, year, leave_type) query/รายงานได้จริง
--
-- ข้อมูลจริง: leaves 298 · quota years 111 · holidays/carryOverLogs ยังว่าง
-- ═══════════════════════════════════════════════════════════════════════

-- ── leave_requests ─────────────────────────────────────────────────────
create table leave_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete restrict,

  leave_type  text not null check (leave_type in ('sick','personal','vacation')),
  status      text not null default 'pending'
              check (status in ('pending','approved','rejected','cancelled')),

  start_date  timestamptz not null,
  end_date    timestamptz not null,
  total_days  numeric(4,1) not null,

  -- ลาด่วนคิดโควตาเป็น n เท่า (ของเดิม urgentMultiplier)
  urgent_multiplier numeric(3,1) not null default 1,

  reason      text not null default '',

  approved_by     uuid references users(id),
  approved_at     timestamptz,
  rejected_reason text,
  cancelled_by    uuid references users(id),
  cancelled_at    timestamptz,
  cancel_reason   text,

  -- snapshot (เอกสารทางการ เหมือน checkins)
  user_name   text not null default '',
  user_avatar text not null default '',
  user_email  text not null default '',

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint end_after_start check (end_date >= start_date),
  constraint days_positive   check (total_days > 0),

  -- อนุมัติ/ปฏิเสธแล้วต้องรู้ว่าใครทำ
  constraint approved_has_approver
    check (status <> 'approved' or approved_by is not null)
);

create index on leave_requests (user_id, start_date desc);
create index on leave_requests (status) where status = 'pending';
create index on leave_requests (start_date, end_date);

create trigger leave_requests_updated_at before update on leave_requests
  for each row execute function set_updated_at();

-- ── leave_quotas — long format แทน subcollection ซ้อน ──────────────────
create table leave_quotas (
  user_id     uuid not null references users(id) on delete cascade,
  year        smallint not null,
  leave_type  text not null check (leave_type in ('sick','personal','vacation')),

  total_days  numeric(4,1) not null default 0,
  used_days   numeric(4,1) not null default 0,
  -- remaining เป็น generated → ไม่มีทางเพี้ยนจาก total - used อีก
  -- (ของเดิมเก็บ remaining แยกแล้วให้ leaveService.ts 849 บรรทัดคอยคุมเอง)
  remaining_days numeric(4,1) generated always as (total_days - used_days) stored,

  updated_by  uuid references users(id),
  updated_at  timestamptz not null default now(),

  primary key (user_id, year, leave_type),

  constraint used_not_exceed_total check (used_days <= total_days),
  constraint quota_not_negative    check (total_days >= 0 and used_days >= 0)
);

create index on leave_quotas (year, leave_type);

comment on table leave_quotas is
  'แทน quotas/{uid}/years/{year} ที่เก็บเป็น object 3 ก้อน — long format query ได้';

-- ── leave_quota_history — จาก quotas...history[] ───────────────────────
create table leave_quota_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  year        smallint not null,
  changes     jsonb not null,          -- {sick:{...}, personal:{...}} ตามของเดิม
  reason      text not null default '',
  changed_by  uuid references users(id),
  changed_at  timestamptz not null
);

create index on leave_quota_history (user_id, year, changed_at desc);

-- ── carry_over_logs (ยกโควตาข้ามปี — ยังไม่มีข้อมูล) ────────────────────
create table carry_over_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  from_year     smallint not null,
  to_year       smallint not null,
  leave_type    text not null check (leave_type in ('sick','personal','vacation')),
  days_carried  numeric(4,1) not null,
  note          text not null default '',
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),

  constraint to_year_after_from check (to_year > from_year)
);

create index on carry_over_logs (user_id, to_year);

-- ── holidays (ยังไม่มีข้อมูล แต่โค้ด/rules อ้างถึง) ─────────────────────
create table holidays (
  id          uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger holidays_updated_at before update on holidays
  for each row execute function set_updated_at();

-- ── leave_types (ตั้งค่าประเภทการลา — ยังไม่มีข้อมูล) ───────────────────
create table leave_types (
  code            text primary key check (code in ('sick','personal','vacation')),
  name_th         text not null,
  default_days    numeric(4,1) not null default 0,
  requires_attachment boolean not null default false,
  is_active       boolean not null default true,
  updated_at      timestamptz not null default now()
);

-- default_days = 0 ตั้งใจ — ยังไม่รู้กติกาจริงของบริษัท ห้ามเดา
-- ⚠️ ต้องถาม HR แล้วค่อย update ก่อนเปิดใช้ (ของเดิม collection leaveTypes ว่างเปล่า
--    แปลว่าโควตาถูกตั้งรายคนใน quotas/{uid}/years/{year} ไม่ได้มีค่า default กลาง)
insert into leave_types (code, name_th, default_days) values
  ('sick',     'ลาป่วย',    0),
  ('personal', 'ลากิจ',     0),
  ('vacation', 'ลาพักร้อน', 0)
on conflict (code) do nothing;

alter table leave_requests      enable row level security;
alter table leave_quotas        enable row level security;
alter table leave_quota_history enable row level security;
alter table carry_over_logs     enable row level security;
alter table holidays            enable row level security;
alter table leave_types         enable row level security;
