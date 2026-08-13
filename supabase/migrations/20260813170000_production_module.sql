-- ระบบผลิต ADAY FRESH — สูตรน้ำ + เครื่องคิดส่วนผสม + บันทึกผลิตพร้อม yield
--
-- ออกแบบร่วมกับเจ้าของ 13 ส.ค. 69: เอาแค่ผลิต ไม่มีสต็อก/ต้นทุน/จัดซื้อ
-- (บทเรียนจาก joolz-factory เดิม — โมดูล FIFO ตายเพราะภาระกรอกสต็อก)
-- สูตรคิดต่อน้ำ 1 ลิตร · บันทึกของจริงที่ใช้ + ขวดที่ได้ → yield %
-- สิทธิ์: แอดมิน + ตำแหน่งพนักงานฝ่ายผลิตเท่านั้น (HR ไม่เห็น — เจ้าของสั่ง)

/** ตำแหน่งพนักงานฝ่ายผลิต — ใช้ gate เมนู/ตารางผลิต */
create or replace function is_production_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    join public.job_functions jf on jf.id = u.job_function_id
    where u.id = auth.uid() and jf.code = 'production' and u.is_active
  );
$$;

grant execute on function is_production_staff to authenticated;

-- ── สูตรน้ำ ──────────────────────────────────────────────────────────
create table public.production_recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ส่วนผสมต่อน้ำ 1 ลิตร · is_yield_base = วัตถุดิบหลักที่ใช้คิด yield (เช่น ส้ม)
create table public.production_recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.production_recipes(id) on delete cascade,
  name text not null,
  qty_per_liter numeric not null check (qty_per_liter > 0),
  unit text not null default 'g' check (unit in ('g', 'kg', 'ml', 'l', 'pcs')),
  is_yield_base boolean not null default false,
  sort_order integer not null default 0
);

create index production_recipe_items_recipe on public.production_recipe_items (recipe_id);

-- ── ขนาดขวด (ตั้งค่าได้ในหน้าสูตร) ─────────────────────────────────
create table public.production_bottle_sizes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  ml integer not null check (ml > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0
);

insert into public.production_bottle_sizes (label, ml, sort_order) values
  ('250 มล.', 250, 1),
  ('1 ลิตร', 1000, 2);

-- ── บันทึกการผลิต — snapshot ทุกอย่าง แก้สูตรทีหลังประวัติไม่เพี้ยน ──
create table public.production_batches (
  id uuid primary key default gen_random_uuid(),
  batch_date date not null,
  recipe_id uuid references public.production_recipes(id) on delete set null,
  recipe_name text not null,
  liters_planned numeric not null check (liters_planned > 0),
  output_ml integer not null default 0,   -- รวมจากขวดที่กรอกจริง
  yield_base_kg numeric,                  -- กก.วัตถุดิบหลักที่ใช้จริง (g แปลงเป็น kg แล้ว)
  yield_percent numeric,                  -- (output_ml/1000) / yield_base_kg × 100
  made_by uuid references public.users(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index production_batches_date on public.production_batches (batch_date desc);

create table public.production_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.production_batches(id) on delete cascade,
  name text not null,
  unit text not null,
  planned_qty numeric not null,
  actual_qty numeric not null,
  is_yield_base boolean not null default false,
  sort_order integer not null default 0
);

create index production_batch_items_batch on public.production_batch_items (batch_id);

create table public.production_batch_bottles (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.production_batches(id) on delete cascade,
  label text not null,
  ml integer not null,
  count integer not null check (count >= 0)
);

create index production_batch_bottles_batch on public.production_batch_bottles (batch_id);

-- ── RLS: แอดมิน + ฝ่ายผลิต · สูตร/ขวดแก้ได้เฉพาะแอดมิน ─────────────
do $$
declare t text;
begin
  foreach t in array array[
    'production_recipes', 'production_recipe_items', 'production_bottle_sizes',
    'production_batches', 'production_batch_items', 'production_batch_bottles'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I_read on public.%I for select to authenticated
       using (public.is_admin() or public.is_production_staff())', t, t);
  end loop;

  -- สูตรกับขนาดขวด: ฝ่ายผลิตอ่านอย่างเดียว
  foreach t in array array[
    'production_recipes', 'production_recipe_items', 'production_bottle_sizes'
  ]
  loop
    execute format(
      'create policy %I_manage on public.%I for all to authenticated
       using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;

  -- บันทึกผลิต: ฝ่ายผลิตกรอกเอง
  foreach t in array array[
    'production_batches', 'production_batch_items', 'production_batch_bottles'
  ]
  loop
    execute format(
      'create policy %I_write on public.%I for all to authenticated
       using (public.is_admin() or public.is_production_staff())
       with check (public.is_admin() or public.is_production_staff())', t, t);
  end loop;
end $$;
