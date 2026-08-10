-- ให้รายงานอ่านตารางงานจาก "หน้าที่" แทน "หน่วยงานรายสาขา"
--
-- ลำดับการตัดสินใจยังเหมือนเดิมทุกอย่าง เปลี่ยนแค่ชั้นที่ 3-4
-- จาก business_units → job_functions:
--   1. ข้อยกเว้นรายวัน   ชนะทุกอย่าง
--   2. ตารางรายคน        (เช่น ปูทำ Call Center แต่เข้าออฟฟิศวันศุกร์)
--   3. ตารางของหน้าที่   เฉพาะแบบ fixed
--   4. หน้าที่แบบสลับเวร → ไม่รู้ว่าวันนี้เวรใคร
--   5. ค่าเริ่มต้น จ–ศ

create or replace function public.expected_work_mode(p_user_id uuid, p_date date)
 returns text
 language sql
 stable
 set search_path to ''
as $function$
  select coalesce(
    (select e.work_mode from public.schedule_exceptions e
      where e.user_id = p_user_id and e.exception_date = p_date),
    (select uw.work_mode from public.user_work_schedules uw
      where uw.user_id = p_user_id and uw.day_of_week = extract(dow from p_date)),
    (select fd.work_mode
       from public.job_function_work_days fd
       join public.job_functions jf on jf.id = fd.job_function_id
       join public.users u on u.job_function_id = jf.id
      where u.id = p_user_id
        and jf.schedule_type = 'fixed'
        and fd.day_of_week = extract(dow from p_date)),
    (select 'rotating' from public.users u
       join public.job_functions jf on jf.id = u.job_function_id
      where u.id = p_user_id and jf.schedule_type = 'rotating'),
    case when extract(dow from p_date) between 1 and 5 then 'onsite' else 'off' end
  );
$function$;

-- ── รายงานรายวัน ──────────────────────────────────────────────────────
-- คอลัมน์ business_unit คงชื่อเดิมไว้ (หน้าจอรายงานอ้างอยู่) แต่ข้างในคือ
-- ชื่อหน้าที่แล้ว  ส่วน company_code มาจาก users.company_id ตรง ๆ
-- ไม่ต้องอ้อมผ่านหน่วยงานอีก

create or replace function public.attendance_summary(p_from date, p_to date, p_user_id uuid default null::uuid)
 returns table(user_id uuid, full_name text, company_code text, business_unit text, work_date date, expected_mode text, status text, checkin_type text, leave_type text, total_hours numeric, is_late boolean)
 language sql
 stable
 set search_path to ''
as $function$
  with days as (select generate_series(p_from, p_to, interval '1 day')::date as d),
  people as (
    select u.id, u.display_name as full_name, c.code as company_code, jf.name_th as unit,
           coalesce(u.requires_checkin, rs.requires_checkin, true) as needs_checkin,
           -- ตัดต้นทางเฉพาะวันเริ่มงานที่ยืนยันแล้ว — ถ้ายังไม่ยืนยันมันคือวันสมัคร
           -- ซึ่งอาจหลังวันเริ่มงานจริง เอามาตัดจะทำให้ข้อมูลเช็คอินจริงหายไป
           case when u.start_date_verified then u.start_date end as from_day,
           u.end_date as to_day
    from public.users u
    left join public.role_settings  rs on rs.role = u.role
    left join public.job_functions  jf on jf.id  = u.job_function_id
    left join public.companies      c  on c.id   = u.company_id
    where u.deleted_at is null
      and (p_user_id is null or u.id = p_user_id)
  ),
  grid as (
    select p.*, d.d,
           public.expected_work_mode(p.id, d.d) as expected,
           exists (select 1 from public.holidays h
                    where h.holiday_date = d.d and h.is_active) as is_holiday
    from people p cross join days d
    where (p.from_day is null or d.d >= p.from_day)
      and (p.to_day   is null or d.d <= p.to_day)
  ),
  ci as (
    select c.user_id, c.work_date, sum(c.total_hours) as hours,
           bool_or(c.is_late) as late, min(c.checkin_type) as ctype
    from public.checkins c
    where c.work_date between p_from and p_to
    group by c.user_id, c.work_date
  ),
  lv as (
    select ld.user_id, ld.leave_date, min(lr.leave_type) as ltype
    from public.leave_days ld
    join public.leave_requests lr on lr.id = ld.leave_request_id
    where ld.leave_date between p_from and p_to
      and ld.counts_toward_quota and lr.status = 'approved'
    group by ld.user_id, ld.leave_date
  )
  select g.id, g.full_name, g.company_code, g.unit, g.d, g.expected,
    case
      when g.is_holiday           then 'holiday'
      when g.expected = 'off'     then 'day_off'
      when ci.user_id is not null then
        case when g.expected = 'wfh' then 'worked_wfh' else 'worked' end
      when lv.user_id is not null then 'leave'
      when not g.needs_checkin    then 'not_tracked'
      when g.expected = 'rotating' then 'not_scheduled'
      else 'absent'
    end,
    ci.ctype, lv.ltype, ci.hours, coalesce(ci.late, false)
  from grid g
  left join ci on ci.user_id = g.id and ci.work_date  = g.d
  left join lv on lv.user_id = g.id and lv.leave_date = g.d
  order by g.full_name, g.d;
$function$;

-- ── สรุปรายคน ─────────────────────────────────────────────────────────
-- "ควรมากี่วัน" เอาจาก users.days_per_week ก่อน ถ้าไม่ได้ตั้งค่อยใช้ของหน้าที่
-- (คนที่ต่างจากหน้าที่ตัวเอง เช่น ออฟฟิศ ADF ทำ 6 วัน ตั้งรายคนทับได้)

create or replace function public.attendance_period_summary(p_from date, p_to date)
 returns table(full_name text, company_code text, business_unit text, employment_type text, days_per_week smallint, days_worked integer, days_expected numeric, days_leave integer, days_absent integer, total_hours numeric, avg_hours_per_day numeric)
 language sql
 stable
 set search_path to ''
as $function$
  with s as (select * from public.attendance_summary(p_from, p_to)),
  agg as (
    select s.user_id, s.full_name, s.company_code, s.business_unit,
           count(*) filter (where s.status in ('worked','worked_wfh')) as worked,
           count(*) filter (where s.status = 'leave')  as leave_d,
           count(*) filter (where s.status = 'absent') as absent_d,
           sum(s.total_hours) as hours
    from s group by 1,2,3,4
  )
  select a.full_name, a.company_code, a.business_unit,
         u.employment_type,
         coalesce(u.days_per_week, jf.default_days_per_week) as dpw,
         a.worked::int,
         round(coalesce(u.days_per_week, jf.default_days_per_week, 5)
               * ((p_to - p_from + 1) / 7.0) - a.leave_d, 1) as expected,
         a.leave_d::int, a.absent_d::int,
         round(coalesce(a.hours, 0), 1),
         case when a.worked > 0 then round(coalesce(a.hours,0) / a.worked, 1) else 0 end
  from agg a
  join public.users u on u.id = a.user_id
  left join public.job_functions jf on jf.id = u.job_function_id
  order by a.company_code, a.business_unit, a.full_name;
$function$;;
