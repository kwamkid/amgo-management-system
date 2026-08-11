-- ปิดฉาก business_unit_id บน users — แทนที่ด้วย บริษัท (company_id) + ตำแหน่ง (job_function_id)
-- ไปตั้งแต่รอบแยกโครงสร้าง 14 หน่วยงาน → 2 บริษัท + ตำแหน่ง
--
-- คอลัมน์นี้ค้ำโค้ดเก่าที่ deploy อยู่มาระยะหนึ่ง (กติกา: ห้ามลบจนกว่าโค้ดจริงเลิกใช้)
-- ตอนนี้โค้ดที่ deploy เลิกอ่าน/เขียนแล้ว และไม่มี function/view/policy ไหนพิงอยู่ — ลบได้

alter table public.users drop column if exists business_unit_id;
