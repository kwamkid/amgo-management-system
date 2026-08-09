-- ═══════════════════════════════════════════════════════════════════════
-- companies + business_units (ตัดสินใจ 2026-08-07)
--
-- ที่ผ่านมาผูกตารางงานกับ "สถานที่" ซึ่งผิด — วังเด็ก 1 สถานที่ มี 3 หน่วยงาน
-- ของ 2 บริษัท ตารางคนละแบบ:
--   ABC วังเด็ก (AGD, shop)  เปิดทุกวัน สลับเวรคนละ 5 วัน
--   ออฟฟิศ AGD              เข้า อังคาร/พฤหัส/ศุกร์
--   ออฟฟิศ ADF              เปิดทุกวัน สลับเวรคนละ 6 วัน
-- → ตารางงานเป็นของ "หน่วยงาน" ไม่ใช่ของ "สถานที่"
-- ═══════════════════════════════════════════════════════════════════════

drop trigger if exists location_work_schedules_no_home on location_work_schedules;
drop function if exists trg_no_schedule_for_home();
drop table if exists location_work_schedules;

alter table users drop column if exists department_id;
drop table if exists departments;

create table companies (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name_th    text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into companies (code, name_th) values
  ('AGD', 'เอจี ดราก้อน จำกัด'),
  ('ADF', 'อะเดย์ เฟรช จำกัด');

create table business_units (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete restrict,
  location_id uuid references locations(id) on delete set null,
  name        text not null,
  unit_type   text not null default 'office'
              check (unit_type in ('office','shop','warehouse')),
  -- fixed    = ทำงานวันตายตัว (ระบุใน business_unit_work_days)
  -- rotating = เปิดทุกวันแต่สลับเวร (จำนวนวัน/สัปดาห์ที่ users.days_per_week)
  schedule_type text not null default 'fixed'
                check (schedule_type in ('fixed','rotating')),
  default_days_per_week smallint check (default_days_per_week between 1 and 7),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, name),
  constraint rotating_needs_days
    check (schedule_type <> 'rotating' or default_days_per_week is not null)
);

create index on business_units (company_id);
create index on business_units (location_id);

create trigger business_units_updated_at before update on business_units
  for each row execute function set_updated_at();

comment on table business_units is
  '1 สถานที่มีได้หลายหน่วยงานคนละบริษัท เช่น วังเด็ก = ABC shop(AGD) + office AGD + office ADF';

create table business_unit_work_days (
  business_unit_id uuid not null references business_units(id) on delete cascade,
  day_of_week      smallint not null check (day_of_week between 0 and 6),  -- 0 = อาทิตย์
  work_mode        text not null check (work_mode in ('onsite','wfh','off')),
  primary key (business_unit_id, day_of_week)
);

alter table companies               enable row level security;
alter table business_units          enable row level security;
alter table business_unit_work_days enable row level security;
