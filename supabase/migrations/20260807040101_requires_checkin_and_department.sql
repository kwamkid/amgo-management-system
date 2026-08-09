-- ═══════════════════════════════════════════════════════════════════════
-- ใครต้องเช็คอิน + แผนก (ตัดสินใจ 2026-08-07)
--   · manager ขึ้นไปไม่ต้องเช็คอิน — แต่แก้ที่ระดับ role ได้ ไม่ต้อง deploy
--   · แผนกเป็นคุณสมบัติของ "คน" ไม่ใช่ "สถานที่"
--     ที่ผ่านมาเอาแผนกไปสร้างเป็น location ทำให้ geofence ทับกัน:
--       aDay Fresh = วังเด็ก (ห่าง 35m) · Paragon Toys zone = Paragon (ห่าง 190m)
--     ผลคือคนที่นั่นถูกบันทึกเป็น offsite ตลอด
-- ═══════════════════════════════════════════════════════════════════════

create table role_settings (
  role            text primary key
                  check (role in ('admin','hr','manager','employee','driver','marketing')),
  requires_checkin boolean not null default true,
  rank            smallint not null default 0,   -- ยิ่งมากยิ่งสูง ใช้เทียบ "ขึ้นไป"
  label_th        text not null,
  updated_by      uuid references users(id),
  updated_at      timestamptz not null default now()
);

create trigger role_settings_updated_at before update on role_settings
  for each row execute function set_updated_at();

insert into role_settings (role, requires_checkin, rank, label_th) values
  ('admin',     false, 40, 'ผู้ดูแลระบบ'),
  ('hr',        false, 30, 'ฝ่ายบุคคล'),
  ('manager',   false, 20, 'ผู้จัดการ'),
  ('marketing', true,  10, 'การตลาด'),
  ('driver',    true,  10, 'พนักงานขับรถ'),
  ('employee',  true,  10, 'พนักงาน');

comment on table role_settings is
  'manager ขึ้นไป (rank >= 20) ไม่ต้องเช็คอิน — แก้ค่าที่นี่ได้เลยไม่ต้องแก้โค้ด';

alter table users add column requires_checkin boolean;

comment on column users.requires_checkin is
  'null = ใช้ค่าจาก role_settings · true/false = บังคับเฉพาะคนนี้';

create table departments (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  note      text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table users add column department_id uuid references departments(id) on delete set null;
create index on users (department_id) where deleted_at is null;

comment on table departments is
  'แผนก เช่น ABC วังเด็ก / Paragon Toys zone / aDay Fresh — เดิมถูกสร้างเป็น location';

alter table role_settings enable row level security;
alter table departments   enable row level security;

create or replace function user_requires_checkin(p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    u.requires_checkin,      -- override รายคนชนะ
    rs.requires_checkin,     -- ไม่งั้นใช้ค่าของ role
    true                     -- ไม่รู้จัก role → ต้องเช็คอินไว้ก่อน
  )
  from public.users u
  left join public.role_settings rs on rs.role = u.role
  where u.id = p_user_id;
$$;
