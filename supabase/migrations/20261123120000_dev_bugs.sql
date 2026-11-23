-- Dev tracker: bug reports (owner 2026-11-23 — releases need bugs). Same projects/members/permissions as UAT.
-- Numbers are per project (BUG-0001 restarts in every project): dev_projects.bug_seq + a before-insert trigger.
-- Board: ใหม่ (new) · รับเรื่อง (accepted) · กำลังแก้ (fixing) · รอเทส (testing) · ปิดแล้ว (closed | wont_fix + reason).
-- Status changes go through dev_bug_set_status() (checks who may move what + writes history); a direct update of
-- status is blocked by the guard. History = dev_bug_events (created · status · assign), never edited.
-- Pictures: bucket dev-shots, path bugs/<project id>/<file> (uploaded before the bug exists).

alter table public.dev_projects add column if not exists bug_seq integer not null default 0;

create table public.dev_bugs (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.dev_projects(id) on delete cascade,
  no           integer not null,                                                     -- set by trigger, per project
  title        text not null check (btrim(title) <> ''),
  steps        text,                                                                 -- how to make it happen
  expected     text,
  actual       text,
  environment  text not null default 'production' check (environment in ('production', 'staging')),
  device       text not null default 'any' check (device in ('any', 'mobile', 'desktop')),
  page_url     text,
  severity     text not null default 'normal' check (severity in ('critical', 'high', 'normal', 'low')),
  status       text not null default 'new'
               check (status in ('new', 'accepted', 'fixing', 'testing', 'closed', 'wont_fix')),
  shots        jsonb not null default '[]'::jsonb,                                   -- paths in dev-shots
  reported_by  uuid references public.users(id) default auth.uid(),
  assignee_id  uuid references public.users(id) on delete set null,
  uat_case_id  uuid references public.dev_uat_cases(id) on delete set null,         -- reported from a failed UAT result
  fix_note     text,                                                                 -- what was fixed (shown to the tester)
  close_reason text,                                                                 -- wont_fix: why
  source       text,                                                                 -- chat / commit that reported it
  sort_order   double precision,
  closed_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_id, no)
);
create index on public.dev_bugs (project_id, status, sort_order);
create index on public.dev_bugs (uat_case_id) where uat_case_id is not null;
create trigger dev_bugs_updated_at before update on public.dev_bugs
  for each row execute function public.set_updated_at();

create table public.dev_bug_events (
  id          uuid primary key default gen_random_uuid(),
  bug_id      uuid not null references public.dev_bugs(id) on delete cascade,
  actor_id    uuid references public.users(id) on delete set null,
  actor_name  text,
  kind        text not null check (kind in ('created', 'status', 'assign')),
  from_status text,
  to_status   text,
  note        text,
  created_at  timestamptz not null default now()
);
create index on public.dev_bug_events (bug_id, created_at desc);

