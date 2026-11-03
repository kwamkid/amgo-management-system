-- Dev tracker inside amgo (owner, 3 Nov 2569): one app = one project · UAT test cases a human
-- tester runs (kanban) · results with pictures. Bug reports + releases come later (owner: UAT first).
-- Users = amgo users. A person sees only the projects they were added to; admins see all.
-- Case numbers (`no`) are global and must stay unique: UAT-0002 … are quoted in commits and chats,
-- and the old aoocommerce numbers are moved here as they are (identity "by default" so the migration
-- script can insert them; the sequence is bumped past the highest moved number afterwards).

-- ── projects + members ───────────────────────────────────────────────────────
create table public.dev_projects (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'), -- = repo folder name, used by Claude's CLI
  name           text not null,
  production_url text,
  staging_url    text,
  is_active      boolean not null default true,
  created_by     uuid references public.users(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger dev_projects_updated_at before update on public.dev_projects
  for each row execute function public.set_updated_at();

create table public.dev_project_members (
  project_id uuid not null references public.dev_projects(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  role       text not null default 'tester' check (role in ('manager', 'tester', 'viewer')),
  added_by   uuid references public.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index on public.dev_project_members (user_id);

-- ── access helpers (security definer so policies don't recurse into members) ─
create or replace function public.dev_can_view(p_project_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.dev_project_members m
    where m.project_id = p_project_id and m.user_id = auth.uid());
$$;
create or replace function public.dev_can_test(p_project_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.dev_project_members m
    where m.project_id = p_project_id and m.user_id = auth.uid() and m.role in ('manager', 'tester'));
$$;
create or replace function public.dev_can_manage(p_project_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.dev_project_members m
    where m.project_id = p_project_id and m.user_id = auth.uid() and m.role = 'manager');
$$;
revoke execute on function public.dev_can_view(uuid), public.dev_can_test(uuid), public.dev_can_manage(uuid) from anon, public;
grant execute on function public.dev_can_view(uuid), public.dev_can_test(uuid), public.dev_can_manage(uuid) to authenticated;

alter table public.dev_projects enable row level security;
create policy dev_projects_read on public.dev_projects for select to authenticated
  using (public.dev_can_view(id));
create policy dev_projects_insert on public.dev_projects for insert to authenticated
  with check (public.is_admin());
create policy dev_projects_update on public.dev_projects for update to authenticated
  using (public.dev_can_manage(id)) with check (public.dev_can_manage(id));
create policy dev_projects_delete on public.dev_projects for delete to authenticated
  using (public.is_admin());

alter table public.dev_project_members enable row level security;
create policy dev_members_read on public.dev_project_members for select to authenticated
  using (public.dev_can_view(project_id));
create policy dev_members_write on public.dev_project_members for insert to authenticated
  with check (public.dev_can_manage(project_id));
create policy dev_members_update on public.dev_project_members for update to authenticated
  using (public.dev_can_manage(project_id)) with check (public.dev_can_manage(project_id));
create policy dev_members_delete on public.dev_project_members for delete to authenticated
  using (public.dev_can_manage(project_id));

-- The creator of a project manages it (admins create projects; they may not be the day-to-day manager)
create or replace function public.dev_project_creator_member()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.dev_project_members (project_id, user_id, role, added_by)
    values (new.id, new.created_by, 'manager', new.created_by)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger dev_projects_creator after insert on public.dev_projects
  for each row execute function public.dev_project_creator_member();

-- ── UAT cases ────────────────────────────────────────────────────────────────
create table public.dev_uat_cases (
  id          uuid primary key default gen_random_uuid(),
  no          bigint generated by default as identity unique,
  project_id  uuid not null references public.dev_projects(id) on delete cascade,
  title       text not null,
  module      text,
  priority    smallint not null default 2 check (priority in (1, 2, 3)),          -- 1 ด่วน · 2 ปกติ · 3 ไม่ด่วน
  environment text not null default 'production' check (environment in ('production', 'staging')),
  shop        text,
  login_as    text,
  menu_path   text,
  page_url    text,                                                                -- /path on the project's URL, or a full URL
  device      text not null default 'any' check (device in ('any', 'mobile', 'desktop')),
  preparation text,
  steps       jsonb not null default '[]'::jsonb,                                  -- [{action, expected?}]
  source      text,                                                                -- commit / chat that produced the case
  status      text not null default 'pending'
              check (status in ('pending', 'passed', 'failed', 'blocked', 'retest', 'closed')),
  round       integer not null default 1,
  fix_note    text,                                                                -- what was fixed before the retest
  sort_order  double precision,
  created_by  uuid references public.users(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.dev_uat_cases (project_id, status, sort_order);
create trigger dev_uat_cases_updated_at before update on public.dev_uat_cases
  for each row execute function public.set_updated_at();

alter table public.dev_uat_cases enable row level security;
create policy dev_uat_cases_read on public.dev_uat_cases for select to authenticated
  using (public.dev_can_view(project_id));
create policy dev_uat_cases_insert on public.dev_uat_cases for insert to authenticated
  with check (public.dev_can_manage(project_id));
-- testers may update too (reorder on the board) — the guard trigger limits them to sort_order
create policy dev_uat_cases_update on public.dev_uat_cases for update to authenticated
  using (public.dev_can_test(project_id)) with check (public.dev_can_test(project_id));
create policy dev_uat_cases_delete on public.dev_uat_cases for delete to authenticated
  using (public.dev_can_manage(project_id));

-- Testers: only sort_order. Managers: everything, except status is driven by results / retest / close.
create or replace function public.dev_uat_case_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then return new; end if; -- service role (bot API) — checked in code
  if current_setting('dev.apply_result', true) = '1' then return new; end if; -- status set by dev_uat_result_apply
  if not public.dev_can_manage(old.project_id)
     and (to_jsonb(new) - 'sort_order' - 'updated_at') <> (to_jsonb(old) - 'sort_order' - 'updated_at') then
    raise exception 'เฉพาะผู้จัดการโปรเจกต์แก้เคสได้ (ผู้เทสย้ายลำดับได้อย่างเดียว)';
  end if;
  if new.project_id <> old.project_id then
    raise exception 'ย้ายเคสข้ามโปรเจกต์ไม่ได้';
  end if;
  return new;
end;
$$;
create trigger dev_uat_cases_guard before update on public.dev_uat_cases
  for each row execute function public.dev_uat_case_guard();

-- ── results (history, never edited) ──────────────────────────────────────────
create table public.dev_uat_results (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.dev_uat_cases(id) on delete cascade,
  round       integer not null,
  tester_id   uuid references public.users(id) default auth.uid(),
  tester_name text,                                                                -- kept for moved rows without an amgo user
  result      text not null check (result in ('passed', 'failed', 'blocked')),
  failed_step integer,
  note        text,
  shots       jsonb not null default '[]'::jsonb,                                  -- storage paths in bucket dev-shots
  created_at  timestamptz not null default now()
);
create index on public.dev_uat_results (case_id, created_at desc);

create or replace function public.dev_case_project(p_case_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select project_id from public.dev_uat_cases where id = p_case_id; $$;
revoke execute on function public.dev_case_project(uuid) from anon, public;
grant execute on function public.dev_case_project(uuid) to authenticated;

alter table public.dev_uat_results enable row level security;
create policy dev_uat_results_read on public.dev_uat_results for select to authenticated
  using (public.dev_can_view(public.dev_case_project(case_id)));
create policy dev_uat_results_insert on public.dev_uat_results for insert to authenticated
  with check (public.dev_can_test(public.dev_case_project(case_id)) and tester_id = auth.uid());
-- no update / delete policies: a result is history

-- A new result sets the case status; failed/blocked need a note; a closed case takes no results
create or replace function public.dev_uat_result_apply()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare c record;
begin
  select status, round, steps into c from public.dev_uat_cases where id = new.case_id for update;
  if not found then raise exception 'ไม่พบเคสนี้'; end if;
  if c.status = 'closed' then raise exception 'เคสนี้ปิดแล้ว บันทึกผลเพิ่มไม่ได้'; end if;
  if new.result <> 'passed' and coalesce(btrim(new.note), '') = '' then
    raise exception 'ไม่ผ่าน/ติดขัด ต้องบอกว่าเจออะไร';
  end if;
  if jsonb_typeof(new.shots) <> 'array' or jsonb_array_length(new.shots) < 1 or jsonb_array_length(new.shots) > 8 then
    raise exception 'ต้องแนบรูปผลการเทส 1–8 รูป';
  end if;
  new.round := c.round;
  if new.tester_name is null and new.tester_id is not null then
    select coalesce(nickname, full_name) into new.tester_name from public.users where id = new.tester_id;
  end if;
  if new.failed_step is not null and (new.result = 'passed' or new.failed_step < 1
     or new.failed_step > jsonb_array_length(c.steps)) then
    new.failed_step := null;
  end if;
  perform set_config('dev.apply_result', '1', true);
  update public.dev_uat_cases set status = new.result where id = new.case_id;
  perform set_config('dev.apply_result', '0', true);
  return new;
end;
$$;
create trigger dev_uat_results_apply before insert on public.dev_uat_results
  for each row execute function public.dev_uat_result_apply();

-- ── pictures: private bucket, path <case id>/<file> ──────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dev-shots', 'dev-shots', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;
create policy "dev-shots read" on storage.objects for select to authenticated
  using (bucket_id = 'dev-shots'
         and public.dev_can_view(public.dev_case_project(((storage.foldername(name))[1])::uuid)));
create policy "dev-shots insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'dev-shots'
              and public.dev_can_test(public.dev_case_project(((storage.foldername(name))[1])::uuid)));

-- ── bot API: a 'dev' key for Claude's CLI (acts as the owner, dev endpoints only) ─
alter table public.bot_api_keys drop constraint if exists bot_api_keys_scope_check;
alter table public.bot_api_keys add constraint bot_api_keys_scope_check check (scope in ('superadmin', 'general', 'dev'));

-- ── menu flag: my_profile().has_dev_access ───────────────────────────────────
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
      or exists (select 1 from public.dev_project_members m where m.user_id = u.id)
  )
  from public.users u
  where u.id = auth.uid();
$function$;

-- ── migration helper: continue case numbers after the moved aoocommerce ones ─
create or replace function public.dev_bump_uat_sequence(p_min bigint)
returns void language sql security definer set search_path = ''
as $$ select setval(pg_get_serial_sequence('public.dev_uat_cases', 'no'),
                    greatest(p_min, coalesce((select max(no) from public.dev_uat_cases), 0)), true); $$;
revoke execute on function public.dev_bump_uat_sequence(bigint) from anon, public, authenticated;
