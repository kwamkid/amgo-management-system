-- ═══════════════════════════════════════════════════════════════════════
-- attendance_summary v5 — คนออกแล้วไม่ขึ้น "ขาด" · คนใหม่ไม่ขาดก่อนเริ่มงานจริง
--
-- ปัญหาที่เจอ (11 ส.ค. 69):
--   1. คนลาออกไปแล้ว แต่ HR เพิ่งมากดปิดบัญชีทีหลัง → end_date ชี้วันที่กดปิด
--      ไม่ใช่วันทำงานจริงวันสุดท้าย → ช่วงระหว่างนั้นขึ้น "ขาดงาน" ทั้งที่คนออกไปแล้ว
--      ทางแก้: คนที่ปิดใช้งานแล้ว เก็บเฉพาะวันที่มีร่องรอยจริง (มาทำงาน/ลา/มีชั่วโมง)
--      เดือนเก่าที่ยังทำงานอยู่ดูย้อนหลังได้เหมือนเดิม แต่ไม่โผล่เป็นขาดในเดือนปัจจุบัน
--   2. คนใหม่ที่วันเริ่มงานยังไม่ยืนยัน (start_date = วันสมัคร ไม่ใช่วันเริ่มจริง)
--      เดิมไม่ตัดต้นทางเลย → โดนนับขาดตั้งแต่ต้นเดือนทั้งที่ยังไม่เริ่มงาน
--      ทางแก้: นับจากวันเช็คอินครั้งแรกจริงแทน · ยังไม่เคยเช็คอินเลย = ยังไม่เริ่มงาน
--      → ไม่มีแถวในรายงาน
-- ═══════════════════════════════════════════════════════════════════════

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
           u.is_active,
           case
             when u.start_date_verified then u.start_date
             -- วันเริ่มยังไม่ยืนยัน = start_date คือวันสมัคร — นับจากวันเช็คอินครั้งแรกจริงแทน
             -- ยังไม่เคยเช็คอินเลย = ยังไม่เริ่มงาน → infinity = ไม่มีแถวในรายงาน
             else coalesce(
               (select min(cc.work_date) from public.checkins cc where cc.user_id = u.id),
               'infinity'::date)
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

comment on function public.attendance_summary is
  'v5 — คนออกแล้วเหลือเฉพาะวันที่มีร่องรอยจริง (ไม่ขึ้นขาด) · คนใหม่ที่ยังไม่ยืนยันวันเริ่ม นับจากเช็คอินครั้งแรก ยังไม่เคยเช็คอิน = ไม่ขึ้นรายงาน';
