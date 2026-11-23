-- Dev tracker: people added to EVERY new project automatically (owner 2026-11-23: "ใส่ไกด์ให้อัตโนมัติ").
-- Membership stays data, not code — edit this table to change who is added. The creator is still
-- added as manager by the same trigger (dev_project_creator_member).

create table if not exists public.dev_default_members (
  user_id    uuid primary key references public.users(id) on delete cascade,
  role       text not null default 'manager' check (role in ('manager', 'tester', 'viewer')),
  created_at timestamptz not null default now()
);

alter table public.dev_default_members enable row level security;
-- admins read/write; nobody else (the trigger runs as security definer)
create policy dev_default_members_admin on public.dev_default_members
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.dev_project_creator_member()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.dev_project_members (project_id, user_id, role, added_by)
    values (new.id, new.created_by, 'manager', new.created_by)
    on conflict do nothing;
  end if;
  insert into public.dev_project_members (project_id, user_id, role, added_by)
  select new.id, d.user_id, d.role, new.created_by
  from public.dev_default_members d
  on conflict do nothing;
  return new;
end;
$$;

-- ไกด์ (ศุภฤกษ์) — manager in every project since 2026-11-04
insert into public.dev_default_members (user_id, role)
values ('014039e4-1e95-4af0-ae7f-32649ad4c71a', 'manager')
on conflict (user_id) do nothing;

-- ROLLBACK: restore the creator-only body from 20261103100000_dev_tracker.sql, then
-- drop table if exists public.dev_default_members;
