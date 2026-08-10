-- ลบ business_units ทิ้ง — แทนที่ด้วย บริษัท + หน้าที่ เรียบร้อยแล้ว
--
-- ที่ยังเหลือค้างคือ hourly_rate ซึ่งอ่าน standard_hours_per_day จากหน่วยงาน
-- ตัวนี้ใช้คิดค่าล่วงเวลา ถ้าลบตารางทิ้งเฉย ๆ จะได้ 8 ชม. เหมาทุกคนเงียบ ๆ

create or replace function public.hourly_rate(p_user_id uuid, p_date date)
 returns numeric
 language sql
 stable
 set search_path to ''
as $function$
  select case
    when comp.pay_type = 'daily' then comp.base_salary / jf.std_hours
    -- ม.68: รายเดือนหาร 30 เสมอ ไม่ใช่จำนวนวันทำงานจริง
    else comp.base_salary / 30 / jf.std_hours
  end
  from (
    select c.base_salary, c.pay_type
    from public.user_compensation c
    where c.user_id = p_user_id and c.effective_from <= p_date
    order by c.effective_from desc
    limit 1
  ) comp
  cross join (
    select coalesce(f.standard_hours_per_day, 8) as std_hours
    from public.users u
    left join public.job_functions f on f.id = u.job_function_id
    where u.id = p_user_id
  ) jf;
$function$;

-- ตัวกันพนักงานแก้ข้อมูลตัวเอง — เอาคอลัมน์ที่กำลังจะหายออกจากรายการ
create or replace function public.trg_guard_user_self_edit()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if public.is_hr() then return new; end if;
  if (select auth.uid()) is null then return new; end if;

  -- คนทั่วไปแก้ตัวเองได้แค่ ชื่อจริง · ชื่อเล่น · ข้อมูลติดต่อ · รูป
  new.role                := old.role;
  new.company_id          := old.company_id;
  new.job_function_id     := old.job_function_id;
  new.employment_status   := old.employment_status;
  new.employment_type     := old.employment_type;
  new.start_date          := old.start_date;
  new.start_date_verified := old.start_date_verified;
  new.end_date            := old.end_date;
  new.days_per_week       := old.days_per_week;
  new.payroll_cycle       := old.payroll_cycle;
  new.requires_checkin    := old.requires_checkin;
  new.wfh_eligible        := old.wfh_eligible;
  new.is_active           := old.is_active;
  new.needs_approval      := old.needs_approval;
  new.allow_checkin_outside_location := old.allow_checkin_outside_location;
  new.deleted_at          := old.deleted_at;

  new.is_system           := old.is_system;
  new.line_user_id        := old.line_user_id;
  new.home_lat            := old.home_lat;
  new.home_lng            := old.home_lng;
  new.home_radius         := old.home_radius;
  new.primary_location_id := old.primary_location_id;
  new.invite_link_id      := old.invite_link_id;
  new.invite_link_code    := old.invite_link_code;
  new.approved_at         := old.approved_at;
  new.approved_by         := old.approved_by;
  new.deleted_by          := old.deleted_by;
  new.deleted_by_name     := old.deleted_by_name;
  return new;
end;
$function$;

alter table public.users drop column if exists business_unit_id;

drop table if exists public.business_unit_work_days;
drop table if exists public.business_units;;
