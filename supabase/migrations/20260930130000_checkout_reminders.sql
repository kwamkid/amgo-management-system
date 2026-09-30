-- เตือนเช็คเอาท์ด้วย push ตามนิสัยของแต่ละคน (30 ก.ย. 69)
--
-- เจ้าของ: "ให้ดูจาก personal stat" — ถ้าเตือนตามเวลาเลิกกะอย่างเดียว PC ที่อยู่
-- ทำ OT ถึงห้างปิด 22:00 จะโดนเตือนตอน 19:30 ทุกวันจนปิดแจ้งเตือนทิ้ง
--
-- เตือนครั้งเดียวต่อกะ เมื่อเลยทั้ง (1) เวลาเลิกงานปกติ และ (2) เวลาที่คนนี้
-- มักเช็คเอาท์ (มัธยฐาน 30 วัน ต้องมีอย่างน้อย 5 วัน) ไปแล้ว 30 นาที
-- ไม่เกิน 23:30 — cron 00:05 จะปิดกะให้อยู่แล้ว

alter table public.checkins add column if not exists checkout_reminded_at timestamptz;

create or replace function public.checkout_reminders_due(p_now timestamptz default now())
returns table(checkin_id uuid, user_id uuid, remind_at timestamptz)
language sql
stable
set search_path to ''
as $$
  with open_shift as (
    select c.id, c.user_id, c.checkin_time, c.shift_start_time, c.shift_end_time,
           coalesce(l.break_hours, 1)::numeric as brk,
           (c.checkin_time at time zone 'Asia/Bangkok')::date as d
    from public.checkins c
    left join public.locations l on l.id = c.primary_location_id
    where c.status = 'checked-in'
      and c.checkout_time is null
      and c.checkout_reminded_at is null
      and c.checkin_time > p_now - interval '20 hours'
  ),
  ends as (
    select o.*,
      case
        when o.shift_end_time is not null then
          (o.d + o.shift_end_time
             + case when o.shift_start_time is not null and o.shift_end_time < o.shift_start_time
                    then interval '1 day' else interval '0' end) at time zone 'Asia/Bangkok'
        else o.checkin_time + (8 + o.brk) * interval '1 hour'
      end as raw_end
    from open_shift o
  ),
  ends2 as (
    -- เช็คอินหลังเวลาเลิกกะ (มาช่วยงานเย็น) — นับเข้า + 9 ชม. แทน ไม่งั้นเตือนทันทีที่เข้า
    select e.*, case when e.raw_end <= e.checkin_time
                     then e.checkin_time + (8 + e.brk) * interval '1 hour'
                     else e.raw_end end as normal_end
    from ends e
  ),
  habit as (
    -- เวลาเช็คเอาท์จริงที่กดเอง ในวันเดียวกับที่เข้า (ไม่นับใบลืม/ระบบปิดให้)
    select c.user_id,
           percentile_cont(0.5) within group (
             order by extract(epoch from (c.checkout_time at time zone 'Asia/Bangkok')::time)
           ) as med_secs,
           count(*) as n
    from public.checkins c
    where c.checkout_time is not null
      and not coalesce(c.forgot_checkout, false)
      and not coalesce(c.auto_checkout, false)
      and c.checkin_time > p_now - interval '30 days'
      and (c.checkout_time at time zone 'Asia/Bangkok')::date = (c.checkin_time at time zone 'Asia/Bangkok')::date
    group by c.user_id
  ),
  due as (
    select e.id, e.user_id,
      least(
        greatest(
          e.normal_end,
          case when h.n >= 5
               then (e.d + make_interval(secs => h.med_secs)) at time zone 'Asia/Bangkok' end
        ) + interval '30 minutes',
        (e.d + time '23:30') at time zone 'Asia/Bangkok'
      ) as remind_at
    from ends2 e
    left join habit h on h.user_id = e.user_id
  )
  select id, user_id, remind_at from due where remind_at <= p_now;
$$;

-- cron เรียกด้วย service role เท่านั้น
revoke all on function public.checkout_reminders_due(timestamptz) from public, anon, authenticated;
