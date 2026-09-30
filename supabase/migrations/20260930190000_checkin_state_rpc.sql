-- สถานะหน้าเช็คอินในคำขอเดียว (30 ก.ย. 69)
--
-- useCheckIn เดิมยิง 2 รอบต่อกัน: หากะที่เปิดอยู่ → ถ้าเช็คอินวันนี้ ถาม
-- expected_work_mode + ใบสลับที่ยื่นไว้ (ไว้ตัดสินว่าต้องเด้งถามวันหยุดชดเชยไหม)
-- เรียกทุกครั้งที่เปิดหน้าเช็คอิน และหลังกดเช็คอิน/เอาท์ทุกครั้ง
--
-- security invoker — เห็นเฉพาะกะของตัวเองตาม RLS เหมือนเดิม
create or replace function public.checkin_state()
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $$
  with open_shift as (
    select c.*
    from public.checkins c
    where c.user_id = auth.uid()
      and c.status = 'checked-in'
      and c.checkout_time is null
      and c.work_date >= (now() at time zone 'Asia/Bangkok')::date - 2
    order by c.checkin_time desc
    limit 1
  )
  select jsonb_build_object(
    'active', (select to_jsonb(o) from open_shift o),
    -- ตารางวันของวันที่เช็คอิน — 'off' + ยังไม่ยื่นใบ = ต้องถามวันหยุดชดเชย
    'mode', (select public.expected_work_mode(o.user_id, o.work_date) from open_shift o),
    'swap_filed', coalesce((
      select exists (
        select 1 from public.schedule_swaps w
        where w.user_id = o.user_id and w.worked_date = o.work_date
          and w.status in ('pending', 'approved'))
      from open_shift o), false)
  );
$$;

revoke all on function public.checkin_state() from public, anon;
grant execute on function public.checkin_state() to authenticated;
