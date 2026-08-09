-- ═══════════════════════════════════════════════════════════════════════
-- ข้อมูลการจ้างงานรายบุคคล (ตัดสินใจ 2026-08-07)
--   · รายเดือน/รายวัน ตั้งตอนเพิ่มพนักงาน — รายวันคือกลุ่มที่ต้องนับวันให้แม่น
--   · start_date = วันเริ่มงานจริง (ไม่ใช่ registered_at วันสมัครเข้าระบบ)
--   · WFH พนักงานใหม่ยังไม่ได้ → default false เปิดให้ทีละคน
-- ═══════════════════════════════════════════════════════════════════════

alter table users
  add column business_unit_id uuid references business_units(id) on delete set null,
  add column employment_type text not null default 'monthly'
      check (employment_type in ('monthly','daily')),
  add column start_date date,
  add column days_per_week smallint check (days_per_week between 1 and 7),
  add column wfh_eligible boolean not null default false;

create index on users (business_unit_id) where deleted_at is null;
create index on users (employment_type)  where deleted_at is null;

comment on column users.start_date is
  'วันเริ่มงานจริง — ไม่ใช่ registered_at ใช้คำนวณอายุงาน + สิทธิ์ลาพักร้อน ม.30';
comment on column users.wfh_eligible is
  'พนักงานใหม่ default false — HR เปิดให้เมื่อผ่านช่วงทดลองงาน';
comment on column users.days_per_week is
  'เฉพาะหน่วยงาน rotating — null = ใช้ default_days_per_week ของหน่วยงาน';

-- generated column ใช้ไม่ได้เพราะต้องอ้าง now() ซึ่งไม่ immutable
create or replace function months_of_service(p_start date)
returns integer
language sql stable security invoker set search_path = ''
as $$
  select case when p_start is null then null
    else (extract(year from age(current_date, p_start)) * 12
        + extract(month from age(current_date, p_start)))::integer
  end;
$$;

comment on function months_of_service is 'อายุงานเป็นเดือน — null ถ้ายังไม่ได้ระบุวันเริ่มงาน';

create or replace view employee_directory as
select
  u.id, u.full_name, u.role,
  rs.label_th   as role_th,
  c.code        as company_code,
  c.name_th     as company_name,
  bu.name       as business_unit,
  l.name        as location_name,
  u.employment_type,
  u.start_date,
  months_of_service(u.start_date)                  as months_of_service,
  round(months_of_service(u.start_date) / 12.0, 1) as years_of_service,
  -- สิทธิ์ลาพักร้อนตาม ม.30 ต้องทำงานครบ 1 ปี
  (months_of_service(u.start_date) >= 12)          as vacation_eligible,
  u.wfh_eligible,
  coalesce(u.days_per_week, bu.default_days_per_week)    as days_per_week,
  coalesce(u.requires_checkin, rs.requires_checkin, true) as requires_checkin,
  u.is_active
from users u
left join role_settings  rs on rs.role = u.role
left join business_units bu on bu.id = u.business_unit_id
left join companies      c  on c.id  = bu.company_id
left join locations      l  on l.id  = u.primary_location_id
where u.deleted_at is null;

comment on view employee_directory is
  'รายชื่อพนักงานพร้อมบริษัท/หน่วยงาน/อายุงาน/สิทธิ์ — ใช้แทนการ JOIN เองทุกที่';
