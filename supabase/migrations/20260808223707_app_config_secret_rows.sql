-- ═══════════════════════════════════════════════════════════════════════
-- ค่าตั้งค่าบางอย่างเป็นความลับ — เช่น Discord webhook URL
-- ใครถือ URL ก็ยิงข้อความเข้าห้องแชทบริษัทได้ทันทีโดยไม่ต้องยืนยันตัวตน
--
-- ของเดิมเก็บใน settings/discord ที่พนักงานทุกคนอ่านได้
-- ═══════════════════════════════════════════════════════════════════════

alter table app_config
  add column if not exists is_secret boolean not null default false;

drop policy if exists app_config_read on app_config;
create policy app_config_read on app_config
  for select to authenticated
  using (not is_secret or is_hr());

comment on column app_config.is_secret is
  'true = อ่านได้เฉพาะ hr/admin (เช่น webhook URL ที่ใครถือก็ยิงข้อความได้)';
