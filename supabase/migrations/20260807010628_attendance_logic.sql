-- ═══════════════════════════════════════════════════════════════════════
-- ตรรกะสรุปการมาทำงาน — สิ่งที่ Firestore ทำไม่ได้เลย
-- ═══════════════════════════════════════════════════════════════════════

-- ── หาว่า "วันนี้คนนี้ควรทำงานแบบไหน" ──────────────────────────────────
-- ลำดับ: ข้อยกเว้นรายวัน > ตารางรายคน > ตารางสาขา > ค่าเริ่มต้น (จ-ศ onsite)
create or replace function expected_work_mode(p_user_id uuid, p_date date)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select e.work_mode from public.schedule_exceptions e
      where e.user_id = p_user_id and e.exception_date = p_date),
    (select u.work_mode from public.user_work_schedules u
      where u.user_id = p_user_id and u.day_of_week = extract(dow from p_date)),
    (select l.work_mode from public.location_work_schedules l
      join public.users usr on usr.primary_location_id = l.location_id
      where usr.id = p_user_id and l.day_of_week = extract(dow from p_date)),
    case when extract(dow from p_date) between 1 and 5 then 'onsite' else 'off' end
  );
$$;

comment on function expected_work_mode is
  'ค่าเริ่มต้นเมื่อไม่ได้ตั้งอะไรเลย = จันทร์-ศุกร์ onsite เสาร์อาทิตย์หยุด';

-- ── สรุปการมาทำงานรายวัน ───────────────────────────────────────────────
-- คืน: holiday · day_off · worked · worked_wfh · leave · absent
create or replace function attendance_summary(
  p_from date,
  p_to   date,
  p_user_id uuid default null
)
returns table (
  user_id       uuid,
  full_name     text,
  work_date     date,
  expected_mode text,
  status        text,
  checkin_type  text,
  leave_type    text,
  total_hours   numeric,
  is_late       boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as d
  ),
  people as (
    select u.id, u.full_name
    from public.users u
    where u.deleted_at is null
      and u.is_active
      and (p_user_id is null or u.id = p_user_id)
  ),
  grid as (
    select p.id, p.full_name, d.d,
           public.expected_work_mode(p.id, d.d) as expected,
           exists (select 1 from public.holidays h
                    where h.holiday_date = d.d and h.is_active) as is_holiday
    from people p cross join days d
  ),
  -- เช็คอินหลายรอบต่อวันได้ (ข้อมูลจริงสูงสุด 4) → รวมเป็นแถวเดียว
  ci as (
    select c.user_id, c.work_date,
           sum(c.total_hours) as hours,
           bool_or(c.is_late) as late,
           min(c.checkin_type) as ctype
    from public.checkins c
    where c.work_date between p_from and p_to
    group by c.user_id, c.work_date
  ),
  lv as (
    select ld.user_id, ld.leave_date, min(lr.leave_type) as ltype
    from public.leave_days ld
    join public.leave_requests lr on lr.id = ld.leave_request_id
    where ld.leave_date between p_from and p_to
      and ld.counts_toward_quota
      and lr.status = 'approved'
    group by ld.user_id, ld.leave_date
  )
  select
    g.id, g.full_name, g.d, g.expected,
    case
      when g.is_holiday          then 'holiday'
      when g.expected = 'off'    then 'day_off'
      -- กติกา: มาทำงานชนะใบลา (ตัดสินใจ 2026-08-07)
      when ci.user_id is not null then
        case when g.expected = 'wfh' then 'worked_wfh' else 'worked' end
      when lv.user_id is not null then 'leave'
      else 'absent'
    end,
    ci.ctype, lv.ltype, ci.hours, coalesce(ci.late, false)
  from grid g
  left join ci on ci.user_id = g.id and ci.work_date  = g.d
  left join lv on lv.user_id = g.id and lv.leave_date = g.d
  order by g.full_name, g.d;
$$;

comment on function attendance_summary is
  'สรุปรายวัน — "absent" คำนวณได้เพราะมีตารางงานแล้ว (เดิมแยกจาก "วันหยุด" ไม่ออก)';
