-- เลื่อนวันครบกำหนดได้ แต่เก็บประวัติทุกครั้ง (เจ้าของขอ 28 ต.ค. 69)
-- ตัวอย่าง: "โทรหาพี่ตุ้มแล้ว รอนัดวันเข้าไปคุย" → เลื่อนวันพร้อมเหตุผล ไม่ต้องปล่อยให้แดงค้าง
--
-- เหตุผลส่งมาในคอลัมน์ due_change_reason ใน update เดียวกับที่เปลี่ยน due_date
-- trigger คัดลอกลง task_due_changes — ประวัติเขียนได้ทางเดียว แก้/ลบผ่าน API ไม่ได้
-- ผู้รับผิดชอบเลื่อนวันได้แล้ว (เดิมเฉพาะแอดมิน/คนสร้าง) เพราะทุกครั้งมีร่องรอย

alter table public.tasks add column due_change_reason text;
comment on column public.tasks.due_change_reason is
  'เหตุผลของการเลื่อนวันครั้งล่าสุด — ส่งมาพร้อม due_date ใหม่ · ประวัติเต็มอยู่ที่ task_due_changes';

create table public.task_due_changes (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  old_due     date,
  new_due     date,
  reason      text not null default '',
  changed_by  uuid references public.users(id),
  changed_at  timestamptz not null default now()
);

create index on public.task_due_changes (task_id, changed_at);

alter table public.task_due_changes enable row level security;
create policy task_due_changes_read on public.task_due_changes for select to authenticated using (true);

create or replace function public.tasks_log_due_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.task_due_changes (task_id, old_due, new_due, reason, changed_by)
  values (new.id, old.due_date, new.due_date, coalesce(new.due_change_reason, ''), auth.uid());
  return null;
end;
$$;

create trigger tasks_log_due_change
  after update of due_date on public.tasks
  for each row when (old.due_date is distinct from new.due_date)
  execute function public.tasks_log_due_change();

-- ผู้รับผิดชอบเลื่อนวันได้ — เอา due_date ออกจากรายการที่ล็อก
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
    or new.created_by is distinct from old.created_by then
      raise exception 'แก้ได้เฉพาะสถานะ วันครบกำหนด และโน้ต — รายละเอียดงานแอดมินเป็นคนแก้';
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
