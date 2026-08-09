-- ═══════════════════════════════════════════════════════════════════════
-- 0004 — โดเมน Influencer/Marketing (แยกจาก HR แทบสมบูรณ์)
--
-- โดเมนนี้ข้อมูลน้อยที่สุด (influencers 9 · campaigns 6 · submissions 3)
-- และไม่เกี่ยวกับเงินเดือน → เหมาะเป็นตัวซ้อมย้ายก่อน HR (ดูหัวข้อ 7 ข้อ 1)
-- ═══════════════════════════════════════════════════════════════════════

-- ── brands / products ──────────────────────────────────────────────────
create table brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  logo_url    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table products (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete restrict,
  name        text not null,
  description text,
  image_url   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on products (brand_id);

-- ของเดิมเก็บ brandName ซ้ำไว้ใน products เพื่อโชว์ — ตอนนี้ JOIN เอาได้แล้ว
comment on table products is 'brandName เดิมตัดทิ้ง — JOIN brands เอา (ไม่ใช่เอกสารทางการ ชื่อเปลี่ยนตามได้)';

create trigger brands_updated_at   before update on brands
  for each row execute function set_updated_at();
create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

-- ── influencers ────────────────────────────────────────────────────────
create table influencers (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  nickname    text not null default '',
  phone       text not null default '',
  email       text not null default '',
  line_id     text,
  birth_date  date,

  province          text,
  shipping_address  text,
  notes             text,

  tier            text not null default 'nano'
                  check (tier in ('nano','micro','macro','mega')),
  total_followers integer not null default 0,

  is_active   boolean not null default true,
  deleted_at  timestamptz,

  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on influencers (tier) where deleted_at is null;

create trigger influencers_updated_at before update on influencers
  for each row execute function set_updated_at();

-- แตกจาก influencers.children[]
create table influencer_children (
  id            uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references influencers(id) on delete cascade,
  nickname      text not null default '',
  gender        text check (gender in ('male','female','other')),
  birth_date    date
);

create index on influencer_children (influencer_id);

-- แตกจาก influencers.socialChannels[]
create table social_channels (
  id             uuid primary key default gen_random_uuid(),
  influencer_id  uuid not null references influencers(id) on delete cascade,
  platform       text not null
                 check (platform in ('facebook','instagram','tiktok','lemon8',
                                     'website','youtube','twitter','others')),
  username       text not null default '',
  profile_url    text not null default '',
  follower_count integer not null default 0,
  is_verified    boolean not null default false,

  unique (influencer_id, platform, username)
);

create index on social_channels (influencer_id);

-- ── campaigns ──────────────────────────────────────────────────────────
create table campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text not null default '',
  brief_file_url text,
  tracking_url  text,

  budget        numeric(12,2),
  currency      text not null default 'THB' check (currency in ('THB','USD')),

  start_date    date not null,
  deadline      date not null,

  status        text not null default 'pending'
                check (status in ('pending','active','reviewing','revising','completed','cancelled')),

  created_by      uuid references users(id),
  created_by_name text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint deadline_after_start check (deadline >= start_date)
);

create index on campaigns (status);

create trigger campaigns_updated_at before update on campaigns
  for each row execute function set_updated_at();

-- แตกจาก campaigns.brands[] / campaigns.products[] (เดิมเป็น array ของ id
-- ที่ไม่มีอะไรการันตีว่า id นั้นมีจริง — ตอนนี้ได้ FK จริงแล้ว)
create table campaign_brands (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  brand_id    uuid not null references brands(id)    on delete restrict,
  primary key (campaign_id, brand_id)
);

create table campaign_products (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  product_id  uuid not null references products(id)  on delete restrict,
  primary key (campaign_id, product_id)
);

-- แตกจาก campaigns.influencers[]
create table campaign_influencers (
  campaign_id       uuid not null references campaigns(id)    on delete cascade,
  influencer_id     uuid not null references influencers(id)  on delete restrict,
  assigned_at       timestamptz not null default now(),
  submission_status text,
  submission_link   text,
  primary key (campaign_id, influencer_id)
);

create index on campaign_influencers (influencer_id);

-- ── submissions ────────────────────────────────────────────────────────
-- หมายเหตุ: แผนเดิมมีตาราง submission_reviews จาก submissions.reviews[]
-- แต่ตรวจข้อมูลจริงแล้ว "ไม่มี field reviews" เลย → ตัดทิ้ง ไม่สร้างตารางลม
create table submissions (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references campaigns(id)   on delete restrict,
  influencer_id uuid not null references influencers(id) on delete restrict,

  -- code ที่ influencer ใช้เข้าถึงโดยไม่ต้องล็อกอิน
  -- ⚠️ ของเดิม rule เป็น `allow read: if true` ทำให้ code หลุดหมด
  --    Phase 6 ต้องใช้ signed URL / token หมดอายุแทน ห้ามทำแบบเดิม
  code          text not null unique,

  status        text not null default 'pending'
                check (status in ('pending','submitted','revision','resubmitted','approved','cancelled')),
  is_draft      boolean not null default false,

  -- snapshot ชื่อ ณ ตอนส่ง
  campaign_name   text not null default '',
  influencer_name text not null default '',

  submitted_at  timestamptz,
  last_saved_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on submissions (campaign_id);
create index on submissions (influencer_id);
create index on submissions (code);

create trigger submissions_updated_at before update on submissions
  for each row execute function set_updated_at();

-- แตกจาก submissions.links[]
create table submitted_links (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  url           text not null,
  platform      text not null
                check (platform in ('facebook','instagram','tiktok','lemon8',
                                    'website','youtube','twitter','others')),
  added_at      timestamptz not null default now()
);

create index on submitted_links (submission_id);

alter table brands               enable row level security;
alter table products             enable row level security;
alter table influencers          enable row level security;
alter table influencer_children  enable row level security;
alter table social_channels      enable row level security;
alter table campaigns            enable row level security;
alter table campaign_brands      enable row level security;
alter table campaign_products    enable row level security;
alter table campaign_influencers enable row level security;
alter table submissions          enable row level security;
alter table submitted_links      enable row level security;
