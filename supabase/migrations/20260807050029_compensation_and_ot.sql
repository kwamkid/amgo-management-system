-- ═══════════════════════════════════════════════════════════════════════
-- เงินเดือน + คำนวณ OT (ตัดสินใจ 2026-08-07)
--
-- กฎหมายที่อ้าง (พ.ร.บ. คุ้มครองแรงงาน):
--   ม.61  OT วันทำงานปกติ  ≥ 1.5 เท่า
--   ม.62  ทำงานวันหยุด (รายเดือน) +1 เท่า / (ไม่ได้ค่าจ้างวันหยุด) 2 เท่า
--   ม.63  OT ในวันหยุด     ≥ 3 เท่า
--   ม.68  ค่าจ้างต่อ ชม. รายเดือน = เงินเดือน ÷ 30 ÷ ชม.ทำงานปกติต่อวัน
--
-- ⚠️ โค้ดเดิมตั้งอัตรา OT ตาม "ตำแหน่ง" (office 1.5 / retail 2.0 / driver 1.5)
--    ทำให้คนทำ OT ในวันหยุดได้แค่ 1.5 เท่า ทั้งที่ ม.63 กำหนด 3 เท่า
--    → ย้ายมาคิดตาม "สถานการณ์" ตามกฎหมาย
-- ═══════════════════════════════════════════════════════════════════════

-- เดิม hardcode เลข 8 ไว้ 10 จุดในโค้ด
alter table business_units
  add column standard_hours_per_day numeric(3,1) not null default 8
    check (standard_hours_per_day between 1 and 12);

comment on column business_units.standard_hours_per_day is
  'เกินจากนี้นับเป็น OT — เดิม hardcode 8 ใน workingHoursService/autoCheckoutService/excelExportService';

-- 🔒 ข้อมูลอ่อนไหวที่สุดในระบบ — Phase 6 ต้อง RLS ให้เห็นเฉพาะเจ้าตัว + HR + admin
-- effective_from จำเป็น: ขึ้นเงินเดือน เม.ย. แล้วคิดเงินเดือน มี.ค. ย้อนหลัง
-- ต้องใช้เรตของ มี.ค. ไม่ใช่เรตปัจจุบัน
create table user_compensation (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete restrict,
  effective_from date not null,
  base_salary    numeric(12,2) not null check (base_salary >= 0),
  pay_type       text not null default 'monthly' check (pay_type in ('monthly','daily')),
  note           text not null default '',
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  unique (user_id, effective_from)
);

create index on user_compensation (user_id, effective_from desc);

comment on table user_compensation is
  '🔒 เงินเดือน — RLS ต้องล็อกให้เห็นเฉพาะเจ้าตัว + HR + admin (Phase 6)';

create table ot_rate_settings (
  company_id  uuid not null references companies(id) on delete cascade,
  situation   text not null check (situation in ('normal_ot','holiday_work','holiday_ot')),
  multiplier  numeric(3,1) not null check (multiplier > 0),
  legal_min   numeric(3,1) not null,
  label_th    text not null,
  updated_by  uuid references users(id),
  updated_at  timestamptz not null default now(),
  primary key (company_id, situation),
  constraint not_below_legal check (multiplier >= legal_min)
);

create trigger ot_rate_settings_updated_at before update on ot_rate_settings
  for each row execute function set_updated_at();

comment on table ot_rate_settings is 'ตั้งสูงกว่ากฎหมายได้ ต่ำกว่าไม่ได้ (not_below_legal บังคับ)';

insert into ot_rate_settings (company_id, situation, multiplier, legal_min, label_th)
select c.id, s.situation, s.mult, s.mult, s.label
from companies c
cross join (values
  ('normal_ot',    1.5, 'OT วันทำงานปกติ (ม.61)'),
  ('holiday_work', 1.0, 'ทำงานวันหยุด — รายเดือนได้ค่าจ้างวันหยุดอยู่แล้ว จึงบวกอีก 1 เท่า (ม.62)'),
  ('holiday_ot',   3.0, 'OT ในวันหยุด (ม.63)')
) as s(situation, mult, label);

alter table user_compensation enable row level security;
alter table ot_rate_settings  enable row level security;

create or replace function hourly_rate(p_user_id uuid, p_date date)
returns numeric
language sql stable security invoker set search_path = ''
as $$
  select case
    when comp.pay_type = 'daily' then comp.base_salary / bu.std_hours
    else comp.base_salary / 30 / bu.std_hours   -- ม.68 หาร 30 เสมอ
  end
  from (
    select c.base_salary, c.pay_type
    from public.user_compensation c
    where c.user_id = p_user_id and c.effective_from <= p_date
    order by c.effective_from desc limit 1
  ) comp
  cross join (
    select coalesce(b.standard_hours_per_day, 8) as std_hours
    from public.users u
    left join public.business_units b on b.id = u.business_unit_id
    where u.id = p_user_id
  ) bu;
$$;

comment on function hourly_rate is 'ม.68 — ใช้เรตเงินเดือน ณ วันนั้น (effective_from) ไม่ใช่เรตล่าสุด';
