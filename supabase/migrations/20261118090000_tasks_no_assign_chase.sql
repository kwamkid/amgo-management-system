-- Tasks made easy + Edith (owner decisions 2026-11-18, project/jobs/plans/tasks-edith.md)
-- 1. Short task number #N (tasks.no) — staff reference tasks in Discord ("#57 เสร็จแล้ว")
-- 2. Anyone may assign the tasks they create to anyone (was: admin only, staff = self only)
-- 3. task_updates kind 'chase' — Edith asked the assignee about an overdue task (counts chases)

-- ── 1. tasks.no ─────────────────────────────────────────────────────
alter table public.tasks add column no integer;

-- oldest task = #1
update public.tasks t set no = s.rn
from (select id, row_number() over (order by created_at, id) as rn from public.tasks) s
where s.id = t.id;

create sequence public.tasks_no_seq owned by public.tasks.no;
select setval('public.tasks_no_seq', coalesce((select max(no) from public.tasks), 0) + 1, false);

alter table public.tasks
  alter column no set default nextval('public.tasks_no_seq'),
  alter column no set not null,
  add constraint tasks_no_key unique (no);

-- ── 2. assign anyone ────────────────────────────────────────────────
-- creator of a task may add/remove any assignee on it · an assignee may still remove themself
drop policy task_assignees_self on public.task_assignees;
create policy task_assignees_creator on public.task_assignees for insert to authenticated
  with check (public.is_task_creator(task_id));

drop policy task_assignees_self_delete on public.task_assignees;
create policy task_assignees_creator_delete on public.task_assignees for delete to authenticated
  using (public.is_task_creator(task_id) or user_id = auth.uid());

-- ── 3. chase kind ───────────────────────────────────────────────────
alter table public.task_updates drop constraint task_updates_kind_check;
alter table public.task_updates add constraint task_updates_kind_check
  check (kind in ('waiting','follow_up','appointment','note','due_change','chase'));

-- a chase is Edith asking, not progress → must not flip todo → doing (same body as 20261028014843 otherwise)
create or replace function public.task_updates_after_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.kind in ('due_change', 'chase') then
    return null;
  end if;
  if new.event_date is not null then
    perform public.task_set_due_silently(new.task_id, new.event_date, true);
  else
    update public.tasks set status = 'doing' where id = new.task_id and status = 'todo';
  end if;
  return null;
end;
$$;

-- the card's status line must not become "Edith asked" — skip chases like due_change
create or replace view public.task_status_line with (security_invoker = on) as
select distinct on (u.task_id)
  u.task_id,
  u.id as update_id,
  u.kind,
  u.waiting_for,
  u.waiting_on,
  u.body,
  u.event_date,
  u.event_time,
  u.created_by,
  u.created_at,
  (select count(*) from public.task_updates f
    where f.task_id = u.task_id and f.kind = 'follow_up'
      and f.created_at > coalesce(
        (select max(w.created_at) from public.task_updates w
          where w.task_id = u.task_id and w.kind = 'waiting'), '-infinity'))::int as follow_ups
from public.task_updates u
where u.kind not in ('due_change', 'chase')
order by u.task_id, u.created_at desc, u.id desc;
