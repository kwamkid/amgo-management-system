-- ═══════════════════════════════════════════════════════════════════════
-- เพิ่มสถานะ 'not_tracked' — คนที่ไม่ต้องเช็คอิน (manager ขึ้นไป)
-- ถ้าไม่มีตัวนี้ รายงานจะขึ้นว่า manager "ขาดงาน" ทุกวัน
-- ═══════════════════════════════════════════════════════════════════════

drop function if exists attendance_summary(date, date, uuid);

create function attendance_summary(p_from date, p_to date, p_user_id uuid default null)
returns table (
  user_id uuid, full_name text, role text, work_date date,
  expected_mode text, status text, checkin_type text, leave_type text,
  total_hours numeric, is_late boolean
)
language sql stable security invoker set search_path = ''
as $$
  with days as (select generate_series(p_from, p_to, interval '1 day')::date as d),
  people as (
    select u.id, u.full_name, u.role,
           coalesce(u.requires_checkin, rs.requires_checkin, true) as needs_checkin
    from public.users u
    left join public.role_settings rs on rs.role = u.role
    where u.deleted_at is null and u.is_active
      and (p_user_id is null or u.id = p_user_id)
  ),
  grid as (
    select p.id, p.full_name, p.role, p.needs_checkin, d.d,
           public.expected_work_mode(p.id, d.d) as expected,
           exists (select 1 from public.holidays h
                    where h.holiday_date = d.d and h.is_active) as is_holiday
    from people p cross join days d
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
  select g.id, g.full_name, g.role, g.d, g.expected,
    case
      when g.is_holiday           then 'holiday'
      when g.expected = 'off'     then 'day_off'
      when ci.user_id is not null then
        case when g.expected = 'wfh' then 'worked_wfh' else 'worked' end
      when lv.user_id is not null then 'leave'
      when not g.needs_checkin    then 'not_tracked'
      else 'absent'
    end,
    ci.ctype, lv.ltype, ci.hours, coalesce(ci.late, false)
  from grid g
  left join ci on ci.user_id = g.id and ci.work_date  = g.d
  left join lv on lv.user_id = g.id and lv.leave_date = g.d
  order by g.full_name, g.d;
$$;

comment on function attendance_summary is
  'สถานะ: holiday · day_off · worked · worked_wfh · leave · not_tracked · absent';
