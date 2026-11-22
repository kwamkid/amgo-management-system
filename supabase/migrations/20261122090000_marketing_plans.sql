-- Marketing plan & action plan per brand (owner 2026-11-21 · project/jobs/plans/marketing-plan.md)
-- brand = same slug as tasks.brand / AGD folder (hape · jadore · stokke …)
-- access: admin all · brand manager (srp_brand_access of that brand) read-write their brand · others none
-- action plan = ordinary tasks rows with plan_id + phase (so /tasks, Edith chase, Discord keep working)

-- srp_brands.name → slug ("Taf Toys" → taftoys · "J'adore" → jadore)
create or replace function public.brand_slug(p_name text)
returns text language sql immutable set search_path = ''
as $$ select regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]', '', 'g') $$;

/** brands the current user may plan · null = all (admin) */
create or replace function public.marketing_my_brands()
returns text[] language sql stable security definer set search_path = 'public'
as $$
  select case when public.is_admin() then null else coalesce(
    (select array_agg(distinct public.brand_slug(b.name))
       from public.srp_brand_access s join public.srp_brands b on b.id = s.brand_id
      where s.user_id = auth.uid()), '{}') end;
$$;

create or replace function public.marketing_can(p_brand text)
returns boolean language sql stable security definer set search_path = 'public'
as $$
  select public.is_admin() or exists (
    select 1 from public.srp_brand_access s join public.srp_brands b on b.id = s.brand_id
     where s.user_id = auth.uid() and public.brand_slug(b.name) = p_brand);
$$;

revoke all on function public.marketing_my_brands(), public.marketing_can(text) from public, anon;
grant execute on function public.marketing_my_brands(), public.marketing_can(text) to authenticated;

-- ── plans ──────────────────────────────────────────────────────────
create table public.marketing_plans (
  id          uuid primary key default gen_random_uuid(),
  brand       text not null check (brand = lower(brand) and length(brand) > 0),
  title       text not null check (length(trim(title)) > 0),
  start_date  date not null,
  end_date    date not null check (end_date >= start_date),
  status      text not null default 'draft' check (status in ('draft','active','done')),
  goal        text not null default '',
  budget      numeric(14,2),
  channels    text[] not null default '{}',
  -- [{ "date": "2026-12-12", "label": "12.12" }]
  key_dates   jsonb not null default '[]'::jsonb,
  -- phase keys + labels for the action plan, e.g. [{ "key": "P0", "label": "ก่อนเปิดตัว" }]
  phases      jsonb not null default '[{"key":"P0","label":"เตรียมก่อนเปิด"},{"key":"P1","label":"เปิดตัว"},{"key":"P2","label":"ต่อเนื่อง"}]'::jsonb,
  created_by  uuid references public.users(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.marketing_plans (brand, start_date desc);
create trigger marketing_plans_updated_at before update on public.marketing_plans
  for each row execute function set_updated_at();

-- ── targets (one per metric × channel) ─────────────────────────────
create table public.marketing_targets (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.marketing_plans(id) on delete cascade,
  metric      text not null check (metric in ('sales_thb','sales_pcs','followers','reach','views','posts','ad_spend','roas')),
  channel     text not null default 'all',
  target      numeric(14,2) not null check (target >= 0),
  source      text not null default 'auto' check (source in ('auto','manual')),
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (plan_id, metric, channel)
);

-- ── daily numbers (cache from aoocommerce / aoosocial sync · or typed in = manual) ──
create table public.marketing_metric_daily (
  brand      text not null,
  metric     text not null,
  channel    text not null default 'all',
  date       date not null,
  value      numeric(14,2) not null,
  source     text not null check (source in ('aoo','aoosocial','manual')),
  synced_at  timestamptz not null default now(),
  primary key (brand, metric, channel, date, source)
);

-- ── brand ↔ external ids (set once per brand by admin) ─────────────
create table public.marketing_brand_links (
  brand                 text primary key,
  aoosocial_company_id  text,
  aoosocial_account_ids text[] not null default '{}',
  aoo_brand_names       text[] not null default '{}',
  aoo_channel_ids       text[] not null default '{}',
  updated_at            timestamptz not null default now()
);

-- ── tasks link ─────────────────────────────────────────────────────
alter table public.tasks
  add column plan_id uuid references public.marketing_plans(id) on delete set null,
  add column phase text;
create index on public.tasks (plan_id) where plan_id is not null;

-- ── RLS ────────────────────────────────────────────────────────────
alter table public.marketing_plans enable row level security;
alter table public.marketing_targets enable row level security;
alter table public.marketing_metric_daily enable row level security;
alter table public.marketing_brand_links enable row level security;

create policy marketing_plans_rw on public.marketing_plans for all to authenticated
  using (public.marketing_can(brand)) with check (public.marketing_can(brand));

create policy marketing_targets_rw on public.marketing_targets for all to authenticated
  using (exists (select 1 from public.marketing_plans p where p.id = plan_id and public.marketing_can(p.brand)))
  with check (exists (select 1 from public.marketing_plans p where p.id = plan_id and public.marketing_can(p.brand)));

create policy marketing_metric_read on public.marketing_metric_daily for select to authenticated
  using (public.marketing_can(brand));
-- people type in only manual numbers; synced rows are written by the service role
create policy marketing_metric_manual on public.marketing_metric_daily for all to authenticated
  using (source = 'manual' and public.marketing_can(brand))
  with check (source = 'manual' and public.marketing_can(brand));

create policy marketing_links_read on public.marketing_brand_links for select to authenticated
  using (public.marketing_can(brand));
create policy marketing_links_admin on public.marketing_brand_links for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

comment on table public.marketing_plans is 'แผนการตลาดรายแบรนด์ — แอดมิน + brand manager ของแบรนด์นั้น';
comment on column public.tasks.plan_id is 'งานนี้เป็น action ของแผนการตลาดไหน (null = งานทั่วไป)';
comment on column public.tasks.phase is 'ช่วงของแผน (key ใน marketing_plans.phases เช่น P0)';
