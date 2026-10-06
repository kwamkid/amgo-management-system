-- SEO / AEO เฟส 2 — อันดับคำเป้าหมายรายสัปดาห์ (DataForSEO SERP)
--
-- GSC บอกได้แค่คำที่เว็บเราโผล่แล้ว · ตารางชุดนี้ตอบอีกคำถาม: "คำที่เราอยากติด
-- ตอนนี้อยู่อันดับไหน คู่แข่งเป็นใคร หน้าผลลัพธ์มี AI Overview ไหม อ้างเราไหม"
-- สำคัญกับเว็บใหม่ (aoocommerce) ที่ GSC ยังเป็นศูนย์
--
-- เสียเงินทุกครั้งที่เช็ค → บันทึกค่าใช้จ่ายทุกคำขอใน seo_api_costs และหยุดเมื่อถึง
-- เพดานรายเดือน (seo_settings) · ผลดิบเก็บไว้ ห้ามดึงใหม่เพื่อแสดงผล
--
-- อันดับ "ไม่ติด 100 อันดับแรก" = position null ไม่ใช่ 0

-- ── หน้าเป้าหมายของเว็บ ───────────────────────────────────────────────
create table public.seo_pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  path text not null,                         -- '/features/chat'
  title text,
  target_intent text check (target_intent in ('commercial', 'transactional', 'informational', 'tool')),
  note text,
  created_at timestamptz not null default now(),
  unique (site_id, path)
);

-- ── คำเป้าหมาย ───────────────────────────────────────────────────────
create table public.seo_keywords (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  keyword text not null,
  group_name text,                            -- กลุ่มคำ เช่น 'สต๊อก' · 'แชท'
  search_volume int,                          -- ยอดค้นหา/เดือน ประเทศไทย
  target_page_id uuid references public.seo_pages(id) on delete set null,
  priority smallint not null default 2 check (priority between 1 and 3),  -- 1 = คำหลัก
  is_tracked boolean not null default true,   -- false = เก็บไว้เฉย ๆ ไม่เสียเงินเช็ค
  created_at timestamptz not null default now(),
  unique (site_id, keyword)
);

-- ── ผลอันดับ (1 แถว / คำ / รอบ) ──────────────────────────────────────
create table public.seo_rank_snapshots (
  id bigint generated always as identity primary key,
  keyword_id uuid not null references public.seo_keywords(id) on delete cascade,
  checked_on date not null,                   -- วันที่ได้ผล (เวลาไทย)
  position int,                               -- null = ไม่ติด 100 อันดับแรก
  ranked_url text,                            -- หน้าของเราที่ติด (อาจไม่ใช่หน้าเป้าหมาย)
  has_ai_overview boolean not null default false,
  ai_overview_cites_us boolean not null default false,
  ai_overview_refs jsonb,                     -- [{domain, url}] ที่ AI Overview อ้าง
  top_competitors jsonb,                      -- [{rank, domain, url, title}] 10 อันดับแรก
  device text not null default 'mobile',
  cost_usd numeric(10, 5),
  created_at timestamptz not null default now(),
  unique (keyword_id, checked_on, device)
);
create index seo_rank_snapshots_kw on public.seo_rank_snapshots (keyword_id, checked_on desc);

-- ── งานที่ส่ง DataForSEO แล้วรอผล (standard queue ถูกกว่า live ~3 เท่า) ──
create table public.seo_rank_tasks (
  task_id text primary key,                   -- id จาก DataForSEO
  keyword_id uuid not null references public.seo_keywords(id) on delete cascade,
  device text not null default 'mobile',
  posted_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  error text
);
create index seo_rank_tasks_pending on public.seo_rank_tasks (status) where status = 'pending';

-- ── ค่าใช้จ่าย API ────────────────────────────────────────────────────
create table public.seo_api_costs (
  id bigint generated always as identity primary key,
  provider text not null,                     -- 'dataforseo'
  endpoint text not null,
  units int not null default 1,
  cost_usd numeric(10, 5) not null,
  note text,
  created_at timestamptz not null default now()
);
create index seo_api_costs_created on public.seo_api_costs (created_at);

-- ── ตั้งค่า (แถวเดียว) ────────────────────────────────────────────────
create table public.seo_settings (
  id boolean primary key default true check (id),
  monthly_budget_usd numeric(10, 2) not null default 10,
  rank_device text not null default 'mobile' check (rank_device in ('mobile', 'desktop')),
  updated_at timestamptz not null default now()
);
insert into public.seo_settings (id) values (true);

-- ── สิทธิ์ ────────────────────────────────────────────────────────────
alter table public.seo_pages enable row level security;
alter table public.seo_keywords enable row level security;
alter table public.seo_rank_snapshots enable row level security;
alter table public.seo_rank_tasks enable row level security;
alter table public.seo_api_costs enable row level security;
alter table public.seo_settings enable row level security;

-- เจ้าของแก้หน้า/คำ/ตั้งค่าได้เอง · ผลอันดับ งาน และค่าใช้จ่าย เขียนเฉพาะเซิร์ฟเวอร์
create policy seo_pages_owner on public.seo_pages
  for all to authenticated using ((select public.is_web_owner())) with check ((select public.is_web_owner()));
create policy seo_keywords_owner on public.seo_keywords
  for all to authenticated using ((select public.is_web_owner())) with check ((select public.is_web_owner()));
create policy seo_settings_owner on public.seo_settings
  for all to authenticated using ((select public.is_web_owner())) with check ((select public.is_web_owner()));
create policy seo_rank_snapshots_owner on public.seo_rank_snapshots
  for select to authenticated using ((select public.is_web_owner()));
create policy seo_rank_tasks_owner on public.seo_rank_tasks
  for select to authenticated using ((select public.is_web_owner()));
create policy seo_api_costs_owner on public.seo_api_costs
  for select to authenticated using ((select public.is_web_owner()));
