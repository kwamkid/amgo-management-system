-- ส่งต่อ session จากเบราว์เซอร์ที่ LINE ยิงกลับ → แอปที่ติดตั้ง (PWA)
-- แอป LINE ส่ง callback ให้ "เบราว์เซอร์หลัก" ไม่ใช่แอปที่กดล็อกอิน (Android=Chrome, iOS=Safari
-- ซึ่งคนละถังคุกกี้กับแอป) · หน้า verify ในเบราว์เซอร์จึงฝาก token ไว้ที่นี่ตาม nonce
-- ที่แอปฝังไว้ใน state ตอนเริ่ม แล้วแอปที่ยังเปิดอยู่มาหยิบไปแลกเป็น session เอง
-- อ่าน/เขียนด้วยสิทธิ์ระบบเท่านั้น · แถวหมดอายุใน 10 นาที ลบตอนหยิบและตอนฝากรอบถัดไป
-- (ลงบน production แล้ว 4 ก.ย. 69 ผ่าน MCP — ไฟล์นี้คือสำเนา)
create table if not exists public.auth_handoffs (
  nonce       text primary key,
  token_hash  text not null,
  next        text,
  created_at  timestamptz not null default now()
);

alter table public.auth_handoffs enable row level security;

comment on table public.auth_handoffs is
  'PWA login handoff: nonce (128-bit จาก state ของ LINE) → token_hash รอแอปมาหยิบ · หมดอายุ 10 นาที · service role เท่านั้น';
