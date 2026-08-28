-- ประวัติการแก้ไขสินค้า SRP — เจ้าของขอ 29 ส.ค. 69 ("แก้อะไรไปบ้าง")
--
-- เดิมเก็บแค่ last_edited_by/last_edited_at บนตัวสินค้า = รู้แค่คนล่าสุด
-- ของเก่าถูกทับหายหมด · ตารางนี้เก็บทุกครั้งที่ค่าเปลี่ยน ทีละช่อง
--
-- เขียนด้วย trigger ไม่ใช่โค้ดฝั่งหน้าเว็บ เพราะเครื่องมือ "ทั้งแบรนด์"
-- (ตั้งตัวคูณ/ใช้ราคาแนะนำ/Platform +%) ยิง update ตรงเข้า DB ไม่ผ่านตัวเซฟปกติ
-- — ดักที่ชั้น DB ที่เดียวจบ ไม่มีทางหลุด และฝั่งหน้าเว็บปลอมประวัติไม่ได้
--
-- ⚠ ไฟล์นี้ถูก apply เข้า project odcrsmhutabsqhozpfhl แล้ว (version 20260829...)
--   เก็บไว้ให้ repo ตรงกับของจริง — db push จะข้ามให้เองเพราะ version ซ้ำ

create table public.srp_product_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.srp_products(id) on delete cascade,
  brand_id uuid not null references public.srp_brands(id) on delete cascade,
  -- ชื่อคอลัมน์จริงใน srp_products (หรือ 'created' ตอนเพิ่งเพิ่มสินค้า)
  field text not null,
  old_value text,
  new_value text,
  edited_by text not null default '',
  edited_by_id uuid,
  -- clock_timestamp ไม่ใช่ now(): เครื่องมือ "ทั้งแบรนด์" ยิง update ก้อนเดียว
  -- 114 แถวจะได้เวลาเท่ากันเป๊ะจนเรียงลำดับไม่ได้
  created_at timestamptz not null default clock_timestamp()
);

create index srp_product_history_product on public.srp_product_history (product_id, created_at desc);
create index srp_product_history_brand on public.srp_product_history (brand_id, created_at desc);

/**
 * เทียบค่าเก่า/ใหม่ทีละช่องแล้วบันทึกเฉพาะช่องที่เปลี่ยนจริง
 *
 * ช่องตัวเลขเทียบแบบตัวเลข (1590 กับ 1590.00 = ค่าเดียวกัน ไม่ต้องจด)
 * แล้วเก็บเป็นข้อความที่ตัดศูนย์ท้ายทิ้งแล้ว เอาไปโชว์ได้ตรง ๆ
 */
create or replace function public.srp_log_product_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  who text := coalesce(new.last_edited_by, '');
  f text;
  txt_fields text[] := array['name', 'category', 'sku', 'image_url', 'notes'];
  num_fields text[] := array[
    'fob_usd', 'fob_eur', 'freight_do', 'import_tax_pct', 'shipping_cost',
    'srp_usd', 'srp_eur', 'srp_sgd', 'multiplier', 'our_price_thb',
    'platform_price_thb', 'platform_markup_pct'
  ];
begin
  foreach f in array txt_fields loop
    if (o ->> f) is distinct from (n ->> f) then
      insert into public.srp_product_history
        (product_id, brand_id, field, old_value, new_value, edited_by, edited_by_id)
      values (new.id, new.brand_id, f, o ->> f, n ->> f, who, auth.uid());
    end if;
  end loop;

  foreach f in array num_fields loop
    if (o ->> f)::numeric is distinct from (n ->> f)::numeric then
      insert into public.srp_product_history
        (product_id, brand_id, field, old_value, new_value, edited_by, edited_by_id)
      values (
        new.id, new.brand_id, f,
        trim_scale((o ->> f)::numeric)::text,
        trim_scale((n ->> f)::numeric)::text,
        who, auth.uid()
      );
    end if;
  end loop;

  if old.is_active is distinct from new.is_active then
    insert into public.srp_product_history
      (product_id, brand_id, field, old_value, new_value, edited_by, edited_by_id)
    values (new.id, new.brand_id, 'is_active', old.is_active::text, new.is_active::text, who, auth.uid());
  end if;

  return new;
end $$;

/** สินค้าใหม่ = 1 บรรทัด บอกว่าเพิ่มเข้ามาเมื่อไหร่ โดยใคร */
create or replace function public.srp_log_product_created()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.srp_product_history
    (product_id, brand_id, field, old_value, new_value, edited_by, edited_by_id)
  values (new.id, new.brand_id, 'created', null, new.name, coalesce(new.last_edited_by, ''), auth.uid());
  return new;
end $$;

create trigger srp_products_history_update
  after update on public.srp_products
  for each row execute function public.srp_log_product_changes();

create trigger srp_products_history_insert
  after insert on public.srp_products
  for each row execute function public.srp_log_product_created();

-- อ่านได้เท่าที่เห็นแบรนด์นั้น · เขียนได้ทางเดียวคือผ่าน trigger (security definer)
-- ไม่มี policy insert/update/delete = ฝั่งหน้าเว็บแก้ประวัติไม่ได้เลย
alter table public.srp_product_history enable row level security;

create policy srp_history_read on public.srp_product_history
  for select to authenticated using (public.srp_role(brand_id) is not null);
