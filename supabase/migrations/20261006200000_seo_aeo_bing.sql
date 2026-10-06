-- SEO / AEO เฟส 3 — AI ตอบถึงเราไหม (ChatGPT · Perplexity · Gemini) + Bing + แจ้งเตือน
--
-- AEO: ถาม AI ด้วย "คำถามแบบที่ลูกค้าถามจริง" (ไม่ใช่คำค้นสั้น ๆ) ผ่าน DataForSEO
-- LLM Responses แล้วดูว่าคำตอบพูดถึงแบรนด์เรา / อ้างลิงก์เว็บเราไหม
-- เสียเงินต่อคำถามต่อ AI (~$0.006–0.04) → คำถามมีจำนวนน้อย เช็คสัปดาห์ละครั้ง
-- ใช้เพดานงบเดือนเดียวกับอันดับ (seo_settings.monthly_budget_usd)

-- ── คำถามที่จะถาม AI ─────────────────────────────────────────────────
create table public.seo_aeo_prompts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  prompt text not null,                        -- 'แนะนำร้านกระเช้าผลไม้ ส่งด่วนในกรุงเทพ'
  keyword_id uuid references public.seo_keywords(id) on delete set null,
  is_tracked boolean not null default true,
  created_at timestamptz not null default now(),
  unique (site_id, prompt)
);

-- ── คำตอบ (1 แถว / คำถาม / AI / วัน) ─────────────────────────────────
create table public.seo_aeo_results (
  id bigint generated always as identity primary key,
  prompt_id uuid not null references public.seo_aeo_prompts(id) on delete cascade,
  engine text not null check (engine in ('chatgpt', 'perplexity', 'gemini')),
  checked_on date not null,                    -- เวลาไทย
  mentioned boolean not null default false,    -- คำตอบเอ่ยชื่อแบรนด์/โดเมนเรา
  cited boolean not null default false,        -- ใส่ลิงก์เว็บเราเป็นที่มา
  sources jsonb,                               -- [{domain, title, url}] ที่ AI อ้าง
  answer text,                                 -- ตัดไว้ไม่เกิน ~6,000 ตัวอักษร
  model text,
  cost_usd numeric(10, 5),
  created_at timestamptz not null default now(),
  unique (prompt_id, engine, checked_on)
);
create index seo_aeo_results_prompt on public.seo_aeo_results (prompt_id, engine, checked_on desc);

-- ── Bing (Bing Webmaster API) — ยอดรวมรายวันต่อเว็บ ───────────────────
create table public.seo_bing_daily (
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  date date not null,
  clicks int not null default 0,
  impressions int not null default 0,
  primary key (site_id, date)
);

-- ── อันดับแบบเก็บหลายตัวอย่าง ─────────────────────────────────────────
-- Google เสิร์ฟผลหลายชุดสลับกัน (เคสจริง "กระเช้าผลไม้" 6 ต.ค. 69: ยิง 9 ครั้ง เจอเราอันดับ 4 แค่ 2 ครั้ง
-- อีก 7 ครั้งเป็นชุดที่ไม่มีเรา) → ค้นคำละหลายครั้ง เก็บอันดับดีสุด + จำนวนครั้งที่เจอ
alter table public.seo_rank_snapshots
  add column samples int not null default 1,   -- ค้นกี่ครั้ง
  add column hits int not null default 1;      -- เจอเราในกี่ครั้ง
update public.seo_rank_snapshots set hits = 0 where position is null;

-- ── ตั้งค่าเพิ่ม ──────────────────────────────────────────────────────
alter table public.seo_settings
  add column aeo_engines text[] not null default array['chatgpt', 'perplexity', 'gemini'],
  add column aeo_recheck_days int not null default 7 check (aeo_recheck_days between 1 and 60),
  add column alerts_enabled boolean not null default true,
  add column rank_samples int not null default 3 check (rank_samples between 1 and 5);

-- ── สิทธิ์ ────────────────────────────────────────────────────────────
alter table public.seo_aeo_prompts enable row level security;
alter table public.seo_aeo_results enable row level security;
alter table public.seo_bing_daily enable row level security;

create policy seo_aeo_prompts_owner on public.seo_aeo_prompts
  for all to authenticated using ((select public.is_web_owner())) with check ((select public.is_web_owner()));
create policy seo_aeo_results_owner on public.seo_aeo_results
  for select to authenticated using ((select public.is_web_owner()));
create policy seo_bing_daily_owner on public.seo_bing_daily
  for select to authenticated using ((select public.is_web_owner()));
