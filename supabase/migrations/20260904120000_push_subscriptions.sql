-- Web Push: 1 แถวต่อเบราว์เซอร์/อุปกรณ์ที่กดเปิดแจ้งเตือน (unique ที่ endpoint)
-- เขียน/ลบผ่าน API ด้วยสิทธิ์ระบบ — เบราว์เซอร์อ่านของตัวเองได้อย่างเดียว
-- (ลงบน production แล้ว 4 ก.ย. 69 ผ่าน MCP — ไฟล์นี้คือสำเนา)
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (user_id = auth.uid());

comment on table public.push_subscriptions is
  'Web Push subscription ต่ออุปกรณ์ · เขียนผ่าน /api/push/subscribe เท่านั้น · endpoint ที่ตอบ 404/410 ถูกลบอัตโนมัติตอนส่ง';
