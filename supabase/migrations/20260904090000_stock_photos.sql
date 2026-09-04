-- รูปสต็อก + หน้าร้านประจำวัน (เจ้าของสั่ง 4 ก.ย. 69)
--
-- PC บางคน (ตั้งค่ารายคน) ต้องถ่ายรูป "หน้าร้าน" และ "สต็อก" ทุกวัน กี่รูปก็ได้
-- ถ่ายตอนไหนก็ได้ระหว่างวัน — ไม่ผูกกับเช็คอิน เพราะตอนเช็คอินอาจยังอยู่หน้าประตู
-- ห้าง ไม่ถึงร้าน · ถ่ายไม่ครบทั้งสองอย่าง เช็คเอาท์ไม่ได้
--
-- เอาไว้ไล่ดูย้อนหลังว่าสาขาไหน ของหายตั้งแต่วันไหน ใครอยู่เวร — รูปบอกได้ว่า
-- "เปลี่ยนเมื่อไหร่" ไม่ได้บอกว่า "หายกี่ชิ้น" (เจ้าของรับทราบ) และคนรู้ว่า
-- มีรูปทุกวันก็ไม่กล้าขยับ

alter table users add column if not exists requires_stock_photos boolean not null default false;
comment on column users.requires_stock_photos is 'ต้องถ่ายรูปหน้าร้าน+สต็อกทุกวันก่อนเช็คเอาท์ (PC บางคน)';

create table stock_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  -- snapshot ชื่อตอนถ่าย (กติกาเดียวกับ checkins) — อ่านจริงทับด้วย getDisplayNames()
  user_name text not null default '',
  -- สาขาที่เช็คอินอยู่ตอนถ่าย — ไว้ไล่ดูรายสาขา
  location_id uuid references locations(id) on delete set null,
  location_name text not null default '',
  work_date date not null,
  kind text not null check (kind in ('storefront', 'stock')),
  -- path ใน bucket stock-photos (ไม่ใช่ URL — signed URL หมดอายุ)
  photo_path text not null,
  note text not null default '',
  taken_at timestamptz not null default now()
);

create index stock_photos_user_date_idx on stock_photos (user_id, work_date desc);
create index stock_photos_location_date_idx on stock_photos (location_id, work_date desc);

alter table stock_photos enable row level security;

create policy stock_photos_select on stock_photos
  for select to authenticated
  using (user_id = auth.uid() or can_view_all());

create policy stock_photos_insert_own on stock_photos
  for insert to authenticated
  with check (user_id = auth.uid());

-- ลบได้เฉพาะรูปของตัวเองในวันเดียวกัน (ถ่ายพลาด) — ย้อนหลังลบไม่ได้ เพราะเป็นหลักฐาน
create policy stock_photos_delete_own_today on stock_photos
  for delete to authenticated
  using (user_id = auth.uid() and work_date = (now() at time zone 'Asia/Bangkok')::date);

create policy stock_photos_manage on stock_photos
  for all to authenticated
  using (is_hr()) with check (is_hr());

-- ── bucket ──────────────────────────────────────────────────────────
-- แยก bucket จาก checkin-photos ให้ตั้งอายุเก็บต่างกันได้ — ตอนนี้ลบ 60 วันเท่า
-- เซลฟี่ตามที่เจ้าของสั่ง (cron cleanup-photos · ค่าคงที่ STOCK_RETENTION_DAYS)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stock-photos', 'stock-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "รูปสต็อก: อัปโหลดของตัวเอง" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'stock-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "รูปสต็อก: ดูของตัวเองหรือคนดูทั้งบริษัท" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'stock-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or can_view_all())
  );

create policy "รูปสต็อก: ลบได้เฉพาะ HR" on storage.objects
  for delete to authenticated
  using (bucket_id = 'stock-photos' and is_hr());
