-- รายงานการเข้างานได้ทุกอย่างในคำขอเดียว (30 ก.ย. 69)
--
-- เดิมหน้ารายงาน/เงินเดือน เรียกฟังก์ชันนี้แล้วยิงต่ออีก 3 คำขอ: ชื่อพนักงาน
-- (ซ้ำซ้อน — full_name เป็น display_name อยู่แล้ว) · หมายเหตุใบสลับวันหยุด ·
-- วันทำงาน/สัปดาห์ของทุกคน · ตอนนี้แนบ swap_note กับ days_per_week มาในแต่ละแถว
-- (คีย์ใหม่เพิ่มเข้าไปเฉย ๆ — แอปเวอร์ชันเก่าที่ยังเปิดค้างอ่านได้ตามเดิม)
create or replace function public.attendance_report_json(
  p_from date, p_to date, p_user_ids uuid[] default null,
  p_location_id uuid default null, p_only_present boolean default true
)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select coalesce(
    jsonb_agg(
      to_jsonb(t) || jsonb_build_object(
        -- พออนุมัติใบสลับ วันทั้งคู่กลายเป็นวันปกติ — หมายเหตุนี้เล่าว่าสลับกับวันไหน
        'swap_note', replace(e.note, '[ใบสลับวันหยุด] ', ''),
        -- ใช้คิดวันขาดของกะหมุนเวียน (ควรมา = วันในช่วง × วัน/สัปดาห์ ÷ 7)
        'days_per_week', u.days_per_week
      )
      order by t.work_date, t.full_name
    ),
    '[]'::jsonb
  )
  from public.attendance_report(
    p_from, p_to, p_user_ids, p_location_id, p_only_present, 2147483647, 0
  ) t
  left join public.schedule_exceptions e
         on e.user_id = t.user_id and e.exception_date = t.work_date
        and e.note like '[ใบสลับวันหยุด]%'
  left join public.users u on u.id = t.user_id;
$function$;
