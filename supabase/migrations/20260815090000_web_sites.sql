-- ดูแลเว็บไซต์ลูกค้า (WordPress) — ย้ายจากระบบเดี่ยว aoo-student-website
-- (Neon + Drizzle → Supabase) ตามที่เจ้าของสั่ง 15 ส.ค. 69
--
-- ระบบเดิมเก็บ "ค่าโฮสต์+โดเมนรายปีของนักเรียน DIP" + ให้นักเรียนอัพสลิปเอง
-- ของใหม่เพิ่มฝั่ง "ดูแลเว็บ": วันหมดอายุ → เตือนล่วงหน้า · เช็คเว็บล่ม ·
-- อ่าน/อัปเดตปลั๊กอินผ่าน SSH (WP-CLI) · บันทึกงานที่ทำต่อเว็บ
--
-- ⚠️ เมนูนี้เป็นงานส่วนตัวของเจ้าของ ไม่ใช่งานบริษัท — สิทธิ์ไม่ผูกกับ role
-- แต่ใช้ตาราง web_owners (ตอนนี้มีคนเดียว) แอดมินคนอื่นก็ไม่เห็น
--
-- หน้านักเรียน (ค้นเว็บ + อัพสลิป) ไม่ยิง PostgREST ตรง — ผ่าน API ที่ใช้
-- service role ฝั่งเซิร์ฟเวอร์ ดังนั้น RLS ที่นี่ปิดตายสำหรับทุกคนที่ไม่ใช่เจ้าของ

-- ── ใครใช้เมนูนี้ได้ ─────────────────────────────────────────────────
create table public.web_owners (
  user_id uuid primary key references public.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

create or replace function public.is_web_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.web_owners where user_id = auth.uid());
$$;

-- ── คอร์ส = กลุ่มเว็บที่ใช้รอบบิลเดียวกัน ────────────────────────────
create table public.web_courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  period_start date,
  period_end date,
  hosting_amount numeric(10,2) not null default 2000,
  domain_amount numeric(10,2) not null default 600,
  created_at timestamptz not null default now()
);

