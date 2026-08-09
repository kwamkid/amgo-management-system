-- ═══════════════════════════════════════════════════════════════════════
-- 0005 — โดเมน Delivery (คนขับ)
--
-- deliveryPoints 3,466 แถว = collection ใหญ่อันดับ 2 รองจาก checkins
-- และกินพื้นที่ Storage มากที่สุด (6,907 ไฟล์ / 357.3 MB)
-- ═══════════════════════════════════════════════════════════════════════

create table delivery_routes (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references users(id) on delete restrict,
  driver_name text not null default '',       -- snapshot

  route_date  date not null,

  status      text not null default 'in-progress'
              check (status in ('in-progress','completed')),

  start_time  timestamptz,

  -- ของเดิมเก็บตัวเลขนับไว้ 3 ตัว (totalPoints/completedPoints/failedPoints)
  -- แล้วให้โค้ดคอยอัปเดตเอง — ย้ายมาแล้วนับจาก delivery_points ได้ตรง ๆ
  -- แต่คงไว้ก่อนเพื่อ import ข้อมูลเดิมให้ตรง แล้วค่อยเลิกใช้ทีหลัง
  total_points     integer not null default 0,
  completed_points integer not null default 0,
  failed_points    integer not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint counts_not_negative
    check (total_points >= 0 and completed_points >= 0 and failed_points >= 0)
);

create index on delivery_routes (driver_id, route_date desc);
create index on delivery_routes (route_date);

create trigger delivery_routes_updated_at before update on delivery_routes
  for each row execute function set_updated_at();

-- ── delivery_points ────────────────────────────────────────────────────
create table delivery_points (
  id          uuid primary key default gen_random_uuid(),
  route_id    uuid references delivery_routes(id) on delete set null,
  driver_id   uuid not null references users(id) on delete restrict,
  driver_name text not null default '',       -- snapshot

  delivery_type   text not null default 'delivery'
                  check (delivery_type in ('pickup','delivery')),
  delivery_status text not null default 'pending'
                  check (delivery_status in ('pending','completed','failed')),

  -- ตำแหน่ง
  address text not null default '',
  lat     double precision not null,
  lng     double precision not null,

  -- ลูกค้า (ของจริง null เกือบหมด)
  customer_name  text,
  customer_phone text,
  order_number   text,

  note text not null default '',

  check_in_time timestamptz,

  -- ── รูป ──
  -- แผนเดิมคิดว่าเป็น array (deliveryPoints.photos[]) เลยจะแตกเป็นตาราง
  -- delivery_photos แต่ข้อมูลจริงเป็น object เดี่ยว 1:1 → เก็บเป็นคอลัมน์เลย
  -- ง่ายกว่าและไม่ต้อง JOIN
  photo_url           text,
  photo_thumbnail_url text,
  photo_width         integer,
  photo_height        integer,
  photo_original_size integer,     -- byte ก่อนบีบ
  photo_compressed_size integer,   -- byte หลังบีบ
  photo_captured_at   timestamptz,
  photo_uploaded_at   timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on delivery_points (driver_id, created_at desc);
create index on delivery_points (route_id);
create index on delivery_points (delivery_status) where delivery_status = 'pending';
create index on delivery_points (created_at);

create trigger delivery_points_updated_at before update on delivery_points
  for each row execute function set_updated_at();

comment on column delivery_points.photo_url is
  'retention 60 วัน — cron ลบไฟล์ใน Storage แล้ว set คอลัมน์นี้เป็น null พร้อมกัน';
comment on table delivery_points is
  'ของเดิมไม่มี FK ไป route — ผูกด้วย driverId+วันที่เอาเอง Phase 3 ต้อง map ให้ถูก';

alter table delivery_routes enable row level security;
alter table delivery_points enable row level security;
-- ═══════════════════════════════════════════════════════════════════════
-- 0006 — settings + config รวมเป็น key-value เดียว
--
-- ของเดิมเป็น 2 collection (settings มี 1 doc ชื่อ 'discord', config ว่าง)
-- ทั้งคู่เก็บ object ก้อนเดียวที่ไม่เคย query เข้าไปข้างใน → jsonb พอ
-- ═══════════════════════════════════════════════════════════════════════

create table app_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_by  uuid references users(id),
  updated_at  timestamptz not null default now()
);

create trigger app_settings_updated_at before update on app_settings
  for each row execute function set_updated_at();

comment on table app_settings is
  'รวม collection settings + config เดิม — key เดิมคือ doc id (เช่น ''discord'')';

-- โครงของ settings/discord เดิม (ไว้อ้างอิงตอนเขียน migration script):
--   webhooks:      { checkIn, leave, hr, alerts, campaign }
--   notifications: { checkIn, checkOut, late, absent, overtime,
--                    leaveRequest, dailySummary, campaignUpdates }
--   dailySummaryTime: 'HH:mm'

alter table app_settings enable row level security;

-- ═══════════════════════════════════════════════════════════════════════
-- ตาราง mapping สำหรับ Phase 3 — เก็บคู่ id เดิม ↔ id ใหม่
--
-- จำเป็นเพราะ Firestore ใช้ doc id เป็น string (users = LINE user ID)
-- แต่ Postgres ใช้ uuid → ทุกตารางที่มี FK ต้องแปลงผ่านตารางนี้
-- และเพราะ script ต้องรันซ้ำได้ (idempotent) จึงต้องจำว่าแถวไหนย้ายไปแล้ว
--
-- เก็บไว้หลัง cutover ด้วย ใช้สืบย้อนตอนมีปัญหาว่าแถวนี้มาจาก doc ไหน
-- ═══════════════════════════════════════════════════════════════════════
create table migration_id_map (
  collection    text not null,       -- ชื่อ collection เดิม เช่น 'users'
  firestore_id  text not null,       -- doc id เดิม
  postgres_id   uuid not null,
  migrated_at   timestamptz not null default now(),
  primary key (collection, firestore_id)
);

create index on migration_id_map (collection, postgres_id);

alter table migration_id_map enable row level security;
