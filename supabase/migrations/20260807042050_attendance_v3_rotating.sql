-- ═══════════════════════════════════════════════════════════════════════
-- v3 — รองรับเวรสลับ (rotating) ที่ "ตกลงกันเอง ไม่ได้จด"
--
-- ผลของการไม่จดเวร: บอกไม่ได้ว่าวันไหนขาด เพราะแยกไม่ออกระหว่าง
-- "A ขาด" กับ "วันนี้เวร B" → รายวันได้แค่ not_scheduled
-- แต่ระดับสัปดาห์บอกได้ "ควรมา 5 มาจริง 4" ซึ่งพอสำหรับค่าแรงรายวัน
-- ═══════════════════════════════════════════════════════════════════════

create or replace function expected_work_mode(p_user_id uuid, p_date date)
returns text
language sql stable security invoker set search_path = ''
as $$
  select coalesce(
    (select e.work_mode from public.schedule_exceptions e            -- 1. ข้อยกเว้นรายวัน
      where e.user_id = p_user_id and e.exception_date = p_date),
    (select uw.work_mode from public.user_work_schedules uw          -- 2. ตารางรายคน
      where uw.user_id = p_user_id and uw.day_of_week = extract(dow from p_date)),
    (select bd.work_mode                                             -- 3. ตารางหน่วยงาน (fixed)
       from public.business_unit_work_days bd
       join public.business_units bu on bu.id = bd.business_unit_id
       join public.users u on u.business_unit_id = bu.id
      where u.id = p_user_id and bu.schedule_type = 'fixed'
        and bd.day_of_week = extract(dow from p_date)),
    (select 'rotating' from public.users u                           -- 4. สลับเวร = ไม่รู้
       join public.business_units bu on bu.id = u.business_unit_id
      where u.id = p_user_id and bu.schedule_type = 'rotating'),
    case when extract(dow from p_date) between 1 and 5               -- 5. ค่าเริ่มต้น
         then 'onsite' else 'off' end
  );
$$;

drop function if exists attendance_summary(date, date, uuid);

create function attendance_summary(p_from date, p_to date, p_user_id uuid default null)
returns table (
  user_id uuid, full_name text, company_code text, business_unit text,
  work_date date, expected_mode text, status text,
  checkin_type text, leave_type text, total_hours numeric, is_late boolean
)
language sql stable security invoker set search_path = ''
as $$
  with days as (select generate_series(p_from, p_to, interval '1 day')::date as d),
  people as (
    select u.id, u.full_name, c.code as company_code, bu.name as unit,
           coalesce(u.requires_checkin, rs.requires_checkin, true) as needs_checkin
    from public.users u
    left join public.role_settings  rs on rs.role = u.role
    left join public.business_units bu on bu.id = u.business_unit_id
    left join public.companies      c  on c.id  = bu.company_id
    where u.deleted_at is null and u.is_active
      and (p_user_id is null or u.id = p_user_id)
  ),
  grid as (
    select p.*, d.d, public.expected_work_mode(p.id, d.d) as expected,
           exists (select 1 from public.holidays h
                    where h.holiday_date = d.d and h.is_active) as is_holiday
    from people p cross join days d
  ),
  ci as (
    select c.user_id, c.work_date, sum(c.total_hours) as hours,
           bool_or(c.is_late) as late, min(c.checkin_type) as ctype
    from public.checkins c where c.work_date between p_from and p_to
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
      when g.is_holiday            then 'holiday'
      when g.expected = 'off'      then 'day_off'
      when ci.user_id is not null  then
        case when g.expected = 'wfh' then 'worked_wfh' else 'worked' end
      when lv.user_id is not null  then 'leave'
      when not g.needs_checkin     then 'not_tracked'
      when g.expected = 'rotating' then 'not_scheduled'   -- สลับเวร บอกไม่ได้ว่าขาด
      else 'absent'
    end,
    ci.ctype, lv.ltype, ci.hours, coalesce(ci.late, false)
  from grid g
  left join ci on ci.user_id = g.id and ci.work_date  = g.d
  left join lv on lv.user_id = g.id and lv.leave_date = g.d
  order by g.full_name, g.d;
$$;

-- สรุปรายช่วง — days_worked คือตัวเลขคูณค่าแรงรายวันได้เลย
create or replace function attendance_period_summary(p_from date, p_to date)
returns table (
  full_name text, company_code text, business_unit text,
  employment_type text, days_per_week smallint,
  days_worked int, days_expected numeric, days_leave int, days_absent int,
  total_hours numeric, avg_hours_per_day numeric
)
language sql stable security invoker set search_path = ''
as $$
  with s as (select * from public.attendance_summary(p_from, p_to)),
  agg as (
    select s.user_id, s.full_name, s.company_code, s.business_unit,
           count(*) filter (where s.status in ('worked','worked_wfh')) as worked,
           count(*) filter (where s.status = 'leave')  as leave_d,
           count(*) filter (where s.status = 'absent') as absent_d,
           sum(s.total_hours) as hours
    from s group by 1,2,3,4
  )
  select a.full_name, a.company_code, a.business_unit, u.employment_type,
         coalesce(u.days_per_week, bu.default_days_per_week) as dpw,
         a.worked::int,
         round(coalesce(u.days_per_week, bu.default_days_per_week, 5)
               * ((p_to - p_from + 1) / 7.0) - a.leave_d, 1) as expected,
         a.leave_d::int, a.absent_d::int,
         round(coalesce(a.hours, 0), 1),
         case when a.worked > 0 then round(coalesce(a.hours,0) / a.worked, 1) else 0 end
  from agg a
  join public.users u on u.id = a.user_id
  left join public.business_units bu on bu.id = u.business_unit_id
  order by a.company_code, a.business_unit, a.full_name;
$$;

-- พนักงานใหม่ยังไม่ได้ WFH — บล็อกที่ระดับ DB
create or replace function trg_check_wfh_eligible()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if new.work_mode = 'wfh'
     and not (select u.wfh_eligible from public.users u where u.id = new.user_id) then
    raise exception 'พนักงานคนนี้ยังไม่ได้สิทธิ์ WFH — เปิด users.wfh_eligible ก่อน';
  end if;
  return new;
end;
$$;

create trigger schedule_exceptions_wfh_check
  before insert or update on schedule_exceptions
  for each row execute function trg_check_wfh_eligible();

create trigger user_work_schedules_wfh_check
  before insert or update on user_work_schedules
  for each row execute function trg_check_wfh_eligible();
