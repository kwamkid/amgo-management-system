-- แจ้งเตือน SEO รอส่ง (เจ้าของ 9 ต.ค. 69: "อยากให้รวมเว็บ ๆ นึง ข้อความทีละเว็บ")
--
-- เดิม pingback ของ DataForSEO ยิง Discord ทันทีที่ผลคำนั้นกลับมา = 1 คำ 1 ข้อความ ไหลเป็นสิบ
-- ตอนนี้: เก็บ event ลงตารางนี้ก่อน → งาน seo.alerts.flush ในคิวรอผลชุดนั้นครบ แล้วส่งรวมทีละเว็บ

create table public.seo_alert_events (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  -- top10 | dropped | aio_cited | aio_lost | ai_cited | ai_lost
  kind text not null,
  -- คำค้น (อันดับ / Google AI) หรือคำถาม (AI อื่น)
  label text not null,
  from_pos int,
  to_pos int,
  -- AI ที่อ้าง/เลิกอ้าง (chatgpt / perplexity / gemini …) — null = อันดับหรือ Google AI
  engine text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index seo_alert_events_unsent on public.seo_alert_events (created_at) where sent_at is null;

alter table public.seo_alert_events enable row level security;
-- เขียนเฉพาะเซิร์ฟเวอร์ · เจ้าของอ่านได้
create policy seo_alert_events_owner on public.seo_alert_events
  for select to authenticated using ((select public.is_web_owner()));