create or replace function public.dev_bug_project(p_bug_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select project_id from public.dev_bugs where id = p_bug_id; $$;
revoke execute on function public.dev_bug_project(uuid) from anon, public;
grant execute on function public.dev_bug_project(uuid) to authenticated;

create or replace function public.dev_person_name(p_user uuid)
returns text language sql stable security definer set search_path = ''
as $$ select coalesce(nickname, full_name) from public.users where id = p_user; $$;
revoke execute on function public.dev_person_name(uuid) from anon, public, authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.dev_bugs enable row level security;
create policy dev_bugs_read on public.dev_bugs for select to authenticated
  using (public.dev_can_view(project_id));
-- testers report bugs; the reporter is always the caller
create policy dev_bugs_insert on public.dev_bugs for insert to authenticated
  with check (public.dev_can_test(project_id) and reported_by = auth.uid());
-- testers may update too — the guard limits them (sort_order, or their own bug while it is still new)
create policy dev_bugs_update on public.dev_bugs for update to authenticated
  using (public.dev_can_test(project_id)) with check (public.dev_can_test(project_id));
create policy dev_bugs_delete on public.dev_bugs for delete to authenticated
  using (public.dev_can_manage(project_id));

alter table public.dev_bug_events enable row level security;
create policy dev_bug_events_read on public.dev_bug_events for select to authenticated
  using (public.dev_can_view(public.dev_bug_project(bug_id)));
-- no insert/update/delete policies: written by triggers and dev_bug_set_status only

-- ── number + created event ───────────────────────────────────────────────────
create or replace function public.dev_bug_number()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.dev_projects set bug_seq = bug_seq + 1 where id = new.project_id returning bug_seq into new.no;
  if new.no is null then raise exception 'ไม่พบโปรเจกต์'; end if;
  new.status := 'new';
  new.closed_at := null;
  return new;
end;
$$;
create trigger dev_bugs_number before insert on public.dev_bugs
  for each row execute function public.dev_bug_number();

create or replace function public.dev_bug_log()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare actor uuid := coalesce(auth.uid(), nullif(current_setting('dev.bug_actor', true), '')::uuid);
begin
  if tg_op = 'INSERT' then
    insert into public.dev_bug_events (bug_id, actor_id, actor_name, kind, to_status)
    values (new.id, coalesce(actor, new.reported_by), public.dev_person_name(coalesce(actor, new.reported_by)), 'created', new.status);
  elsif new.assignee_id is distinct from old.assignee_id then
    insert into public.dev_bug_events (bug_id, actor_id, actor_name, kind, note)
    values (new.id, actor, public.dev_person_name(actor), 'assign', public.dev_person_name(new.assignee_id));
  end if;
  return new;
end;
$$;
create trigger dev_bugs_log after insert or update of assignee_id on public.dev_bugs
  for each row execute function public.dev_bug_log();

-- ── guard: who may change what ───────────────────────────────────────────────
-- service role (bot API) is checked in code · status/close fields only through dev_bug_set_status ·
-- managers edit everything else · testers: sort_order, or the content of their own bug while it is new
create or replace function public.dev_bug_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  content_cols text[] := array['title', 'steps', 'expected', 'actual', 'environment', 'device', 'page_url', 'severity', 'shots'];
  changed jsonb := to_jsonb(new) - 'updated_at';
begin
  if new.project_id <> old.project_id or new.no <> old.no then
    raise exception 'ย้ายบั๊กข้ามโปรเจกต์หรือเปลี่ยนเลขไม่ได้';
  end if;
  if auth.uid() is null then return new; end if;
  if current_setting('dev.bug_status', true) = '1' then return new; end if;
  if (new.status, new.close_reason, new.closed_at) is distinct from (old.status, old.close_reason, old.closed_at) then
    raise exception 'เปลี่ยนสถานะบั๊กผ่าน dev_bug_set_status เท่านั้น';
  end if;
  if public.dev_can_manage(old.project_id) then return new; end if;
  -- tester
  if old.reported_by = auth.uid() and old.status = 'new' then
    if (changed - content_cols - 'sort_order') <> ((to_jsonb(old) - 'updated_at') - content_cols - 'sort_order') then
      raise exception 'แก้ได้เฉพาะรายละเอียดของบั๊กที่ตัวเองแจ้ง';
    end if;
    return new;
  end if;
  if (changed - 'sort_order') <> ((to_jsonb(old) - 'updated_at') - 'sort_order') then
    raise exception 'เฉพาะผู้จัดการโปรเจกต์แก้บั๊กได้ (ผู้เทสย้ายลำดับได้อย่างเดียว)';
  end if;
  return new;
end;
$$;
create trigger dev_bugs_guard before update on public.dev_bugs
  for each row execute function public.dev_bug_guard();

-- ── status changes (+ history) ───────────────────────────────────────────────
-- managers: any move · testers: only a bug waiting for a test (testing) → closed (fixed) or → fixing (still there, note required)
-- testing: p_note = what was fixed (fix_note) · wont_fix: p_note = reason (required)
-- service role (bot API, auth.uid() null) passes p_actor; its permission is checked in botDev.ts
create or replace function public.dev_bug_set_status(
  p_bug_id uuid, p_status text, p_note text default null, p_sort_order double precision default null, p_actor uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  b record;
  actor uuid := auth.uid();
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_status not in ('new', 'accepted', 'fixing', 'testing', 'closed', 'wont_fix') then
    raise exception 'สถานะไม่ถูกต้อง';
  end if;
  select id, project_id, status into b from public.dev_bugs where id = p_bug_id for update;
  if not found then raise exception 'ไม่พบบั๊กนี้'; end if;
  if actor is null then
    actor := p_actor; -- service role
  elsif not public.dev_can_manage(b.project_id) then
    if not public.dev_can_test(b.project_id) then raise exception 'คุณดูได้อย่างเดียวในโปรเจกต์นี้'; end if;
    if b.status <> 'testing' or p_status not in ('closed', 'fixing') then
      raise exception 'ผู้เทสย้ายได้เฉพาะบั๊กที่รอเทส (ไปปิดแล้ว หรือกลับไปกำลังแก้)';
    end if;
  end if;
  if p_status = 'wont_fix' and note is null then raise exception 'ไม่แก้ ต้องบอกเหตุผล'; end if;
  if p_status = 'fixing' and b.status = 'testing' and note is null then raise exception 'ยังไม่หาย ต้องบอกว่าเจออะไร'; end if;

  perform set_config('dev.bug_status', '1', true);
  update public.dev_bugs set
    status = p_status,
    sort_order = coalesce(p_sort_order, sort_order),
    fix_note = case when p_status = 'testing' and note is not null then note else fix_note end,
    close_reason = case when p_status = 'wont_fix' then note else null end,
    closed_at = case when p_status in ('closed', 'wont_fix') then coalesce(closed_at, now()) else null end
  where id = p_bug_id;
  perform set_config('dev.bug_status', '0', true);

  if p_status <> b.status or note is not null then
    insert into public.dev_bug_events (bug_id, actor_id, actor_name, kind, from_status, to_status, note)
    values (p_bug_id, actor, public.dev_person_name(actor), 'status', b.status, p_status, note);
  end if;
end;
$$;
revoke execute on function public.dev_bug_set_status(uuid, text, text, double precision, uuid) from anon, public;
grant execute on function public.dev_bug_set_status(uuid, text, text, double precision, uuid) to authenticated, service_role;

-- ── pictures: bugs/<project id>/<file> in dev-shots ──────────────────────────
-- The UAT policies cast the first folder to uuid; 'bugs' would raise "invalid input syntax for type uuid"
-- (OR'ed policies are not evaluated in a fixed order), so they are recreated with the cast guarded.
create or replace function public.dev_shot_folder(p_name text, p_index int)
returns uuid language sql stable set search_path = ''
as $$
  select case when (storage.foldername(p_name))[p_index] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then ((storage.foldername(p_name))[p_index])::uuid end;
$$;
drop policy if exists "dev-shots read" on storage.objects;
drop policy if exists "dev-shots insert" on storage.objects;
create policy "dev-shots read" on storage.objects for select to authenticated
  using (bucket_id = 'dev-shots'
         and public.dev_can_view(public.dev_case_project(public.dev_shot_folder(name, 1))));
create policy "dev-shots insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'dev-shots'
              and public.dev_can_test(public.dev_case_project(public.dev_shot_folder(name, 1))));
create policy "dev-shots bug read" on storage.objects for select to authenticated
  using (bucket_id = 'dev-shots' and (storage.foldername(name))[1] = 'bugs'
         and public.dev_can_view(public.dev_shot_folder(name, 2)));
create policy "dev-shots bug insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'dev-shots' and (storage.foldername(name))[1] = 'bugs'
              and public.dev_can_test(public.dev_shot_folder(name, 2)));

-- ROLLBACK:
-- drop policy if exists "dev-shots bug read" on storage.objects; drop policy if exists "dev-shots bug insert" on storage.objects;
-- drop function if exists public.dev_bug_set_status(uuid, text, text, double precision, uuid);
-- drop table if exists public.dev_bug_events; drop table if exists public.dev_bugs;
-- drop function if exists public.dev_bug_guard(), public.dev_bug_log(), public.dev_bug_number(), public.dev_bug_project(uuid), public.dev_person_name(uuid);
-- alter table public.dev_projects drop column if exists bug_seq;
-- (the recreated "dev-shots read/insert" policies behave the same as before for UAT paths; keep them and dev_shot_folder)
