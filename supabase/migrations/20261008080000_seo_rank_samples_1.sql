-- ค้นคำละ 1 ครั้งต่อรอบ (เดิม 3) — เจ้าของขอ 8 ต.ค. 69 "ไม่อยากเรียก API เยอะ เอาประวัติมาคิดด้วย"
-- ความมั่นใจว่าติดจริงมาจากประวัติ 4 รอบล่าสุด + GSC แทน (lib/services/seo/rankRules.ts rankConfidence)
-- คำที่ร่วงหนักยังถูกเช็คซ้ำวันถัดไปเหมือนเดิม
alter table public.seo_settings alter column rank_samples set default 1;
update public.seo_settings set rank_samples = 1;
