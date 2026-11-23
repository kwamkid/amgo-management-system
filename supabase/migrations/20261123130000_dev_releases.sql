-- Dev tracker: releases (owner 2026-11-23) — a round of work per project with a goal and dates; UAT cases and
-- bugs are dragged into it and the page shows progress (closed / total). Managers own releases; everyone in
-- the project can see them. A case/bug may sit in at most one release, of its own project.

create table public.dev_releases (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.dev_projects(id) on delete cascade,
  name        text not null check (btrim(name) <> ''),
  goal        text,
  start_date  date,
  target_date date,
  status      text not null default 'planned' check (status in ('planned', 'active', 'released')),
  released_at timestamptz,
  created_by  uuid references public.users(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (target_date is null or start_date is null or target_date >= start_date)
);
create index on public.dev_releases (project_id, status);
create trigger dev_releases_updated_at before update on public.dev_releases
  for each row execute function public.set_updated_at();

-- released_at follows status
create or replace function public.dev_release_stamp()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'released' then new.released_at := coalesce(new.released_at, now());
  else new.released_at := null;
  end if;
  return new;
end;
$$;
create trigger dev_releases_stamp before insert or update of status on public.dev_releases
  for each row execute function public.dev_release_stamp();

alter table public.dev_releases enable row level security;
create policy dev_releases_read on public.dev_releases for select to authenticated
  using (public.dev_can_view(project_id));
create policy dev_releases_insert on public.dev_releases for insert to authenticated
  with check (public.dev_can_manage(project_id));
create policy dev_releases_update on public.dev_releases for update to authenticated
  using (public.dev_can_manage(project_id)) with check (public.dev_can_manage(project_id));
create policy dev_releases_delete on public.dev_releases for delete to authenticated
  using (public.dev_can_manage(project_id));

-- ── cases + bugs join a release ──────────────────────────────────────────────
-- the existing guards already limit testers (UAT: sort_order only · bugs: own new bug's content), so only
-- managers (and the service role) can set release_id
alter table public.dev_uat_cases add column if not exists release_id uuid references public.dev_releases(id) on delete set null;
alter table public.dev_bugs add column if not exists release_id uuid references public.dev_releases(id) on delete set null;
create index on public.dev_uat_cases (release_id) where release_id is not null;
create index on public.dev_bugs (release_id) where release_id is not null;

create or replace function public.dev_release_same_project()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.release_id is not null
     and not exists (select 1 from public.dev_releases r where r.id = new.release_id and r.project_id = new.project_id) then
    raise exception 'รอบนี้เป็นของโปรเจกต์อื่น';
  end if;
  return new;
end;
$$;
create trigger dev_uat_cases_release before insert or update of release_id on public.dev_uat_cases
  for each row execute function public.dev_release_same_project();
create trigger dev_bugs_release before insert or update of release_id on public.dev_bugs
  for each row execute function public.dev_release_same_project();

-- ROLLBACK:
-- drop trigger if exists dev_uat_cases_release on public.dev_uat_cases; drop trigger if exists dev_bugs_release on public.dev_bugs;
-- alter table public.dev_uat_cases drop column if exists release_id; alter table public.dev_bugs drop column if exists release_id;
-- drop table if exists public.dev_releases;
-- drop function if exists public.dev_release_same_project(), public.dev_release_stamp();
