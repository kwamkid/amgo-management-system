-- มิว (Chanchira) — เปลี่ยนจาก employee เป็น marketing (ตัดสินใจ 2026-08-07)
-- ผล: ได้สิทธิ์ Influencer/Campaign เพิ่ม · ยังต้องเช็คอิน + WFH ได้เหมือนเดิม
update user_settings_plan
set set_role = 'marketing',
    note = 'WFH ได้ — role marketing (ดูแล Influencer/Campaign ร่วมกับพีช) ยังต้องเช็คอิน นับชั่วโมง/OT ปกติ'
where match_line_display_name = 'Chanchira';
