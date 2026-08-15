-- ปลั๊กอินที่อัปเดตไม่ได้ซ้ำ ๆ — ส่วนใหญ่คือตัว pro ที่ license หมดอายุ
--
-- ระบบแยกไม่ออกว่า "license หมด" หรือ "เน็ตสะดุด" แต่แยกได้จากพฤติกรรม:
-- สั่งอัปเดตแล้วเวอร์ชันไม่ขยับติดกัน 2 ครั้ง = ไม่ใช่เรื่องบังเอิญ → เลิกพยายาม
--
-- ถ้าไม่ทำแบบนี้ เว็บที่มีปลั๊กอิน pro หมดอายุจะขึ้นเหลืองตลอดกาล
-- แล้วเจ้าของจะเลิกมองสีเหลืองไปเลย ของจริงที่ต้องอัปเดตก็จะกลืนหายไปด้วย
--
-- จำเป็นราย (เว็บ, ปลั๊กอิน) ไม่ใช่รายปลั๊กอินเฉย ๆ เพราะตัวเดียวกัน
-- อาจมี license บนเว็บหนึ่งแต่หมดอายุบนอีกเว็บ
--
-- แยกตารางจาก web_plugins เพราะ web_plugins ถูกลบทิ้งแล้วเขียนใหม่ทุกครั้งที่ตรวจ
-- ถ้าเก็บรวมกันตัวนับจะถูกล้างทุกรอบ จำอะไรไม่ได้เลย
create table if not exists public.web_plugin_blocks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.web_sites(id) on delete cascade,
  slug text not null,
  name text not null default '',
  fails integer not null default 0,
  last_error text,
  last_tried_at timestamptz,
  created_at timestamptz not null default now(),
  unique (site_id, slug)
);

comment on table public.web_plugin_blocks is
  'ปลั๊กอินที่อัปเดตไม่สำเร็จ นับครั้งไว้ ครบ 2 ครั้งแล้วงานอัปเดตรอบต่อไปจะข้าม';
comment on column public.web_plugin_blocks.fails is
  'พลาดติดกันกี่ครั้ง — 1 = ลองใหม่รอบหน้า · 2 ขึ้นไป = ข้าม ไม่นับเป็นของค้าง';

create index if not exists web_plugin_blocks_site on public.web_plugin_blocks(site_id);

alter table public.web_plugin_blocks enable row level security;
create policy web_plugin_blocks_owner on public.web_plugin_blocks
  for all to authenticated using (public.is_web_owner()) with check (public.is_web_owner());

-- จำนวนที่ต้องทำมือ เก็บไว้บนแถวเว็บเพื่อไม่ต้อง join ตอนโหลดตาราง 49 แถว
alter table public.web_sites add column if not exists blocked_plugin_count integer not null default 0;
comment on column public.web_sites.blocked_plugin_count is
  'ปลั๊กอินที่ระบบอัปเดตให้ไม่ได้ ต้องทำมือ (มักเป็นตัว pro ที่ license หมด)';

-- งานที่เจ้าของกดเองรายเว็บ = สั่งลองใหม่ ให้ล้างรายการที่เคยยอมแพ้ทิ้ง
-- เป็นทางกลับเข้าระบบหลังต่ออายุ license
alter table public.web_jobs add column if not exists force boolean not null default false;
comment on column public.web_jobs.force is
  'true = ผู้ใช้กดสั่งเว็บนี้เอง ให้ล้างสถานะ "ทำมือ" แล้วลองอัปเดตใหม่ทุกตัว';
