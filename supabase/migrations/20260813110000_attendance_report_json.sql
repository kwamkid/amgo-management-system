-- รายงานเข้างานทั้งช่วงเป็น jsonb ก้อนเดียว: คำนวณ attendance_summary รอบเดียว
-- เดิม client ขอทีละ 1,000 แถว (เพดาน max-rows ของ PostgREST) แต่ฟังก์ชันคำนวณใหม่
-- ทั้งชุดทุกรอบ — ทั้งปี ~10 รอบ รอบละ ~3 วิ ชนกันหลายคนแล้วเกิน statement_timeout 8 วิ
-- jsonb ไม่ติดเพดานแถว จึงจบใน 1 ครั้ง
create or replace function public.attendance_report_json(
  p_from date,
  p_to date,
  p_user_ids uuid[] default null,
  p_location_id uuid default null,
  p_only_present boolean default true
) returns jsonb
language sql
stable
set search_path to ''
as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.work_date, t.full_name), '[]'::jsonb)
  from public.attendance_report(
    p_from, p_to, p_user_ids, p_location_id, p_only_present, 2147483647, 0
  ) t;
$$;
