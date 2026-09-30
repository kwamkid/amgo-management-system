-- วันไม่บังคับ · เวลาเลิกงานที่พนักงานแจ้ง · กล่องงานหน้าแรก HR (30 ก.ย. 69)
--
-- ── 1) วัน "เข้าได้ ไม่บังคับ" ───────────────────────────────────────
-- กิ่งไผ่: หยุดอาทิตย์ แต่เสาร์ "ให้เข้าบ้าง ไม่จำเป็น ไม่ต้องอยู่ทั้งวัน"
-- (เจ้าของ 30 ก.ย. 69) — ของเดิมมีแค่ทำงาน/หยุด ตั้งเป็นหยุดแล้วทุกเสาร์ที่มา
-- จะโดนบังคับยื่นใบสลับวันหยุด ตั้งเป็นทำงานแล้วเสาร์ที่ไม่มาจะนับขาด
--   ไม่มา = ไม่นับขาด (day_off) · มา = นับมาทำงาน คิดชั่วโมงตามจริง
--   ไม่เด้งถามสลับวันหยุด (useCheckIn ถามเฉพาะ 'off')

alter table public.user_work_schedules drop constraint user_work_schedules_work_mode_check;
alter table public.user_work_schedules add constraint user_work_schedules_work_mode_check
  check (work_mode in ('onsite', 'wfh', 'off', 'optional'));

alter table public.schedule_exceptions drop constraint schedule_exceptions_work_mode_check;
alter table public.schedule_exceptions add constraint schedule_exceptions_work_mode_check
  check (work_mode in ('onsite', 'wfh', 'off', 'optional'));

alter table public.job_function_work_days drop constraint job_function_work_days_work_mode_check;
alter table public.job_function_work_days add constraint job_function_work_days_work_mode_check
  check (work_mode in ('onsite', 'wfh', 'off', 'optional'));

-- เหมือนเดิมทุกบรรทัด เพิ่มแค่ "optional ที่ไม่ได้มา = day_off" หลังเช็คเรื่องมา/ลา
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

-- ── 2) คิวอนุมัติ OT ปิดทิ้ง ─────────────────────────────────────────
-- payroll ไม่เคยอ่านธงนี้ (เติม OT จากชั่วโมงเช็คอินจริงของคนมีสิทธิ์) คิวจึง
-- ค้าง 1,926 ใบโดยไม่มีผลอะไร (เจ้าของสั่งปิด 30 ก.ย. 69) · ชั่วโมงไม่ถูกแตะ
-- ส่วนที่เกินเวลาปิดสาขาถูกตัดไปตั้งแต่ตอนเช็คเอาท์แล้ว
update public.checkins
   set needs_overtime_approval = false,
       status = case when status = 'pending' then 'completed' else status end
 where needs_overtime_approval or status = 'pending';

-- ── 3) เวลาเลิกงานที่พนักงานแจ้งเอง ──────────────────────────────────
-- ลืมเช็คเอาท์ → ระบบปิดที่เวลาเลิกงานปกติ (ไม่มี OT) · เปิดแอปครั้งถัดไปถาม
-- "เลิกงานจริงกี่โมง" แล้วเก็บไว้ตรงนี้ให้ HR กดอนุมัติ — ยังไม่แตะชั่วโมงจนกว่า
-- HR จะยืนยัน (ชั่วโมงคือเงิน)
alter table public.checkins
  add column if not exists claimed_checkout_time timestamptz,
  add column if not exists claim_note text,
  add column if not exists claimed_at timestamptz;

-- พนักงานแก้แถวที่ปิดกะแล้วไม่ได้ (RLS checkins_update_own_open) — ผ่านฟังก์ชันนี้
-- ที่ยอมแค่ 3 ช่องนี้ของใบตัวเองที่ยังรอตรวจ
create or replace function public.claim_checkout_time(p_checkin_id uuid, p_time timestamptz, p_note text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.checkins%rowtype;
begin
  select * into r from public.checkins where id = p_checkin_id;
  if not found or r.user_id is distinct from auth.uid() then
    raise exception 'ไม่พบใบเช็คอินของคุณ';
  end if;
  if r.hours_status is distinct from 'needs_review' then
    raise exception 'ใบนี้ HR ตรวจแล้ว แก้เวลาไม่ได้';
  end if;
  if p_time <= r.checkin_time then
    raise exception 'เวลาเลิกงานต้องหลังเวลาเข้างาน';
  end if;
  -- ยาวสุดของจริงคือ PC ห้าง ~12.5 ชม. · 20 ชม. เผื่อกะข้ามคืนแล้ว
  if p_time > r.checkin_time + interval '20 hours' or p_time > now() then
    raise exception 'เวลาเลิกงานไม่สมเหตุสมผล';
  end if;

  update public.checkins
     set claimed_checkout_time = p_time,
         claim_note = nullif(trim(coalesce(p_note, '')), ''),
         claimed_at = now()
   where id = p_checkin_id;
end;
$$;

revoke all on function public.claim_checkout_time(uuid, timestamptz, text) from public, anon;
grant execute on function public.claim_checkout_time(uuid, timestamptz, text) to authenticated;

-- ── 4) กล่องงานหน้าแรก HR ─────────────────────────────────────────────
-- วันแรกของงวดที่ยังไม่ตัดยอด — ตรงกับ cutoffDate() ใน lib/services/payrollCycle.ts
create or replace function public.payroll_open_from(p_cycle text, p_today date)
returns date
language sql
immutable
set search_path to ''
as $$
  select case coalesce(p_cycle, 'c28')
    when 'c4' then date_trunc('month', p_today)::date
    when 'c30' then
      case when extract(day from p_today) > 27
           then date_trunc('month', p_today)::date + 27
           else (date_trunc('month', p_today) - interval '1 month')::date + 27 end
    when 'eom' then
      case when p_today > (date_trunc('month', p_today) + interval '1 month - 1 day')::date - 3
           then (date_trunc('month', p_today) + interval '1 month - 1 day')::date - 2
           -- งวดก่อนตัดที่ (สิ้นเดือนก่อน − 3) = วันที่ 1 − 4 → เริ่มวันที่ 1 − 3
           else date_trunc('month', p_today)::date - 3 end
    else -- c28
      case when extract(day from p_today) > 25
           then date_trunc('month', p_today)::date + 25
           else (date_trunc('month', p_today) - interval '1 month')::date + 25 end
  end;
$$;

-- ทุกอย่างที่ HR ต้องทำ/ต้องตาม ในครั้งเดียว — security definer เพราะ
-- push_subscriptions เปิดให้อ่านเฉพาะของตัวเอง
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
  week as (
    select s.id, count(*) filter (where public.expected_work_mode(s.id, d::date) = 'off') as off_days
    from staff s, generate_series(today, today + 6, interval '1 day') d
    where s.needs_checkin and s.schedule_type <> 'rotating'
    group by s.id
  ),
  worked_on_off as (
    select c.user_id, count(distinct c.work_date) as n
    from public.checkins c
    join staff s on s.id = c.user_id and s.needs_checkin and s.schedule_type <> 'rotating'
    where c.work_date >= today - 60
      and public.expected_work_mode(c.user_id, c.work_date) = 'off'
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
