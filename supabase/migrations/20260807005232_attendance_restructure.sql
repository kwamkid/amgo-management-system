-- ═══════════════════════════════════════════════════════════════════════
-- restructure ระบบลา + checkin ให้สรุปยอดได้
--
-- ปัญหาเดิม: "ขาดงาน" ไม่มีตัวตนในระบบ — มันคือการ "ไม่มี" ทั้ง checkin
-- และใบลา ซึ่ง query หาไม่ได้ ต้องรู้ก่อนว่า "วันไหนคนนี้ควรทำงาน"
--
-- ตัดสินใจ 2026-08-07:
--   · วันที่มีทั้งใบลาอนุมัติและ checkin → มาทำงานชนะ แล้วคืนโควต้าให้
--     (ข้อมูลจริง 45 จาก 81 วันลา = 56% เป็นแบบนี้)
--   · ตารางงาน WFH/onsite ตั้งระดับสาขา (15 สาขา ไม่ต้องตั้งทีละคน 58 คน)
-- ═══════════════════════════════════════════════════════════════════════

-- ── สาขาหลักของพนักงาน (ของเดิมมีแต่ allowedLocationIds[] แบบหลายแห่ง) ──
alter table users add column primary_location_id uuid references locations(id) on delete set null;
create index on users (primary_location_id) where deleted_at is null;

comment on column users.primary_location_id is
  'สาขาที่สังกัดจริง — ใช้หาว่าตารางงานของสาขาไหนมีผลกับคนนี้';

-- ── ตารางงานประจำสัปดาห์ ระดับสาขา ─────────────────────────────────────
create table location_work_schedules (
  location_id  uuid not null references locations(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),  -- 0 = อาทิตย์
  work_mode    text not null check (work_mode in ('onsite','wfh','off')),
  primary key (location_id, day_of_week)
);

comment on table location_work_schedules is
  'วันไหนเข้าออฟฟิศ / WFH / หยุด — ตั้งระดับสาขา';

-- ── override ระดับคน ───────────────────────────────────────────────────
create table user_work_schedules (
  user_id      uuid not null references users(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  work_mode    text not null check (work_mode in ('onsite','wfh','off')),
  note         text not null default '',
  primary key (user_id, day_of_week)
);

comment on table user_work_schedules is 'ชนะตารางของสาขา — ใส่เฉพาะคนที่ต่างจากสาขา';

-- ── ข้อยกเว้นรายวัน (WFH เป็นครั้งคราว / เรียกเข้าวันหยุด) ──────────────
create table schedule_exceptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  exception_date date not null,
  work_mode   text not null check (work_mode in ('onsite','wfh','off')),
  note        text not null default '',
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  unique (user_id, exception_date)
);

create index on schedule_exceptions (exception_date);

comment on table schedule_exceptions is 'ชนะทุกตาราง — WFH เป็นครั้งคราวหรือเรียกเข้าทำงานวันหยุด';

-- ── แตกใบลาเป็นรายวัน ──────────────────────────────────────────────────
-- จำเป็นเพราะกติกา "มาทำงานชนะ คืนโควต้าให้" ต้องยกเลิกได้ทีละวัน
-- ใบลา 3 วันแล้วมาทำงานวันกลาง = ปิดแค่วันนั้น อีก 2 วันยังนับ
create table leave_days (
  id            uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null references leave_requests(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  leave_date    date not null,
  counts_toward_quota boolean not null default true,
  refunded_at   timestamptz,
  refund_reason text,
  unique (leave_request_id, leave_date)
);

create index on leave_days (user_id, leave_date);
create index on leave_days (leave_date);
create unique index leave_days_one_active_per_day
  on leave_days (user_id, leave_date) where counts_toward_quota;

comment on table leave_days is
  'แตกจาก leave_requests ช่วงวันที่ — ทำให้คืนโควต้าเฉพาะวันที่มาทำงานจริงได้';
comment on column leave_days.counts_toward_quota is
  'false = วันนั้นมาทำงานจริง คืนโควต้าแล้ว (กติกา: มาทำงานชนะใบลา)';

alter table location_work_schedules enable row level security;
alter table user_work_schedules     enable row level security;
alter table schedule_exceptions     enable row level security;
alter table leave_days              enable row level security;
