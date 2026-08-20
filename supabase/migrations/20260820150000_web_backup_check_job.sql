-- เพิ่มชนิดงาน backup_check — "ไปดูว่าไฟล์สำรองโผล่หรือยัง + เก็บกวาดของเก่า"
--
-- ทำไมต้องมีชนิดใหม่: งานสำรองรอได้แค่ ~25 วิ (Vercel ตัดฟังก์ชันที่ 60) แต่ไฟล์
-- 1 GB ขึ้นไปเสร็จช้ากว่านั้นเสมอ — ของ aducationthings.com เสร็จช้ากว่าที่งาน
-- ปิดตัวเองไป 2 วินาที ระบบเลยบันทึกไฟล์เก่าของเดือนก่อนแทน แล้วหน้าเว็บก็ขึ้นว่า
-- "สำรองล่าสุด 44 วันที่แล้ว" ทั้งที่เพิ่งสำรองเสร็จ (เจ้าของทัก 20 ส.ค. 69)
--
-- งานสำรองจะต่อคิวงานชนิดนี้ให้ตัวเองเมื่อยังไม่เห็นไฟล์ · งานนี้ไม่สั่งสำรองซ้ำ
-- แค่ไปดูว่าไฟล์มาหรือยัง ยังไม่มาก็ต่อคิวตัวเองอีก จนกว่าจะเจอหรือหมดโควตารอบ
--
-- ⚠️ ต้องขึ้น DB ก่อน deploy โค้ดเสมอ — ไม่งั้นโค้ดใหม่จะ insert แล้วชน constraint

alter table public.web_jobs drop constraint if exists web_jobs_type_check;
alter table public.web_jobs add constraint web_jobs_type_check
  check (type = any (array['scan', 'plugin_update', 'plugin_check', 'backup', 'backup_check', 'discover']));

alter table public.web_run_batches drop constraint if exists web_run_batches_type_check;
alter table public.web_run_batches add constraint web_run_batches_type_check
  check (type = any (array['scan', 'plugin_update', 'plugin_check', 'backup', 'backup_check', 'discover']));
