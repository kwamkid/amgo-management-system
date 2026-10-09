-- สุขภาพเว็บ (เจ้าของ 9 ต.ค. 69: "อยากทำหมด เพื่อปรับปรุงเว็บ")
--
-- หน้าที่ติดตาม (seo_health_urls) = หน้าเป้าหมายของคำ + หน้าที่ได้คลิกมากสุดจาก GSC + หน้าแรก
-- แต่ละหน้าเช็คสัปดาห์ละครั้งผ่านคิวกลาง:
--   · Google index แล้วหรือยัง (GSC URL Inspection · ฟรี)
--   · ความเร็ว / Core Web Vitals (PageSpeed Insights · ฟรีเมื่อมี key)
-- เก็บแค่ผลล่าสุด + ประวัติความเร็วรายสัปดาห์ (ไว้ดูว่าแก้แล้วเร็วขึ้นไหม)

create table public.seo_health_urls (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  url text not null,
  source text not null default 'auto',          -- target (หน้าเป้าหมาย) · top (คลิกเยอะ) · home · manual
  -- index (URL Inspection)
  index_verdict text,                           -- PASS · NEUTRAL · FAIL
  index_state text,                             -- ข้อความจาก Google เช่น "ส่งและจัดทำดัชนีแล้ว"
  last_crawl_at timestamptz,
  google_canonical text,
  user_canonical text,
  robots_state text,
  fetch_state text,
  inspected_at timestamptz,
  -- ความเร็ว (PageSpeed มือถือ ครั้งล่าสุด)
  psi_score int,                                -- 0–100
  lcp_ms int,
  cls numeric(6, 3),
  tbt_ms int,
  inp_ms int,                                   -- จากผู้ใช้จริง (CrUX) ถ้ามี
  field_category text,                          -- FAST · AVERAGE · SLOW (ผู้ใช้จริง) ถ้ามี
  psi_at timestamptz,
  created_at timestamptz not null default now(),
  unique (site_id, url)
);

create table public.seo_psi_history (
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  url text not null,
  checked_on date not null,
  psi_score int,
  lcp_ms int,
  cls numeric(6, 3),
  tbt_ms int,
  primary key (site_id, url, checked_on)
);

alter table public.seo_health_urls enable row level security;
alter table public.seo_psi_history enable row level security;
create policy seo_health_urls_owner on public.seo_health_urls
  for select to authenticated using ((select public.is_web_owner()));
create policy seo_psi_history_owner on public.seo_psi_history
  for select to authenticated using ((select public.is_web_owner()));
