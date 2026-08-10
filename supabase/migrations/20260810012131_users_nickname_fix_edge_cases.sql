-- เก็บตกจาก users_nickname_and_display_name — 2 เคสที่กติกาเดิมตัดสินผิด
--
-- 1) ชื่อที่ต่างจากชื่อ LINE แค่ "ช่องว่างซ้ำ" ไม่ใช่ชื่อจริงที่มีคนกรอก
--    "Thirada  Arpamang" (LINE) → "Thirada Arpamang" หลังเก็บกวาดช่องว่าง
--    แล้วกลายเป็นไม่เท่ากัน จึงถูกนับว่ายืนยันแล้วทั้งที่ยังเป็นชื่อ LINE
update public.users
set name_verified = false
where name_verified
  and not is_system
  and nickname is null
  and btrim(regexp_replace(full_name, '\s+', ' ', 'g'))
    = btrim(regexp_replace(line_display_name, '\s+', ' ', 'g'));

-- 2) วงเล็บซ้อน — "การสมัคร (Film:))" ตัวจับวงเล็บไม่แตะเพราะปิดสองชั้น
--    (ปล่อยไว้ถูกแล้ว ดีกว่าเดาผิด) แต่เคสนี้แยกด้วยมือได้
update public.users
set full_name = btrim(regexp_replace(full_name, '\s*\(.*\)\s*$', '')),
    nickname  = 'Film:)'
where full_name like '%(Film:)%';
