-- งาน / to-do ของทีม (ออกแบบกับเจ้าของ 27 ต.ค. 69)
--
-- ทำไมอยู่ใน amgo: พนักงานทุกคนมีแอปนี้อยู่แล้ว + ผูก Discord แล้ว 41/43 คน
-- แต่ละคนเห็นเฉพาะงานของตัวเอง · แอดมินเห็นทั้งหมด สร้าง/มอบหมาย/แก้ได้
-- พนักงานจดงานของตัวเองได้ (มอบให้ตัวเองเท่านั้น) และแก้/ลบงานที่ตัวเองสร้าง
-- งานหนึ่งมีผู้รับผิดชอบได้หลายคน (เช่น ABC A3 = ฝน + พีช)
--
-- brand เป็นข้อความ ไม่ผูก brands — ตาราง brands เป็นของระบบอินฟลูฯ มีไม่ครบ
-- ใช้ชื่อเดียวกับโฟลเดอร์ใน AGD (abcthebaby · hape · stokke …)
-- source_ref = แถวใน <brand>/_notes/todo.md เช่น '10-abcthebaby A3'
-- สคริปต์ sync ใน AGD (service role) upsert ด้วยคีย์นี้ · สถานะยึดที่ Supabase

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  notes       text not null default '',
  brand       text,
  source_ref  text unique,
  due_date    date,
  status      text not null default 'todo' check (status in ('todo','doing','done')),
  done_at     timestamptz,
  done_by     uuid references public.users(id),
  created_by  uuid references public.users(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on public.tasks (status, due_date);
create index on public.tasks (brand) where brand is not null;

create table public.task_assignees (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index on public.task_assignees (user_id);

comment on table public.tasks is
  'งานของทีม — คนในทีมเห็นเฉพาะงานที่ตัวเองสร้างหรือถูกมอบหมาย · แอดมินเห็นทั้งหมด';
comment on column public.tasks.source_ref is
  'คีย์ของแถวใน AGD todo.md (เช่น 10-abcthebaby A3) — สคริปต์ sync upsert ด้วยคีย์นี้';

/** ผู้ใช้ปัจจุบันถูกมอบหมายงานนี้ไหม — security definer กัน policy วนเรียกกันเอง */
create or replace function public.is_task_assignee(p_task_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.task_assignees
    where task_id = p_task_id and user_id = auth.uid()
  );
$$;

/** ผู้ใช้ปัจจุบันเป็นคนสร้างงานนี้ไหม — ใช้ใน policy ของ task_assignees */
create or replace function public.is_task_creator(p_task_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tasks
    where id = p_task_id and created_by = auth.uid()
  );
$$;

revoke execute on function public.is_task_assignee(uuid), public.is_task_creator(uuid)
  from anon, public;
grant execute on function public.is_task_assignee(uuid), public.is_task_creator(uuid)
  to authenticated;

-- ── trigger: updated_at · done_at/done_by · งานที่คนอื่นมอบให้ แก้ได้แค่สถานะกับโน้ต ──
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function set_updated_at();

create or replace function public.tasks_before_write()
returns trigger language plpgsql set search_path = ''
as $$
begin
  -- service role (cron / sync script) ไม่มี auth.uid() — ผ่านได้หมด
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_admin()
     and old.created_by is distinct from auth.uid() then
    if new.title      is distinct from old.title
    or new.brand      is distinct from old.brand
    or new.source_ref is distinct from old.source_ref
    or new.due_date   is distinct from old.due_date
    or new.created_by is distinct from old.created_by then
      raise exception 'แก้ได้เฉพาะสถานะและโน้ต — รายละเอียดงานแอดมินเป็นคนแก้';
    end if;
  end if;

  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.done_at := coalesce(new.done_at, now());
    new.done_by := coalesce(new.done_by, auth.uid());
  elsif new.status <> 'done' then
    new.done_at := null;
    new.done_by := null;
  end if;

  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;

-- created_by อยู่ในเงื่อนไขอ่านด้วย ไม่งั้น insert ... returning ของพนักงานพัง
-- (ตอน insert ยังไม่มีแถวใน task_assignees)
create policy tasks_read on public.tasks for select to authenticated
  using (public.is_admin() or created_by = auth.uid() or public.is_task_assignee(id));

create policy tasks_insert_own on public.tasks for insert to authenticated
  with check (created_by = auth.uid());

create policy tasks_update_own on public.tasks for update to authenticated
  using (created_by = auth.uid() or public.is_task_assignee(id))
  with check (created_by = auth.uid() or public.is_task_assignee(id));

create policy tasks_delete_own on public.tasks for delete to authenticated
  using (created_by = auth.uid());

create policy tasks_manage on public.tasks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- เห็นเพื่อนร่วมงานในงานเดียวกันได้ (งานที่มีหลายคน)
create policy task_assignees_read on public.task_assignees for select to authenticated
  using (public.is_admin() or public.is_task_assignee(task_id) or public.is_task_creator(task_id));

-- พนักงานมอบงานที่ตัวเองสร้างให้ตัวเองเท่านั้น — มอบคนอื่นเป็นงานของแอดมิน
create policy task_assignees_self on public.task_assignees for insert to authenticated
  with check (user_id = auth.uid() and public.is_task_creator(task_id));

create policy task_assignees_self_delete on public.task_assignees for delete to authenticated
  using (user_id = auth.uid() and public.is_task_creator(task_id));

create policy task_assignees_manage on public.task_assignees for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
