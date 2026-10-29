-- Import module (สั่งของนำเข้า) — brand order plans moved from the owner's local
-- order-plan page (AGD repo, 00-system/tools/order-plan) into amgo. 29 Oct 2026.
--
-- Owner: "มีแค่ผมที่เห็นเมนูนี้คนเดียวก่อน เดี๋ยวค่อยเปลี่ยน" → access is a grant
-- table (same pattern as web_owners) seeded with the owner only. Flags are there
-- for the roles that come later: purchasing edits qty, sales views without cost.
--
-- Field ownership with the local builder (build-*-plan.py): qty = web (amgo),
-- everything else = builder. qty_edited_* tells the builder which qty to keep.

-- ── 1) Who can see the module ────────────────────────────────────────────
create table public.import_access (
  user_id   uuid primary key references public.users(id) on delete cascade,
  can_edit  boolean not null default false,
  see_cost  boolean not null default false,
  added_at  timestamptz not null default now()
);
alter table public.import_access enable row level security;
create policy import_access_self on public.import_access
  for select using (user_id = (select auth.uid()));

insert into public.import_access (user_id, can_edit, see_cost)
values ('31e03073-e7c4-44bd-a473-e2fedc1b20e5', true, true);

create or replace function public.import_can_view()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from public.import_access where user_id = auth.uid()); $$;

create or replace function public.import_can_edit()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from public.import_access where user_id = auth.uid() and can_edit); $$;

-- ── 2) Rounds — one plan.json each ───────────────────────────────────────
-- Rounds sharing `container` are tabs on one page and share the container bar.
create table public.import_rounds (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,          -- folder name, e.g. C1-hape
  brand         text not null,
  sub           text not null default '',      -- sub-brand (J'adore) · '' = main brand
  srp_brand     text,                          -- brand name in SRP Calculator
  round         text not null,                 -- C1
  title         text not null default '',
  container     text,                          -- 2026-C1
  status        text not null default 'draft' check (status in ('draft', 'approved', 'sent')),
  currency      text not null default 'USD',
  fx            numeric,                       -- ฿ per currency unit
  incoterm      text,
  containers    jsonb not null default '{}',   -- {"20'": 30} planned CBM
  over_months   numeric,
  arrive        date,
  lead_months   numeric,
  notes         text,
  extra         jsonb not null default '{}',   -- other plan.json keys (pricing, template, sentFile …)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.users(id)
);
create index import_rounds_container_idx on public.import_rounds (container);

-- ── 3) Items ─────────────────────────────────────────────────────────────
create table public.import_round_items (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references public.import_rounds(id) on delete cascade,
  code           text not null,
  barcode        text,
  name           text not null default '',
  grp            text,                         -- plan.json "group" (category)
  sub            text,
  channel        text,
  tags           text[] not null default '{}', -- new | catalog
  remark         text,
  img            text,                         -- storage path in import-images, or a full URL (aoo / Shopee)
  fob            numeric,
  srp            numeric,                      -- brand SRP in round currency
  our_price      numeric,
  our_price_src  text,
  qty            integer not null default 0,   -- pcs · master = web
  suggested      integer,
  note           text,
  blocked        text,
  case_pack      integer,
  qty_pdq        integer,
  pdq_per_case   integer,
  pdq_dim        text,
  ctn            jsonb,                        -- {l, w, h} cm
  cbm            numeric,
  nw             numeric,
  gw             numeric,
  stock          numeric,
  incoming       numeric,
  avg            numeric,                      -- sold / month
  sort           integer not null default 0,
  qty_edited_at  timestamptz,
  qty_edited_by  uuid references public.users(id),
  updated_at     timestamptz not null default now(),
  unique (round_id, code)
);

alter table public.import_rounds enable row level security;
alter table public.import_round_items enable row level security;

create policy import_rounds_read on public.import_rounds
  for select using (public.import_can_view());
create policy import_rounds_write on public.import_rounds
  for update using (public.import_can_edit()) with check (public.import_can_edit());

create policy import_items_read on public.import_round_items
  for select using (public.import_can_view());
create policy import_items_write on public.import_round_items
  for update using (public.import_can_edit()) with check (public.import_can_edit());
-- insert/delete of rounds and items = sync from the builder (service role) only

-- Sent rounds are locked: the page must unlock (status → approved/draft) first.
create or replace function public.trg_import_item_guard()
returns trigger language plpgsql set search_path to ''
as $$
begin
  if (select auth.uid()) is null then return new; end if;  -- builder sync
  if exists (select 1 from public.import_rounds r where r.id = new.round_id and r.status = 'sent') then
    raise exception 'รอบนี้ส่งแล้ว ปลดล็อกก่อนแก้';
  end if;
  if new.qty is distinct from old.qty then
    new.qty_edited_at := now();
    new.qty_edited_by := (select auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger import_item_guard before update on public.import_round_items
  for each row execute function public.trg_import_item_guard();

create or replace function public.trg_import_round_touch()
returns trigger language plpgsql set search_path to ''
as $$
begin
  new.updated_at := now();
  if (select auth.uid()) is not null then new.updated_by := (select auth.uid()); end if;
  return new;
end;
$$;
create trigger import_round_touch before update on public.import_rounds
  for each row execute function public.trg_import_round_touch();

-- ── 4) Pictures — only items not found in aoocommerce ────────────────────
-- Keyed by brand + code (not round) so later rounds reuse them. webp, resized.
insert into storage.buckets (id, name, public) values ('import-images', 'import-images', false)
on conflict (id) do nothing;
create policy import_images_read on storage.objects
  for select using (bucket_id = 'import-images' and public.import_can_view());

-- ── 5) Profile flag for the menu ─────────────────────────────────────────
create or replace function public.my_profile()
 returns jsonb
 language sql
 stable
 set search_path to ''
as $function$
  select jsonb_build_object(
    'user', to_jsonb(u),
    'location_ids', coalesce(
      (select jsonb_agg(l.location_id) from public.user_allowed_locations l where l.user_id = u.id),
      '[]'::jsonb),
    'job_function', (
      select jsonb_build_object(
        'sees_delivery', jf.sees_delivery, 'code', jf.code, 'schedule_type', jf.schedule_type,
        'work_start_time', jf.work_start_time, 'work_end_time', jf.work_end_time)
      from public.job_functions jf where jf.id = u.job_function_id),
    'has_srp_access', u.role = 'admin'
      or exists (select 1 from public.srp_brand_access s where s.user_id = u.id),
    'has_web_access', exists (select 1 from public.web_owners w where w.user_id = u.id),
    'import_access', (
      select jsonb_build_object('can_edit', a.can_edit, 'see_cost', a.see_cost)
      from public.import_access a where a.user_id = u.id),
    'has_push', exists (select 1 from public.push_subscriptions p where p.user_id = u.id),
    'needs_day_off', public.is_six_day_worker(u.id) and public.weekly_off_days(u.id) <> 1
  )
  from public.users u
  where u.id = auth.uid();
$function$;
