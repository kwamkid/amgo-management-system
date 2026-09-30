-- รายงานการเข้างานเร็วขึ้น ~8 เท่า (30 ก.ย. 69)
--
-- attendance_summary เป็นฐานของรายงานทุกหน้า (attendance_report / period_summary /
-- payroll / หน้าแรก HR) · เดิมเรียก expected_work_mode() ทีละคนทีละวัน —
-- 42 คน × 31 วัน = 1,300 ครั้ง ครั้งละ 4 query ย่อย → 0.5–0.7 วินาทีต่อการเปิด
-- รายงาน (pg_stat_statements) · เขียนใหม่เป็น join ทั้งช่วงครั้งเดียว
-- ผลลัพธ์ตรงกับของเดิมทุกแถว (เทียบ ก.ค.–ก.ย. 69: 3,803 แถว ต่างกัน 0) · 191 → 24 ms/เดือน
--
-- expected_work_mode() ยังอยู่ — ใช้กับวันเดียว (ใบสลับวันหยุด/หน้าเช็คอิน)
-- ⚠️ แก้ลำดับการตัดสินวันทำงานเมื่อไหร่ ต้องแก้ทั้งสองที่ให้ตรงกัน

create or replace function public.attendance_summary(p_from date, p_to date, p_user_id uuid default null)
returns table(user_id uuid, full_name text, company_code text, business_unit text, work_date date,
              expected_mode text, status text, checkin_type text, leave_type text,
              total_hours numeric, is_late boolean)
language sql
stable
set search_path to ''
as $function$
  with days as (select generate_series(p_from, p_to, interval '1 day')::date as d),
  people as (
    select u.id, u.display_name as full_name, c.code as company_code, jf.name_th as unit,
           u.job_function_id, jf.schedule_type,
           coalesce(u.requires_checkin, rs.requires_checkin, true) as needs_checkin,
           u.is_active,
           case
             when coalesce(u.requires_checkin, rs.requires_checkin, true) then
               -- คนต้องเช็คอิน: นับจากเช็คอินครั้งแรกจริง (ยังไม่เคยเช็ค = infinity = ไม่ขึ้น)
               -- และไม่ก่อนวันเริ่มงานที่ยืนยันแล้ว (greatest ข้าม null ให้เอง)
               greatest(
                 coalesce((select min(cc.work_date) from public.checkins cc where cc.user_id = u.id),
                          'infinity'::date),
                 case when u.start_date_verified then u.start_date end)
             when u.start_date_verified then u.start_date
             else null
           end as from_day,
           u.end_date as to_day
    from public.users u
    left join public.role_settings  rs on rs.role = u.role
    left join public.job_functions  jf on jf.id  = u.job_function_id
    left join public.companies      c  on c.id   = u.company_id
    where u.deleted_at is null
      and (p_user_id is null or u.id = p_user_id)
  ),
  grid as (
    -- ลำดับเดียวกับ expected_work_mode() ทุกขั้น (สลับรายวัน > รายคน > ตำแหน่งแบบตายตัว
    -- > กะหมุนเวียน > จ–ศ) แต่ join ทั้งช่วงครั้งเดียว แทนเรียกฟังก์ชันทีละคนทีละวัน
    select p.*, d.d,
      coalesce(
        e.work_mode,
        uw.work_mode,
        case when p.schedule_type = 'fixed' then fd.work_mode end,
        case when p.schedule_type = 'rotating' then 'rotating' end,
        case when extract(dow from d.d) between 1 and 5 then 'onsite' else 'off' end
      ) as expected,
      (h.holiday_date is not null) as is_holiday
    from people p
    cross join days d
    left join public.schedule_exceptions e
           on e.user_id = p.id and e.exception_date = d.d
    left join public.user_work_schedules uw
           on uw.user_id = p.id and uw.day_of_week = extract(dow from d.d)
    left join public.job_function_work_days fd
           on fd.job_function_id = p.job_function_id and fd.day_of_week = extract(dow from d.d)
    left join (select distinct hh.holiday_date from public.holidays hh where hh.is_active) h
           on h.holiday_date = d.d
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
  ),
  scored as (
    select g.id as user_id, g.full_name, g.company_code, g.unit as business_unit,
      g.d as work_date, g.expected as expected_mode,
      case
        when g.is_holiday           then 'holiday'
        when g.expected = 'off'     then 'day_off'
        when ci.user_id is not null then
          case when g.expected = 'wfh' then 'worked_wfh' else 'worked' end
        when lv.user_id is not null then 'leave'
        when g.expected = 'optional' then 'day_off'
        when not g.needs_checkin    then 'not_tracked'
        when g.expected = 'rotating' then 'not_scheduled'
        else 'absent'
      end as status,
      ci.ctype as checkin_type, lv.ltype as leave_type,
      ci.hours as total_hours, coalesce(ci.late, false) as is_late,
      g.is_active
    from grid g
    left join ci on ci.user_id = g.id and ci.work_date  = g.d
    left join lv on lv.user_id = g.id and lv.leave_date = g.d
  )
  select s.user_id, s.full_name, s.company_code, s.business_unit, s.work_date,
         s.expected_mode, s.status, s.checkin_type, s.leave_type, s.total_hours, s.is_late
  from scored s
  -- คนที่ออกไปแล้ว เหลือเฉพาะวันที่มีร่องรอยจริง — ไม่นับขาด ไม่โชว์วันหยุดลอย ๆ
  where s.is_active
     or s.status in ('worked', 'worked_wfh', 'leave')
     or coalesce(s.total_hours, 0) > 0
  order by s.full_name, s.work_date;
