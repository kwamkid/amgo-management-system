-- ═══════════════════════════════════════════════════════════════════════
-- ตั้ง 4 คนเป็น manager (ตัดสินใจ 2026-08-07)
--   เฟื่อง · แป้งหมี่ · นุช · ยิ่ว
--
-- ผลตามมา: manager ไม่ต้องเช็คอินตาม role_settings อยู่แล้ว
-- → wfh_eligible ของ 3 คน (แป้งหมี่/นุช/ยิ่ว) ไม่มีความหมายอีก ลบทิ้งกันสับสน
-- → requires_checkin override ของเฟื่องก็ไม่ต้องแล้ว ได้จาก role แทน
-- ═══════════════════════════════════════════════════════════════════════

alter table user_settings_plan add column set_role text
  check (set_role in ('admin','hr','manager','employee','driver','marketing'));

update user_settings_plan
set set_role = 'manager', wfh_eligible = null, requires_checkin = null,
    note = 'ระดับ manager → ไม่ต้องเช็คอินตาม role_settings · ยกเลิก WFH เดิมเพราะไม่มีความหมายแล้ว'
where match_line_display_name in ('pangmee ✨', 'N ❤️', 'จิวยี่ 🪐🌟☀️');

update user_settings_plan
set set_role = 'manager', requires_checkin = null,
    note = 'ระดับ manager → ไม่ต้องเช็คอินตาม role_settings (เดิมตั้ง override ไว้ ตอนนี้ไม่ต้องแล้ว)'
where match_line_display_name = 'F。🍀';

update user_settings_plan
set set_role = 'employee',
    note = 'WFH ได้ — ยังต้องกดเช็คอิน (เช็คจากบ้านได้) นับชั่วโมง/OT ตามปกติ'
where match_line_display_name in ('Microphone🎙️', 'Chanchira', 'Mark31');
