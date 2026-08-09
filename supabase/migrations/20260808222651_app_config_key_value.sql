-- ═══════════════════════════════════════════════════════════════════════
-- ที่เก็บค่าตั้งค่าเล็ก ๆ ของระบบ (แทน collection config บน Firestore)
-- ตอนนี้ใช้จดว่า "ล้างรูปส่งของรอบล่าสุดเมื่อไหร่"
--
-- ของเดิมจดไว้ที่ config/deliveryCleanup แล้วมีบั๊ก: ตอนเอกสารยังไม่มี
-- ไป addDoc สร้างเอกสารใหม่ที่ id สุ่ม ไม่ใช่ id เดิม → เช็คครั้งหน้าก็ยังไม่เจอ
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists app_config (
  key         text primary key,
  value       text not null default '',
  note        text not null default '',
  updated_at  timestamptz not null default now()
);

alter table app_config enable row level security;

drop policy if exists app_config_read on app_config;
create policy app_config_read on app_config
  for select to authenticated using (true);

drop policy if exists app_config_manage on app_config;
create policy app_config_manage on app_config
  for all to authenticated
  using (is_hr()) with check (is_hr());

drop trigger if exists app_config_updated_at on app_config;
create trigger app_config_updated_at before update on app_config
  for each row execute function set_updated_at();
