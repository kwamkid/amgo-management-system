-- Password vault (owner 5 Nov 2569): replaces the Google Sheet of shop logins. Each account
-- (e.g. Shopee abcthebaby) has its own list of who can view / edit / delete it.
--
-- * Secrets are one AES-256-GCM blob encrypted in the app with VAULT_SECRET_KEY (env, never in
--   the DB). Hashing is impossible here: staff need the real password back to log in.
-- * All tables have RLS on and NO policies, and browser roles have no grants: only
--   /api/vault (service role) touches them, after checking permissions and writing a log row.
-- * Vault owners are a separate list on purpose. Not role = admin (there is a second admin)
--   and not web_owners (still holds the deactivated Dev Admin).

create table public.vault_owners (
  user_id uuid primary key references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.vault_owners (user_id)
select id from public.users where id = '31e03073-e7c4-44bd-a473-e2fedc1b20e5';

create table public.vault_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null,                -- Shopee, Lazada, ... readable for the list
  name text not null,                    -- abcthebaby
  secret text not null,                  -- v1:<iv>:<tag>:<data>, see lib/services/vault/crypto.ts
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vault_access (
  account_id uuid not null references public.vault_accounts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  can_view boolean not null default true,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (account_id, user_id),
  -- editing and deleting both need the account open, so they include viewing
  constraint vault_access_view_first check (can_view or not (can_edit or can_delete))
);
create index vault_access_user_idx on public.vault_access (user_id);

-- Append-only audit log. No foreign keys: rows must outlive the account and the person.
create table public.vault_logs (
  id bigint generated always as identity primary key,
  account_id uuid,
  account_label text not null,
  user_id uuid not null,
  action text not null check (action in ('create', 'reveal', 'update', 'delete', 'access')),
  detail jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index vault_logs_account_idx on public.vault_logs (account_id, created_at desc);

create function public.vault_logs_no_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'vault_logs is append-only';
end $$;

create trigger vault_logs_append_only before update or delete on public.vault_logs
  for each row execute function public.vault_logs_no_change();

alter table public.vault_owners enable row level security;
alter table public.vault_accounts enable row level security;
alter table public.vault_access enable row level security;
alter table public.vault_logs enable row level security;

revoke all on public.vault_owners, public.vault_accounts, public.vault_access, public.vault_logs
  from anon, authenticated;

-- ── menu flag: my_profile().has_vault_access ────────────────────────────────
-- my_profile runs as the caller, who cannot read these tables, so this helper
-- answers yes/no about the caller only.
create function public.has_vault_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.vault_owners o where o.user_id = auth.uid())
      or exists (select 1 from public.vault_access a where a.user_id = auth.uid() and a.can_view);
$$;
revoke execute on function public.has_vault_access() from anon, public;
grant execute on function public.has_vault_access() to authenticated;

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
    'import_access', coalesce(
      (select jsonb_build_object('can_edit', a.can_edit, 'see_cost', a.see_cost)
       from public.import_access a where a.user_id = u.id),
      case when exists (select 1 from public.import_rounds) -- RLS: only rounds of the user's SRP brands
           then jsonb_build_object('can_edit', false, 'see_cost', false) end),
    'has_push', exists (select 1 from public.push_subscriptions p where p.user_id = u.id),
    'needs_day_off', public.is_six_day_worker(u.id) and public.weekly_off_days(u.id) <> 1,
    'has_dev_access', u.role = 'admin'
      or exists (select 1 from public.dev_project_members m where m.user_id = u.id),
    'has_vault_access', public.has_vault_access()
  )
  from public.users u
  where u.id = auth.uid();
$function$;
