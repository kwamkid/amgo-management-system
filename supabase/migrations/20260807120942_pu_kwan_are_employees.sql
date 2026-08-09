-- ═══════════════════════════════════════════════════════════════════════
-- ปู · ขวัญ = employee (ไม่ใช่ driver) — ตัดสินใจ 2026-08-07
--
-- เดิมถูกตั้งเป็น driver ใน Firestore เพื่อให้เห็นเมนูส่งของเท่านั้น
-- ตอนนี้ทุกคนดูแผนที่ได้แล้ว เหลือแค่ต้องการสิทธิ์ "ปักหมุด"
-- → คืนตำแหน่งจริงเป็น employee + ให้สิทธิ์ปักหมุดผ่าน user_permissions
--
-- driver ตัวจริงเหลือ 2 คน: ตูน · จําเนียร
-- ⚠️ ต้องบันทึกใน user_settings_plan ด้วย ไม่งั้นรัน migrate รอบหน้าจะทับ
--    กลับเป็น driver เพราะ Firestore ยังเก็บค่าเดิม
-- ═══════════════════════════════════════════════════════════════════════

insert into user_settings_plan
  (match_line_display_name, nickname, full_name_hint, set_role,
   wfh_eligible, requires_checkin, employment_type, note)
values
  ('oPuPuo', 'ปู', 'นางกัลยา สมบูรณ์วัฒนาโชค (ปู)', 'employee', null, null, 'monthly',
   'จริง ๆ เป็น employee — เดิมตั้ง driver เพื่อให้เห็นเมนูส่งของ · ให้สิทธิ์ปักหมุดแยกแทน'),
  ('kwan', 'ขวัญ', 'น.ส.พรวิวัฒน์ เครือพันธุ์ (kwan)', 'employee', null, null, 'monthly',
   'จริง ๆ เป็น employee — เดิมตั้ง driver เพื่อให้เห็นเมนูส่งของ · ให้สิทธิ์ปักหมุดแยกแทน')
on conflict (match_line_display_name) do update
  set set_role = excluded.set_role, note = excluded.note;

update users set role = 'employee'
where line_display_name in ('oPuPuo', 'kwan');

insert into user_permissions
  (user_id, resource, can_read_own, can_read_all, can_write_own, can_write_all, reason)
select u.id, 'delivery', true, true, true, false,
       'พนักงานที่ช่วยวิ่งส่งของด้วย — ปักหมุดได้เท่ากับ driver แต่ตำแหน่งจริงคือ employee'
from users u
where u.line_display_name in ('oPuPuo', 'kwan')
on conflict (user_id, resource) do update
  set can_write_own = true, reason = excluded.reason;
