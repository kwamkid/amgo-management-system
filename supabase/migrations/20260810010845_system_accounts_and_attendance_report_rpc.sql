-- ═══════════════════════════════════════════════════════════════════════
-- 1) บัญชีระบบ ไม่ใช่พนักงาน
--
-- Dev Admin กับ Super Admin โผล่ในรายชื่อพนักงาน · ถูกนับในสถิติ ·
-- ขึ้นในรายงานว่า "ขาดงาน" ทุกวัน  ทั้งที่ไม่ใช่คน
-- ═══════════════════════════════════════════════════════════════════════

alter table users
  add column if not exists is_system boolean not null default false;

comment on column users.is_system is
  'บัญชีของระบบ ไม่ใช่พนักงานจริง — ต้องกันออกจากรายชื่อ สถิติ และรายงานทุกที่';

update users set is_system = true
 where line_user_id in ('dev-admin-user', 'superadmin_system');

-- ═══════════════════════════════════════════════════════════════════════
-- 2) รายงานการมาทำงาน — ให้ฐานข้อมูลตัดหน้ามาให้
--
-- ของเดิมหน้าจอเรียก attendance_summary() แล้วดึงมาทั้งเดือน
-- (พนักงาน 46 คน × 31 วัน = 1,357 แถว) เพื่อเอามาโชว์ทีละ 50 แถว
--
-- แย่กว่านั้นคือ PostgREST ตัดผลลัพธ์ที่ 1,000 แถวโดยไม่มี error
-- → 357 แถวหายเงียบ ๆ และคนท้าย ๆ ลำดับหายจากรายงานทั้งเดือน
-- (เจอตอนเขียน scripts/test-attendance-report.mjs)
--
-- ตัวนี้กรอง เรียง นับ และตัดหน้าให้เสร็จในฐานข้อมูล ส่งกลับเฉพาะหน้าที่ขอ
-- พร้อมเวลาเข้า-ออกและชื่อสาขา ซึ่งเดิมต้อง query แยกอีกรอบ
-- ═══════════════════════════════════════════════════════════════════════

create or replace function attendance_report(
  p_from date,
  p_to date,
  p_user_ids uuid[] default null,
  p_location_id uuid default null,
  p_only_present boolean default true,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  work_date date, user_id uuid, full_name text, status text,
  checkin_type text, leave_type text, total_hours numeric,
  is_late boolean, late_minutes int, first_in time, last_out time,
  location_name text, holiday_name text, is_working_holiday boolean,
  total_count bigint
)
language sql
security invoker
stable
set search_path = ''
as $$
  with grid as (
    select a.*
    from public.attendance_summary(p_from, p_to) a
    join public.users u on u.id = a.user_id
    where not u.is_system
      and (p_user_ids is null or a.user_id = any(p_user_ids))
      and (
        p_location_id is null
        or exists (
          select 1 from public.user_allowed_locations l
          where l.user_id = a.user_id and l.location_id = p_location_id
        )
      )
  ),
  detail as (
    select
      c.user_id, c.work_date,
      min(c.checkin_time) as first_in,
      max(c.checkout_time) as last_out,
      max(c.late_minutes) as late_minutes,
      (array_agg(c.primary_location_name order by c.checkin_time))[1] as location_name
    from public.checkins c
    where c.work_date between p_from and p_to
    group by c.user_id, c.work_date
  ),
  joined as (
    select
      g.work_date, g.user_id, g.full_name, g.status, g.checkin_type,
      g.leave_type, g.total_hours, g.is_late,
      coalesce(d.late_minutes, 0)::int as late_minutes,
      (d.first_in at time zone 'Asia/Bangkok')::time as first_in,
      (d.last_out at time zone 'Asia/Bangkok')::time as last_out,
      d.location_name, h.name as holiday_name, h.is_working_day as is_working_holiday
    from grid g
    left join detail d on d.user_id = g.user_id and d.work_date = g.work_date
    left join public.holidays h on h.holiday_date = g.work_date and h.is_active
    where not p_only_present or g.status not in ('absent') or h.id is not null
  )
  select j.*, count(*) over () as total_count
  from joined j
  order by j.work_date, j.full_name
  limit p_limit offset p_offset;
$$;

comment on function attendance_report is
  'รายงานการมาทำงานแบบแบ่งหน้า — กรอง/เรียง/นับในฐานข้อมูล ไม่ต้องลากทั้งเดือนมาที่เบราว์เซอร์';
