-- SRP Calculator — ย้ายจากระบบเดี่ยว srp-calculator (Supabase ofwbuhlogviffqunfmde)
--
-- เจ้าของสั่ง 14 ส.ค. 69: เอาระบบ+ข้อมูลมาทั้งหมด · สิทธิ์แยกรายคน-รายแบรนด์
-- (viewer ดู · editor แก้ · แอดมินเห็นหมดและเป็นคนแจกสิทธิ์) · UI ใช้สไตล์ amgo
--
-- เครื่องคิดราคาขายปลีกสินค้านำเข้า: FOB (USD/EUR) + ค่าเรือ + ภาษีนำเข้า
-- → ต้นทุนรวม → ราคาแนะนำ (×ตัวคูณ ปัดเลขสวย) → margin + กำไรต่อช่องทางขาย
-- สมาชิก/invite ของระบบเก่าไม่ยกมา — ใช้ users ของ amgo แจกสิทธิ์ใหม่

-- ── แบรนด์ ───────────────────────────────────────────────────────────
create table public.srp_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  usd_to_thb numeric not null default 37,
  eur_to_thb numeric not null default 39,
  vat numeric not null default 7,
  default_multiplier numeric not null default 3,
  platform_markup_pct numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── สินค้า ───────────────────────────────────────────────────────────
create table public.srp_products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.srp_brands(id) on delete cascade,
  name text not null default '',
  category text not null default '',
  sku text not null default '',
  image_url text not null default '',
  fob_usd numeric not null default 0,
  fob_eur numeric not null default 0,
  freight_do numeric not null default 0,
  import_tax_pct numeric not null default 0,
  shipping_cost numeric not null default 0,
  srp_usd numeric not null default 0,
  srp_eur numeric not null default 0,
  multiplier numeric not null default 0,
  our_price_thb numeric not null default 0,
  platform_price_thb numeric not null default 0,
  notes text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  last_edited_by text not null default '',
  last_edited_at timestamptz,
  created_at timestamptz not null default now()
);

create index srp_products_brand on public.srp_products (brand_id);

-- ── ช่องทางขายต่อแบรนด์ (ห้าง GP/PC/DC · ออนไลน์ commission/ค่าส่ง) ──
create table public.srp_brand_channels (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.srp_brands(id) on delete cascade,
  type text not null check (type in ('offline', 'online')),
  name text not null,
  sort_order integer not null default 0,
  gp_pct numeric not null default 0,
  pc_pct numeric not null default 0,
  dc_pct numeric not null default 0,
  commission_pct numeric not null default 0,
  transaction_fee_pct numeric not null default 0,
  service_fee_pct numeric not null default 0,
  shipping_thb numeric not null default 0,
  promo_pct numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);

-- ── สิทธิ์รายคน-รายแบรนด์ ────────────────────────────────────────────
create table public.srp_brand_access (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.srp_brands(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('viewer', 'editor')),
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (brand_id, user_id)
);

create index srp_brand_access_user on public.srp_brand_access (user_id);

-- ── รูปสินค้า/โลโก้แบรนด์ — bucket สาธารณะแบบเดียวกับโลโก้บริษัท ─────
insert into storage.buckets (id, name, public)
values ('srp-images', 'srp-images', true)
on conflict (id) do update set public = true;

create policy "srp_images_read" on storage.objects
  for select using (bucket_id = 'srp-images');
create policy "srp_images_insert" on storage.objects
  for insert with check (bucket_id = 'srp-images' and public.is_admin());
create policy "srp_images_update" on storage.objects
  for update using (bucket_id = 'srp-images' and public.is_admin());
create policy "srp_images_delete" on storage.objects
  for delete using (bucket_id = 'srp-images' and public.is_admin());

-- ── RLS: แอดมินเห็น/แก้หมด · คนอื่นตามสิทธิ์รายแบรนด์ ────────────────
/** role ของผู้ใช้ปัจจุบันต่อแบรนด์ — 'editor' | 'viewer' | null (ไม่มีสิทธิ์) */
create or replace function public.srp_role(b_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when public.is_admin() then 'editor'
    else (select role from public.srp_brand_access
          where brand_id = b_id and user_id = auth.uid())
  end;
$$;

grant execute on function public.srp_role to authenticated;

do $$
declare t text;
begin
  foreach t in array array['srp_brands', 'srp_products', 'srp_brand_channels', 'srp_brand_access']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy srp_brands_read on public.srp_brands
  for select to authenticated using (public.srp_role(id) is not null);
create policy srp_brands_manage on public.srp_brands
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy srp_products_read on public.srp_products
  for select to authenticated using (public.srp_role(brand_id) is not null);
create policy srp_products_write on public.srp_products
  for all to authenticated
  using (public.srp_role(brand_id) = 'editor')
  with check (public.srp_role(brand_id) = 'editor');

create policy srp_channels_read on public.srp_brand_channels
  for select to authenticated using (public.srp_role(brand_id) is not null);
create policy srp_channels_write on public.srp_brand_channels
  for all to authenticated
  using (public.srp_role(brand_id) = 'editor')
  with check (public.srp_role(brand_id) = 'editor');

-- สิทธิ์: แอดมินจัดการ · เจ้าตัวเห็นของตัวเอง (ไว้เช็คว่าตัวเองมีเมนูไหม)
create policy srp_access_read on public.srp_brand_access
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
create policy srp_access_manage on public.srp_brand_access
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
