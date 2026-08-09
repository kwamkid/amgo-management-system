-- ═══════════════════════════════════════════════════════════════════════
-- แยกประเภทสถานที่ (ตัดสินใจ 2026-08-07)
--   office = สำนักงาน/คลัง · mall = เคาน์เตอร์ในห้าง (PC)
--   event  = ออกบูธชั่วคราว · home = บ้านพนักงาน (กำลังเลิกใช้)
-- ═══════════════════════════════════════════════════════════════════════

alter table locations add column location_type text not null default 'office'
  check (location_type in ('office','mall','event','home'));

alter table locations add column owner_user_id uuid references users(id) on delete cascade;

alter table locations add constraint home_has_owner
  check (location_type <> 'home' or owner_user_id is not null);

create index on locations (location_type) where is_active;

comment on column locations.location_type is
  'office=สำนักงาน/คลัง · mall=เคาน์เตอร์ห้าง(PC) · event=ออกบูธ · home=บ้านพนักงาน';
comment on column locations.owner_user_id is
  'บังคับเมื่อ type=home — ใช้จำกัดสิทธิ์ให้เห็นแค่เจ้าของ+HR ตอนเขียน RLS';

-- พิกัดบ้านเก็บที่ตัวพนักงาน แทนการสร้าง location ต่อบ้าน 1 หลัง
-- ป้องกันตารางสาขาบานเป็นบ้าน 58 หลัง + พิกัดบ้านเป็นข้อมูลส่วนตัว
alter table users add column home_lat double precision;
alter table users add column home_lng double precision;
alter table users add column home_radius integer not null default 100;

alter table users add constraint home_coords_together
  check ((home_lat is null) = (home_lng is null));

comment on column users.home_lat is
  'พิกัดบ้านสำหรับ WFH — เก็บที่ตัวคนไม่ใช่ตาราง locations (ส่วนตัว + คนย้ายบ้านแก้ที่เดียว)';

-- ตารางงานสาขาใช้กับ home ไม่ได้ (ตารางของบ้าน = ตารางของคนคนนั้น)
create or replace function trg_no_schedule_for_home()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (select 1 from public.locations l
             where l.id = new.location_id and l.location_type = 'home') then
    raise exception 'ตั้งตารางงานให้ location ประเภท home ไม่ได้ — ใช้ user_work_schedules แทน';
  end if;
  return new;
end;
$$;

create trigger location_work_schedules_no_home
  before insert or update on location_work_schedules
  for each row execute function trg_no_schedule_for_home();
