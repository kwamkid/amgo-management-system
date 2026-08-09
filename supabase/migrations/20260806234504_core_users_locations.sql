-- ═══════════════════════════════════════════════════════════════════════
-- 0001 — แกนหลัก: users, locations, shifts, invite_links
--
-- ทุกตารางเปิด RLS ไว้ตั้งแต่ต้นแต่ยังไม่ใส่ policy = deny ทั้งหมด
-- policy จริงเขียนใน Phase 6 (ตั้งใจให้เริ่มจาก deny แล้วเปิดทีละอัน
-- ไม่ใช่แปลง firestore.rules ตรง ๆ เพราะชุดเดิมมีช่องโหว่ 3 จุด)
-- migration script ใช้ secret key ซึ่ง bypass RLS อยู่แล้ว จึงไม่ติดขัด
-- ═══════════════════════════════════════════════════════════════════════

-- ── helper: อัปเดต updated_at อัตโนมัติ ────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── users ──────────────────────────────────────────────────────────────
-- id ผูกกับ auth.users (ตัวตนจาก LINE ผ่านกลไกที่ Phase 0 spike พิสูจน์แล้ว)
-- on delete restrict: ห้ามลบ auth user ทิ้งขณะที่ยังมีประวัติ check-in/ลา
-- อยู่ (ข้อมูลเงินเดือน) — เลิกจ้างให้ใช้ soft delete ผ่าน deleted_at
create table users (
  id            uuid primary key references auth.users(id) on delete restrict,
  line_user_id  text not null unique,

  -- ข้อมูลจาก LINE (อัปเดตทุกครั้งที่ล็อกอิน)
  line_display_name text not null default '',
  line_picture_url  text not null default '',

  -- ข้อมูลที่พนักงานกรอกเอง
  full_name     text not null,
  phone         text not null default '',
  birth_date    date,

  -- Discord (ยังไม่มีใครผูก 0/58 — เตรียมไว้ให้ linkIdentity() ของ Supabase)
  discord_user_id  text unique,
  discord_username text,

  -- สิทธิ์
  -- marketing มีคนใช้จริง 2 คนแต่ TS union เดิมไม่มี — ใส่ให้ครบตรงนี้
  -- manager ยังไม่มีใครใช้ แต่ rules/โค้ดอ้างถึง เก็บไว้ก่อน
  role          text not null default 'employee'
                check (role in ('admin','hr','manager','employee','driver','marketing')),

  is_active       boolean not null default true,
  needs_approval  boolean not null default false,

  allow_checkin_outside_location boolean not null default false,

  -- ที่มาของการสมัคร
  invite_link_id    uuid,
  invite_link_code  text,
  approved_by       uuid references users(id),
  approved_at       timestamptz,

  registered_at   timestamptz not null default now(),
  last_login_at   timestamptz,

  -- soft delete แทน collection deleted_users ทั้งก้อน
  deleted_at      timestamptz,
  deleted_by      uuid references users(id),
  deleted_by_name text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on users (line_user_id);
create index on users (role) where deleted_at is null;
create index on users (is_active) where deleted_at is null;

create trigger users_updated_at before update on users
  for each row execute function set_updated_at();

comment on column users.line_user_id is 'doc id เดิมของ Firestore — ใช้ทำ mapping ตอน Phase 3';
comment on column users.deleted_at   is 'แทน collection deleted_users + field isDeleted เดิม';

-- ── locations ──────────────────────────────────────────────────────────
create table locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text not null default '',

  lat         double precision not null,
  lng         double precision not null,
  radius      integer not null default 100,   -- เมตร

  break_hours numeric(4,2) not null default 0,

  -- 7 วัน × {open, close, isClosed} — ไม่เคย query เข้าไปข้างใน เก็บเป็น jsonb
  working_hours jsonb not null default '{}'::jsonb,

  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger locations_updated_at before update on locations
  for each row execute function set_updated_at();

-- ── shifts ─────────────────────────────────────────────────────────────
-- ของเดิมเป็น array ใน locations.shifts[] และ "ไม่มี id"
-- ({name, startTime, endTime, graceMinutes} เท่านั้น)
-- ส่วน checkins อ้างถึงกะด้วย "ชื่อ" ไม่ใช่ id (selectedShift = null ทุกแถว)
-- → unique (location_id, name) เพื่อให้ script Phase 3 จับคู่ด้วยชื่อได้
create table shifts (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id) on delete cascade,
  name          text not null,
  start_time    time not null,
  end_time      time not null,
  grace_minutes integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (location_id, name)
);

comment on table shifts is
  'แตกจาก locations.shifts[] — ของเดิมไม่มี id ต้อง match ด้วย (location_id, name) ตอน migrate';

-- ── user_allowed_locations ─────────────────────────────────────────────
-- แตกจาก users.allowedLocationIds[]
create table user_allowed_locations (
  user_id     uuid not null references users(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  primary key (user_id, location_id)
);

create index on user_allowed_locations (location_id);

-- ── invite_links ───────────────────────────────────────────────────────
create table invite_links (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  note          text not null default '',

  default_role  text not null default 'employee'
                check (default_role in ('admin','hr','manager','employee','driver','marketing')),
  allow_checkin_outside_location boolean not null default false,
  require_approval boolean not null default false,

  max_uses      integer,          -- null = ไม่จำกัด
  used_count    integer not null default 0,
  expires_at    timestamptz,      -- null = ไม่หมดอายุ
  is_active     boolean not null default true,

  created_by      uuid references users(id),
  created_by_name text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint used_not_exceed_max check (max_uses is null or used_count <= max_uses)
);

create index on invite_links (code) where is_active;

create trigger invite_links_updated_at before update on invite_links
  for each row execute function set_updated_at();

-- FK ย้อนกลับจาก users (ประกาศทีหลังเพราะ invite_links สร้างหลัง users)
alter table users
  add constraint users_invite_link_fk
  foreign key (invite_link_id) references invite_links(id) on delete set null;

-- ── RLS: เปิดไว้ทุกตาราง ยังไม่ใส่ policy = ปฏิเสธหมด ──────────────────
alter table users                  enable row level security;
alter table locations              enable row level security;
alter table shifts                 enable row level security;
alter table user_allowed_locations enable row level security;
alter table invite_links           enable row level security;
