-- ปลายทางแจ้ง "ลูกค้าให้ติดต่อกลับ" — ใช้กับ iOS Shortcut ที่ยิงเบอร์ลูกค้าเข้า Discord
--
-- ทำไมต้อง fix รายชื่อไว้ ไม่ดึงจาก user_allowed_locations:
-- ตารางนั้นคือ "สิทธิ์เช็คอิน" ไม่ใช่สังกัด — วังเด็กผูกไว้ทั้ง 42 คน (ทั้งบริษัท)
-- ถ้าดึงมา mention จะเรียกทั้งบริษัทมาโทรกลับลูกค้าคนเดียว
--
-- เก็บใน DB ไม่ฝังในโค้ด เพราะ Shortcut ดึงเมนูจาก API ตอนกด — เปลี่ยนคน
-- เพิ่ม/ลดสาขา แก้ที่นี่ที่เดียว ไม่ต้องแก้ Shortcut และไม่ต้อง deploy ใหม่

create table if not exists public.callback_targets (
  id uuid primary key default gen_random_uuid(),
  /** ข้อความที่โผล่ในเมนูบนมือถือ */
  label text not null,
  /** ผูกกับสาขาไว้เผื่ออนาคต — null ได้ เช่น "ออนไลน์" ที่ไม่ใช่สาขา */
  location_id uuid references public.locations(id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.callback_target_members (
  target_id uuid not null references public.callback_targets(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  primary key (target_id, user_id)
);

create index if not exists callback_targets_active_idx
  on public.callback_targets (is_active, sort_order);

alter table public.callback_targets enable row level security;
alter table public.callback_target_members enable row level security;

-- อ่าน/แก้ได้เฉพาะ hr/admin — ฝั่ง API ใช้ service key จึงไม่ติด RLS
create policy callback_targets_admin on public.callback_targets
  for all to authenticated using (is_hr()) with check (is_hr());

create policy callback_target_members_admin on public.callback_target_members
  for all to authenticated using (is_hr()) with check (is_hr());
