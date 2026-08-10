-- 1) พนักงานต้องเปลี่ยนบริษัท/หน้าที่ของตัวเองไม่ได้
--    ทั้งสองอันเป็นตัวตัดสินว่าเห็นเมนูอะไร ตารางงานเป็นแบบไหน จ่ายเงินรอบไหน
--    ถ้าไม่กัน พนักงานยิงจากเบราว์เซอร์แล้วย้ายบริษัทตัวเองได้

create or replace function public.trg_guard_user_self_edit()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if public.is_hr() then return new; end if;

  -- ไม่มีผู้ใช้ = โค้ดฝั่งเซิร์ฟเวอร์ที่ถือ service key (ของเราเอง) ปล่อยผ่าน
  if (select auth.uid()) is null then return new; end if;

  -- คนทั่วไปแก้ตัวเองได้แค่ ชื่อจริง · ชื่อเล่น · ข้อมูลติดต่อ · รูป
  new.role                := old.role;
  new.company_id          := old.company_id;
  new.job_function_id     := old.job_function_id;
  new.employment_status   := old.employment_status;
  new.employment_type     := old.employment_type;
  new.business_unit_id    := old.business_unit_id;
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

-- 2) ทะเบียนพนักงาน — เปลี่ยนมาอ่านบริษัทกับหน้าที่จากคอลัมน์ใหม่
--    (drop ก่อนเพราะ create or replace เพิ่มคอลัมน์กลางตารางไม่ได้)
drop view if exists public.employee_directory;

create view public.employee_directory
with (security_invoker = true)
as
select u.id,
       u.display_name as full_name,
       u.nickname,
       u.role,
       rs.label_th as role_th,
       c.code as company_code,
       c.name_th as company_name,
       jf.name_th as job_function,
       l.name as location_name,
       u.employment_type,
       u.employment_status,
       u.start_date,
       u.start_date_verified,
       u.end_date,
       u.end_reason,
       case when u.start_date_verified then public.months_of_service(u.start_date) end as months_of_service,
       case when u.start_date_verified
            then round(public.months_of_service(u.start_date)::numeric / 12.0, 1) end as years_of_service,
       case when u.start_date_verified
            then public.months_of_service(u.start_date) >= 12 end as vacation_eligible,
       u.wfh_eligible,
       coalesce(u.days_per_week, jf.default_days_per_week) as days_per_week,
       coalesce(u.requires_checkin, rs.requires_checkin, true) as requires_checkin,
       u.is_active
from public.users u
left join public.role_settings  rs on rs.role = u.role
left join public.job_functions  jf on jf.id  = u.job_function_id
left join public.companies      c  on c.id   = u.company_id
left join public.locations      l  on l.id   = u.primary_location_id
where u.deleted_at is null;;
