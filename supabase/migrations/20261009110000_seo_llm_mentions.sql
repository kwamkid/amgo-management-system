-- AI พูดถึงเราที่ไหนบ้าง (DataForSEO LLM Mentions) — เจ้าของ 9 ต.ค. 69 "อยากโฟกัสเรื่อง AI ตอบ"
--
-- ต่างจากแท็บ AI ตอบเดิม (เราตั้งคำถามเองแล้วถาม AI): ชุดนี้คือฐานข้อมูลคำตอบ AI ที่ DataForSEO เก็บไว้
-- → เห็นคำถามที่ AI อ้างเราอยู่แล้วโดยเราไม่ต้องเดา + เทียบคู่แข่ง + คำถามที่ AI อ้างคู่แข่งแต่ไม่อ้างเรา
-- ภาษาไทยตอนนี้มีเฉพาะ Google AI Overview (ทดสอบ 9 ต.ค. 69: adayfresh 321 · basketeer 148 · redribbin 35)
-- ราคา $0.10/ครั้ง + เล็กน้อยต่อแถว · ดึงเดือนละครั้ง + ปุ่มกดเอง (เจ้าของเลือก)

-- คู่แข่งที่ใช้เทียบ (โดเมน) — ว่าง = ระบบเลือกเองจากเว็บที่ติดอันดับคู่กับเราบ่อยสุด
alter table public.seo_sites add column competitors text[];

-- ภาพรวมแต่ละรอบ: กี่คำตอบที่อ้างเรา/คู่แข่ง
create table public.seo_llm_share (
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  fetched_on date not null,
  domain text not null,                       -- ของเรา หรือคู่แข่ง
  is_us boolean not null default false,
  platform text not null default 'all',       -- google · chat_gpt · all
  mentions int not null default 0,            -- จำนวนคำตอบ AI ที่อ้างโดเมนนี้
  ai_search_volume int not null default 0,    -- คนถาม AI คำถามเหล่านั้นรวมกันต่อเดือน
  primary key (site_id, fetched_on, domain, platform)
);

-- คำถามรายข้อ (แทนที่ทั้งชุดทุกรอบ)
create table public.seo_llm_questions (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  kind text not null check (kind in ('ours', 'gap')),  -- ours = อ้างเรา · gap = อ้างคู่แข่งแต่ไม่อ้างเรา
  question text not null,
  platform text,
  ai_search_volume int,
  sources text[],                             -- โดเมนที่ AI อ้างในคำตอบนั้น
  competitor text,                            -- gap: อ้างคู่แข่งเจ้าไหน
  first_seen timestamptz,
  last_seen timestamptz,
  fetched_on date not null
);
create index seo_llm_questions_site on public.seo_llm_questions (site_id, kind, ai_search_volume desc);

alter table public.seo_llm_share enable row level security;
alter table public.seo_llm_questions enable row level security;
create policy seo_llm_share_owner on public.seo_llm_share for select to authenticated using ((select public.is_web_owner()));
create policy seo_llm_questions_owner on public.seo_llm_questions for select to authenticated using ((select public.is_web_owner()));
