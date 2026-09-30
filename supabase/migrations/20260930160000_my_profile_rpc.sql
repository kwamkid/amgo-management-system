-- ข้อมูลผู้ใช้ที่ล็อกอินอยู่ในคำขอเดียว (30 ก.ย. 69)
--
-- AuthProvider โหลดตอนเปิดแอป — เดิมยิง 5 คำขอใน 2 รอบ (users + สาขาที่เช็คอินได้
-- → ตำแหน่ง + สิทธิ์ SRP + เจ้าของเว็บ) ตอนนี้รอบเดียว
--
-- security invoker — เห็นเท่ากับที่ผู้ใช้เห็นเองผ่าน RLS ทุกตาราง (เหมือนเดิมทุกประการ)
create or replace function public.my_profile()
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $$
  select jsonb_build_object(
    'user', to_jsonb(u),
    'location_ids', coalesce(
      (select jsonb_agg(l.location_id) from public.user_allowed_locations l where l.user_id = u.id),
      '[]'::jsonb),
    'job_function', (
      select jsonb_build_object(
        'sees_delivery', jf.sees_delivery, 'code', jf.code, 'schedule_type', jf.schedule_type,
        'work_start_time', jf.work_start_time, 'work_end_time', jf.work_end_time)
      from public.job_functions jf where jf.id = u.job_function_id),
    -- เมนู SRP: แอดมินเห็นเสมอ ที่เหลือต้องได้สิทธิ์อย่างน้อย 1 แบรนด์
    'has_srp_access', u.role = 'admin'
      or exists (select 1 from public.srp_brand_access s where s.user_id = u.id),
    -- เมนูดูแลเว็บลูกค้า — เฉพาะคนในรายชื่อ web_owners (ไม่ผูก role)
    'has_web_access', exists (select 1 from public.web_owners w where w.user_id = u.id)
  )
  from public.users u
  where u.id = auth.uid();
$$;

revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;
