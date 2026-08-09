-- ═══════════════════════════════════════════════════════════════════════
-- ที่เก็บไฟล์
--
-- ของเดิมบน Firebase Storage โต 615.7 MB และโตเรื่อย ๆ ไม่มีวันลด
-- (สำรวจไว้ตอน Phase 1) เพราะไม่เคยลบรูปเช็คอินเก่าเลย
--
-- เจ้าของระบบสั่งไว้ว่า "ให้ลบทุก ๆ 60 วันก็ได้ครับ ส่วนใหญ่เช็คไม่เกิน 1 เดือน"
-- → คำนวณแล้วจะคงที่ประมาณ 148 MB ไม่โตต่อ
-- (ลองบีบอัดแล้วได้แค่ 0.05% เพราะรูปจากมือถือถูกบีบมาแล้ว ไม่คุ้มทำ)
-- ═══════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- รูปเซลฟี่ตอนเช็คอิน — ลบอัตโนมัติเมื่อครบ 60 วัน
  ('checkin-photos', 'checkin-photos', false, 5242880,
   array['image/jpeg','image/png','image/webp','image/heic']),

  -- รูปโปรไฟล์พนักงาน — เก็บถาวร
  ('avatars', 'avatars', false, 2097152,
   array['image/jpeg','image/png','image/webp']),

  -- รูปหลักฐานการส่งของ — ลบพร้อมรูปเช็คอิน
  ('delivery-photos', 'delivery-photos', false, 5242880,
   array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

-- ── สิทธิ์: อัปโหลดได้เฉพาะโฟลเดอร์ของตัวเอง ────────────────────────────
-- โครงพาธ: {user_id}/{ชื่อไฟล์}  → storage.foldername(name)[1] คือ user_id

create policy "เช็คอิน: อัปโหลดของตัวเอง" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'checkin-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

/* ดูได้ทั้งของตัวเองและของทีม — HR/manager ต้องตรวจรูปว่าเช็คอินจริงไหม */
create policy "เช็คอิน: ดูของตัวเองหรือทีม" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'checkin-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.can_view_all())
  );

/* ลบได้เฉพาะ HR — พนักงานลบรูปหลักฐานตัวเองไม่ได้ */
create policy "เช็คอิน: ลบได้เฉพาะ HR" on storage.objects
  for delete to authenticated
  using (bucket_id = 'checkin-photos' and public.is_hr());

create policy "รูปโปรไฟล์: จัดการของตัวเอง" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_hr())
  )
  with check (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_hr())
  );

create policy "รูปโปรไฟล์: ทุกคนดูได้" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

create policy "ส่งของ: อัปโหลดของตัวเอง" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'delivery-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

/* แผนที่ส่งของทุกคนดูได้ (ตัดสินใจ 2026-08-07) รูปก็เช่นกัน */
create policy "ส่งของ: ทุกคนดูได้" on storage.objects
  for select to authenticated
  using (bucket_id = 'delivery-photos');

create policy "ส่งของ: ลบได้เฉพาะ HR" on storage.objects
  for delete to authenticated
  using (bucket_id = 'delivery-photos' and public.is_hr());