-- ── เว็บไซต์ + เจ้าของเว็บ ───────────────────────────────────────────
create table public.web_sites (
  id uuid primary key default gen_random_uuid(),
  site_name text not null,
  is_active boolean not null default true,
  course_id uuid references public.web_courses(id) on delete set null,

  -- เจ้าของเว็บ (เดิมเรียก "นักเรียน")
  student_name text,
  student_contact text,

  -- โฮสต์/โดเมน
  hosting_provider text,                  -- Hostinger / SiteGround / ...
  hosting_account text,                   -- ชื่อบัญชี/แพ็กเกจที่เว็บนี้อยู่
  hosting_expires_at date,
  domain_self_registered boolean not null default false,
  domain_registrar text,
  domain_registered_at date,
  domain_expires_at date,
  ssl_expires_at date,

  -- ต่อ WordPress ผ่าน SSH (WP-CLI) — ว่างไว้ = ยังไม่ได้ตั้ง ปุ่มอัปเดตจะปิด
  wp_admin_url text,
  ssh_host text,
  ssh_port int not null default 22,
  ssh_user text,
  ssh_path text,                          -- โฟลเดอร์ที่ติดตั้ง WordPress
  wp_version text,
  plugins_checked_at timestamptz,

  -- ผลเช็คว่าเว็บล่มไหม (cron รายชั่วโมง)
  http_status int,
  response_ms int,
  last_checked_at timestamptz,
  last_up_at timestamptz,
  down_since timestamptz,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index web_sites_name_idx on public.web_sites (site_name);

-- ── บิล 1 รอบ (โฮสต์ + โดเมน) ────────────────────────────────────────
create table public.web_bills (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.web_sites(id) on delete cascade,
  course_id uuid references public.web_courses(id) on delete set null,
  year int not null,
  period_start date,
  period_end date,
  hosting_amount numeric(10,2) not null default 0,
  domain_amount numeric(10,2) not null default 0,
  bill_domain boolean not null default true,
  paid_scope text not null default 'none'
    check (paid_scope in ('none', 'hosting', 'hosting_domain')),
  status text not null default 'unpaid'
    check (status in ('unpaid', 'pending_review', 'paid', 'rejected')),
  renewed_registrar text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index web_bills_site_idx on public.web_bills (site_id);

-- ── สลิปที่เจ้าของเว็บอัพเข้ามา ───────────────────────────────────────
create table public.web_slips (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.web_bills(id) on delete cascade,
  site_id uuid not null references public.web_sites(id) on delete cascade,
  slip_image_url text not null,
  qr_raw text,
  read_ref text,                          -- transRef ใช้กันสลิปซ้ำ
  verify_result text not null default 'unreadable'
    check (verify_result in ('ok', 'duplicate', 'unreadable')),
  uploaded_at timestamptz not null default now()
);

create index web_slips_bill_idx on public.web_slips (bill_id);

-- ── บันทึกงานที่ทำกับเว็บ (พิมพ์เองก็ได้ ระบบลงให้ก็ได้) ─────────────
create table public.web_site_logs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.web_sites(id) on delete cascade,
  kind text not null default 'note'
    check (kind in ('note', 'plugin_update', 'core_update', 'backup', 'downtime', 'renewal')),
  message text not null default '',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index web_site_logs_site_idx on public.web_site_logs (site_id, created_at desc);

-- ── ปลั๊กอินของแต่ละเว็บ (snapshot ล่าสุดจาก wp plugin list) ──────────
create table public.web_plugins (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.web_sites(id) on delete cascade,
  slug text not null,
  name text not null default '',
  version text not null default '',
  new_version text,                       -- ไม่ว่าง = มีอัปเดตรอ
  status text not null default 'active',  -- active / inactive
  checked_at timestamptz not null default now(),
  unique (site_id, slug)
);

-- ── RLS: เจ้าของเมนูเท่านั้น ─────────────────────────────────────────
alter table public.web_owners enable row level security;
alter table public.web_courses enable row level security;
alter table public.web_sites enable row level security;
alter table public.web_bills enable row level security;
alter table public.web_slips enable row level security;
alter table public.web_site_logs enable row level security;
alter table public.web_plugins enable row level security;

-- รายชื่อเจ้าของ: อ่านได้เฉพาะตัวเอง (เมนูใช้เช็คว่าจะโชว์ไหม) แก้ไม่ได้จากแอป
create policy web_owners_self on public.web_owners
  for select to authenticated using (user_id = auth.uid());

create policy web_courses_owner on public.web_courses
  for all to authenticated using (public.is_web_owner()) with check (public.is_web_owner());
create policy web_sites_owner on public.web_sites
  for all to authenticated using (public.is_web_owner()) with check (public.is_web_owner());
create policy web_bills_owner on public.web_bills
  for all to authenticated using (public.is_web_owner()) with check (public.is_web_owner());
create policy web_slips_owner on public.web_slips
  for all to authenticated using (public.is_web_owner()) with check (public.is_web_owner());
create policy web_site_logs_owner on public.web_site_logs
  for all to authenticated using (public.is_web_owner()) with check (public.is_web_owner());
create policy web_plugins_owner on public.web_plugins
  for all to authenticated using (public.is_web_owner()) with check (public.is_web_owner());

-- ── ที่เก็บรูปสลิป — ไม่ public เพราะเป็นสลิปโอนเงิน ─────────────────
insert into storage.buckets (id, name, public)
values ('web-slips', 'web-slips', false)
on conflict (id) do nothing;

create policy web_slips_read on storage.objects
  for select to authenticated
  using (bucket_id = 'web-slips' and public.is_web_owner());
create policy web_slips_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'web-slips' and public.is_web_owner());
create policy web_slips_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'web-slips' and public.is_web_owner());

-- เจ้าของเมนูตอนนี้: ยุทธนา (แอม)
insert into public.web_owners (user_id)
values ('31e03073-e7c4-44bd-a473-e2fedc1b20e5')
on conflict do nothing;
