-- API ให้เว็บ/ระบบอื่นดึงข้อมูล SEO / AEO ไปใช้ (เจ้าของขอ 17 ต.ค. 69)
-- กุญแจละใบ ผูกได้หลายเว็บ (site_ids ว่าง = ทุกเว็บ) · เก็บแค่ sha256 — ตัวกุญแจโชว์ครั้งเดียวตอนสร้าง
-- เรียกด้วย header  Authorization: Bearer amgo_seo_xxx  (หรือ x-api-key) → /api/seo/v1/...

create table public.seo_api_keys (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,                 -- ใช้ทำอะไร เช่น "dashboard ลูกค้า aDay Fresh"
  key_prefix   text not null,                 -- 12 ตัวแรก ไว้จำว่าใบไหน
  key_hash     text not null unique,          -- sha256 hex ของกุญแจเต็ม
  site_ids     uuid[],                        -- null = ทุกเว็บ
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

alter table public.seo_api_keys enable row level security;
create policy seo_api_keys_owner on public.seo_api_keys
  for select to authenticated using ((select public.is_web_owner()));
