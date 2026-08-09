-- ═══════════════════════════════════════════════════════════════════════
-- ลบ unique index กันเช็คอินซ้อน — ข้อมูลจริงพิสูจน์ว่าตั้งผิด
--
-- 90 วันล่าสุด: 38 คน-วัน (จาก 2,246) เช็คอินมากกว่า 1 รอบ สูงสุด 4 รอบ/วัน
-- ถ้าคงไว้ 38 แถวนี้จะ import ไม่เข้าตอน Phase 3
-- ═══════════════════════════════════════════════════════════════════════

drop index if exists checkins_one_open_per_day;

create index if not exists checkins_open_idx
  on checkins (user_id, work_date)
  where status <> 'completed';

comment on index checkins_open_idx is
  'เดิมเป็น unique index — ลบเพราะข้อมูลจริงเช็คอินได้หลายรอบต่อวัน (สูงสุด 4)';
