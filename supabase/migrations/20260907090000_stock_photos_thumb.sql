-- รูปย่อสำหรับตาราง/การ์ด — รูปเต็ม (1600px ≈ 300–500KB) โหลดช้าเมื่อโชว์ 50 รูปในหน้าเดียว
-- (เจ้าของทัก 7 ก.ย. 69) · สร้างตอนถ่ายพร้อมรูปเต็ม path เดียวกันต่อท้าย _thumb
-- null = รูปเก่าก่อนวันนี้ ใช้รูปเต็มแทน (หมดอายุ 60 วันเองอยู่แล้ว)
-- (ลงบน production แล้ว 7 ก.ย. 69 ผ่าน Management API — ไฟล์นี้คือสำเนา)
alter table public.stock_photos add column if not exists thumb_path text;
comment on column public.stock_photos.thumb_path is 'รูปย่อ 320px สำหรับตาราง/การ์ด (null = รูปเก่าก่อน 7 ก.ย. 69 ใช้รูปเต็มแทน)';
