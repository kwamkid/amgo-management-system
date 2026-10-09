-- คนที่ AI ส่งเข้าเว็บ (เจ้าของขอ 9 ต.ค. 69: "ดูได้มั้ยว่ามีคนคลิกจากผลกี่คน")
--
-- นับจาก access log ของเว็บเอง (ไม่ใช่ GA4 — แบนเนอร์ PDPA ทำให้ GA4 นับได้แค่ ~25%)
-- เว็บ (mu-plugin ฝั่ง WordPress) สรุปรายวันแล้วส่งเข้า POST /api/seo/ai-referrals
-- 1 แถว / เว็บ / วัน / AI / หน้าที่เข้า · ส่งซ้ำวันเดิม = ทับค่าเดิม

create table public.seo_ai_referrals (
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  date date not null,                 -- วันตามเวลาไทย
  source text not null,               -- chatgpt | perplexity | gemini | copilot | claude
  path text not null,                 -- หน้าที่เข้า (ไม่มี query string) · "*" = ทั้งเว็บ (คนไม่ซ้ำต่อวัน)
  visits int not null default 0,      -- จำนวนครั้งที่เข้า
  people int not null default 0,      -- จำนวนคน (IP ไม่ซ้ำในวันนั้น)
  primary key (site_id, date, source, path)
);

create index seo_ai_referrals_site_date on public.seo_ai_referrals (site_id, date desc);

alter table public.seo_ai_referrals enable row level security;
-- เขียนเฉพาะเซิร์ฟเวอร์ · เจ้าของอ่านได้
create policy seo_ai_referrals_owner on public.seo_ai_referrals
  for select to authenticated using ((select public.is_web_owner()));
