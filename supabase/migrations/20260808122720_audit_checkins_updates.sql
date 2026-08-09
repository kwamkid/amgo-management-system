-- ═══════════════════════════════════════════════════════════════════════
-- เพิ่ม audit ให้ตารางเช็คอิน — ตกหล่นตอนวางระบบ audit รอบแรก
--
-- 🔴 ทำไมสำคัญ: regular_hours/overtime_hours คือตัวเลขที่กลายเป็นเงิน
--    ถ้า HR แก้ย้อนหลังแล้วไม่มีร่องรอย = ตรวจสอบไม่ได้ว่าใครแก้ แก้จากเท่าไหร่
--    (checkin_edits มีอยู่ก็จริง แต่ต้องให้แอปเขียนเอง — แก้ผ่าน API ตรง ๆ
--     หรือผ่าน SQL จะไม่มีอะไรถูกบันทึกเลย)
--
-- เก็บเฉพาะ UPDATE/DELETE ไม่เก็บ INSERT
-- เพราะการเช็คอินใหม่วันละ ~30 แถวไม่มีอะไรต้องสงสัย ตัวแถวเองคือหลักฐานอยู่แล้ว
-- ส่วนการ "แก้ของที่บันทึกไปแล้ว" คือสิ่งที่ต้องตามรอย
-- ═══════════════════════════════════════════════════════════════════════

create trigger checkins_audit
  after update or delete on checkins
  for each row execute function trg_audit();

create trigger checkin_edits_audit
  after update or delete on checkin_edits
  for each row execute function trg_audit();

-- delivery ก็เก็บด้วย — มีข้อมูลลูกค้าและใช้ยืนยันการส่งของ
create trigger delivery_points_audit
  after update or delete on delivery_points
  for each row execute function trg_audit();

comment on table audit_log is
  'ประวัติการแก้ไขทุกตารางที่สำคัญ · checkins/checkin_edits/delivery_points เก็บเฉพาะ UPDATE|DELETE
   (INSERT ไม่เก็บเพราะตัวแถวเองคือหลักฐาน และปริมาณสูงโดยไม่ได้ประโยชน์)';
