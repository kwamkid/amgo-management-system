-- เจ้าของรูปลบไฟล์ของตัวเอง "วันนี้" ได้ (ถ่ายพลาด) — เดิมลบได้แค่แถวในตาราง ไฟล์ค้างใน bucket
-- ตลอดไปเพราะ cron ล้างตามแถว · ย้อนหลังยังลบไม่ได้ (หลักฐาน) — path คือ {user}/{YYYY-MM-DD}/{ts}.jpg
-- (ลงบน production แล้ว 4 ก.ย. 69 ผ่าน MCP — ไฟล์นี้คือสำเนา)
create policy "รูปสต็อก: เจ้าของลบไฟล์ของวันนี้ได้" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'stock-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD')
  );
