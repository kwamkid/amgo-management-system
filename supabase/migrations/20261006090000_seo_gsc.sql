-- SEO / AEO เฟส 1 — ผล Google Search Console รายวันของเว็บที่ทำ SEO ให้
--
-- เป้าหมายของเมนูนี้ไม่ใช่ทำ SEO แต่คือ "ดูผล" ว่างานที่ทำไป (ด้วย AI หรือคน)
-- ทำให้เว็บดีขึ้นหรือยัง — จึงเก็บตัวเลขรายวันย้อนหลังให้เทียบช่วงได้
--
-- เมนูส่วนตัวของเจ้าของเหมือน AOO Website — RLS ปล่อยเฉพาะ is_web_owner()
-- cron เขียนข้อมูลด้วย service role ฝั่งเซิร์ฟเวอร์
--
-- ⚠️ วันที่ทุกช่องในตาราง seo_gsc_* เป็นวันตามเวลา Pacific ตามที่ GSC คืนมา
--    ห้ามแปลงเป็นเวลาไทย ไม่งั้นตัวเลขเลื่อนไปวันข้าง ๆ

-- ── เว็บที่ติดตาม ──────────────────────────────────────────────────────
create table public.seo_sites (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,             -- aoocommerce.com (ไม่มี https:// ไม่มี www)
  display_name text not null,
  -- property ใน GSC: 'sc-domain:aoocommerce.com' หรือ 'https://www.x.com/' (URL-prefix)
  gsc_property text,
  bing_site_url text,                      -- เฟส 3
  -- ผูกกับเว็บที่ดูแลผ่าน SSH (เฟส 4) — null = ไม่ได้ดูแลผ่าน amgo
  web_site_id uuid references public.web_sites(id) on delete set null,
  is_active boolean not null default true,
  note text,

  -- service account เข้า property นี้ได้ไหม (เช็คตอนกดปุ่ม และทุกครั้งที่ดึง)
  gsc_access text not null default 'unknown' check (gsc_access in ('unknown', 'ok', 'denied')),
  gsc_checked_at timestamptz,

  -- สถานะการดึงข้อมูล
  synced_through date,                     -- วันล่าสุดที่มีข้อมูลแล้ว (Pacific)
  backfill_from date,                      -- วันเก่าสุดที่ดึงแล้ว (null = ยังไม่เริ่ม)
  backfill_done boolean not null default false,
  sync_locked_at timestamptz,              -- กันดึงซ้อน (cron + ปุ่มพร้อมกัน) · เกิน 2 นาที = ผี
  last_synced_at timestamptz,
  last_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── ยอดรวมทั้งเว็บรายวัน ──────────────────────────────────────────────
-- แยกจากตารางคำค้น เพราะ GSC ซ่อนคำค้นที่มีคนค้นน้อย (anonymized) —
-- รวมแถวคำค้นแล้วจะได้ต่ำกว่าของจริงเสมอ ตัวเลขรวมต้องมาจากตารางนี้
create table public.seo_gsc_totals (
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  date date not null,
  clicks int not null default 0,
  impressions int not null default 0,
  ctr real not null default 0,
  position real,                           -- อันดับเฉลี่ย (ยิ่งน้อยยิ่งดี)
  primary key (site_id, date)
);

-- ── คำค้น × หน้า รายวัน ───────────────────────────────────────────────
create table public.seo_gsc_daily (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  date date not null,
  query text not null,
  page text not null,                      -- URL เต็มตามที่ GSC คืนมา
  clicks int not null default 0,
  impressions int not null default 0,
  ctr real not null default 0,
  position real not null
);

-- กันแถวซ้ำ — ใช้ md5 เพราะ URL/คำค้นยาว ๆ ทำ index ตรง ๆ แล้วเกินขนาดแถวได้
create unique index seo_gsc_daily_uniq
  on public.seo_gsc_daily (site_id, date, md5(query), md5(page));
create index seo_gsc_daily_site_date on public.seo_gsc_daily (site_id, date);

-- ── สิทธิ์ ────────────────────────────────────────────────────────────
alter table public.seo_sites enable row level security;
alter table public.seo_gsc_totals enable row level security;
alter table public.seo_gsc_daily enable row level security;

create policy seo_sites_owner on public.seo_sites
  for all to authenticated using ((select public.is_web_owner())) with check ((select public.is_web_owner()));
-- ข้อมูล GSC เขียนได้เฉพาะ cron (service role) — ฝั่งแอปอ่านอย่างเดียว
create policy seo_gsc_totals_owner on public.seo_gsc_totals
  for select to authenticated using ((select public.is_web_owner()));
create policy seo_gsc_daily_owner on public.seo_gsc_daily
  for select to authenticated using ((select public.is_web_owner()));

-- ── เทียบ 2 ช่วงเวลา ต่อคำค้น หรือ ต่อหน้า ──────────────────────────
-- ใช้ตอบคำถามหลักของเมนู: "ช่วงนี้ดีขึ้นกว่าช่วงก่อนไหม คำไหนขึ้น คำไหนตก"
-- อันดับเฉลี่ยถ่วงด้วย impressions (วิธีเดียวกับที่หน้า GSC รวมหลายวัน)
-- first_seen = วันแรกที่ Google เคยโชว์เราด้วยคำนี้ — ใช้หา "คำใหม่"
-- security invoker → RLS ด้านบนคุมอยู่แล้ว คนที่ไม่ใช่เจ้าของได้แถวว่าง
create or replace function public.seo_gsc_compare(
  p_site uuid,
  p_dim text,               -- 'query' | 'page'
  p_from date,
  p_to date,
  p_prev_from date,
  p_prev_to date,
  p_limit int default 1000
)
returns table (
  key text,
  clicks bigint,
  impressions bigint,
  "position" numeric,
  prev_clicks bigint,
  prev_impressions bigint,
  prev_position numeric,
  first_seen date
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select case when p_dim = 'page' then d.page else d.query end as k,
           d.date, d.clicks, d.impressions, d.position
    from seo_gsc_daily d
    where d.site_id = p_site
  ),
  cur as (
    select k, sum(clicks) c, sum(impressions) i,
           sum(position * impressions) / nullif(sum(impressions), 0) p
    from base where date between p_from and p_to group by k
  ),
  prev as (
    select k, sum(clicks) c, sum(impressions) i,
           sum(position * impressions) / nullif(sum(impressions), 0) p
    from base where date between p_prev_from and p_prev_to group by k
  ),
  joined as (
    select coalesce(cur.k, prev.k) k,
           coalesce(cur.c, 0) c, coalesce(cur.i, 0) i, cur.p,
           coalesce(prev.c, 0) pc, coalesce(prev.i, 0) pi, prev.p pp
    from cur full join prev on prev.k = cur.k
    order by coalesce(cur.c, 0) desc, coalesce(cur.i, 0) desc, coalesce(prev.i, 0) desc
    limit p_limit
  ),
  -- สแกนประวัติรอบเดียว ไม่ใช่ subquery ต่อแถว (1000 แถว × ทั้งประวัติ = ช้ามาก)
  firsts as (
    select b.k, min(b.date) d from base b where b.k in (select k from joined) group by b.k
  )
  select j.k, j.c, j.i, round(j.p::numeric, 1), j.pc, j.pi, round(j.pp::numeric, 1), f.d
  from joined j left join firsts f on f.k = j.k
  order by j.c desc, j.i desc, j.pi desc;
$$;
