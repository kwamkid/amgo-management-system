-- รายงานให้แสดง "ชื่อจริง (ชื่อเล่น)" แทนชื่อจริงเปล่า ๆ
--
-- attendance_report กับ attendance_period_summary ต่อยอดจากฟังก์ชันนี้
-- แก้ที่เดียวจึงพอ  ชื่อคอลัมน์ยังเป็น full_name เหมือนเดิม หน้าจอไม่ต้องแก้

create or replace function public.attendance_summary(p_from date, p_to date, p_user_id uuid default null::uuid)
 returns table(user_id uuid, full_name text, company_code text, business_unit text, work_date date, expected_mode text, status text, checkin_type text, leave_type text, total_hours numeric, is_late boolean)
 language sql
 stable
 set search_path to ''
as $function$
  with days as (select generate_series(p_from, p_to, interval '1 day')::date as d),
  people as (
    select u.id, u.display_name as full_name, c.code as company_code, bu.name as unit,
           coalesce(u.requires_checkin, rs.requires_checkin, true) as needs_checkin,
           -- ตัดต้นทางเฉพาะวันเริ่มงานที่ยืนยันแล้ว — ถ้ายังไม่ยืนยันมันคือวันสมัคร
           -- ซึ่งอาจหลังวันเริ่มงานจริง เอามาตัดจะทำให้ข้อมูลเช็คอินจริงหายไป
           case when u.start_date_verified then u.start_date end as from_day,
           u.end_date as to_day
    from public.users u
    left join public.role_settings  rs on rs.role = u.role
    left join public.business_units bu on bu.id = u.business_unit_id
    left join public.companies      c  on c.id  = bu.company_id
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