$function$;

-- หน้าแรก HR ใช้ตารางวันก้อนเดียวกันแทนเรียกรายแถว
create or replace function public.hr_inbox()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  today date := (now() at time zone 'Asia/Bangkok')::date;
  result jsonb;
begin
  if not public.is_hr() then
    raise exception 'เฉพาะ HR และผู้ดูแลระบบ';
  end if;

  with staff as (
    select u.id, u.display_name as name, u.job_function_id,
           coalesce(u.payroll_cycle, jf.payroll_cycle, 'c28') as cycle,
           coalesce(jf.schedule_type, 'fixed') as schedule_type,
           coalesce(u.requires_checkin, rs.requires_checkin, true) as needs_checkin
    from public.users u
    left join public.job_functions jf on jf.id = u.job_function_id
    left join public.role_settings rs on rs.role = u.role
    where u.deleted_at is null and u.is_active and not u.is_system
  ),
  forgot as (
    select c.id, c.user_id, s.name, c.work_date, c.checkin_time, c.checkout_time,
           c.shift_start_time, c.shift_end_time, c.claimed_checkout_time, c.claim_note
    from public.checkins c
    join staff s on s.id = c.user_id
    where c.hours_status = 'needs_review'
      and c.work_date >= public.payroll_open_from(s.cycle, today)
  ),
  -- ตารางวันทั้งช่วงคิดครั้งเดียวจาก attendance_summary (set-based) — เดิมเรียก
  -- expected_work_mode() รายแถว ~1,500 ครั้งต่อการเปิดหน้าแรก
  grid60 as (
    select a.user_id, a.work_date, a.expected_mode
    from public.attendance_summary(today - 60, today + 6) a
  ),
  week as (
    select s.id, count(*) filter (where g.expected_mode = 'off') as off_days
    from staff s
    join grid60 g on g.user_id = s.id and g.work_date between today and today + 6
    where s.needs_checkin and s.schedule_type <> 'rotating'
    group by s.id
  ),
  worked_on_off as (
    select c.user_id, count(distinct c.work_date) as n
    from public.checkins c
    join staff s on s.id = c.user_id and s.needs_checkin and s.schedule_type <> 'rotating'
    join grid60 g on g.user_id = c.user_id and g.work_date = c.work_date
    where c.work_date >= today - 60
      and g.expected_mode = 'off'
      and not exists (select 1 from public.schedule_swaps w
                       where w.user_id = c.user_id and w.worked_date = c.work_date
                         and w.status in ('pending', 'approved'))
    group by c.user_id
  ),
  schedule_issues as (
    select s.id as user_id, s.name,
           case
             when w.off_days >= 3 then 'หยุด ' || w.off_days || ' วัน/สัปดาห์ — ยังไม่ได้ยืนยันวันหยุดประจำ'
             else 'มาทำงานตรงวันหยุดในระบบ ' || o.n || ' ครั้งใน 60 วัน — วันหยุดในระบบอาจไม่ตรง'
           end as reason
    from staff s
    left join week w on w.id = s.id
    left join worked_on_off o on o.user_id = s.id
    where coalesce(w.off_days, 0) >= 3 or coalesce(o.n, 0) >= 3
  ),
  absent as (
    select a.user_id, a.full_name as name
    from public.attendance_summary(today, today) a
    join staff s on s.id = a.user_id
    where a.status = 'absent'
  ),
  no_push as (
    select s.id as user_id, s.name
    from staff s
    where not exists (select 1 from public.push_subscriptions p where p.user_id = s.id)
  )
  select jsonb_build_object(
    'today', today,
    'leave_pending', (select count(*) from public.leave_requests where status = 'pending'),
    'swap_pending', (select count(*) from public.schedule_swaps where status = 'pending'),
    'forgot', coalesce((select jsonb_agg(to_jsonb(f) order by f.claimed_checkout_time is null, f.work_date desc) from forgot f), '[]'),
    'absent_today', coalesce((select jsonb_agg(to_jsonb(a) order by a.name) from absent a), '[]'),
    'schedule_issues', coalesce((select jsonb_agg(to_jsonb(i) order by i.name) from schedule_issues i), '[]'),
    'no_push', coalesce((select jsonb_agg(to_jsonb(n) order by n.name) from no_push n), '[]'),
    'staff_total', (select count(*) from staff)
  ) into result;

  return result;
end;
$$;


revoke all on function public.hr_inbox() from public, anon;
grant execute on function public.hr_inbox() to authenticated;

drop function if exists public._attendance_summary_setbased(date, date, uuid);
