-- ไทม์ไลน์ความคืบหน้าของงาน (ออกแบบกับเจ้าของ 28 ต.ค. 69)
--
-- งานส่วนใหญ่ "ติดอยู่ที่อีกฝ่าย" — ถามผู้รับเหมาแล้วรอคำตอบ · รอใบเสนอราคา · รออีเมล
-- ไม่มีวันนัดจริง มีแค่ "ถ้ายังเงียบ จะตามอีกทีวันไหน" → บันทึกเป็นรายการในไทม์ไลน์
--   waiting      ⏳ รอเขา — รออะไร (waiting_for) · รอใคร (waiting_on) · ตามอีกทีวันที่ (บังคับ)
--   follow_up    ตามแล้ว ยังรออยู่ — ต่อจาก waiting ล่าสุด · วันตามครั้งใหม่ (บังคับ)
--   appointment  📅 นัดหมาย — วันนัด (บังคับ) · เวลา
--   note         📝 อัปเดต/ผลลัพธ์ — วันขั้นถัดไปใส่หรือไม่ก็ได้
--   due_change   เลื่อนวันจากช่องครบกำหนดตรง ๆ (แทน task_due_changes เดิม) — trigger เขียนเอง
--
-- รายการที่มีวัน → วันครบกำหนดของงานเปลี่ยนเป็นวันนั้นทันที (เก็บ old_due/new_due ไว้)
-- รายการแรกของงาน → สถานะ "ต้องทำ" กลายเป็น "กำลังทำ" · ไม่ปิดงานให้เอง
-- แก้/ลบของตัวเองได้ภายใน 24 ชม. (แอดมินได้ตลอด)
--   · แก้วัน/ประเภทได้เฉพาะรายการล่าสุด → วันครบกำหนดตามไปด้วย
--   · ลบรายการล่าสุด → วันครบกำหนดกลับเป็นวันก่อนบันทึก
-- เปลี่ยน due_date จาก trigger ของตารางนี้ตั้ง amgo.skip_due_log ไว้ ไม่ให้ซ้ำเป็น due_change อีกแถว

create table public.task_updates (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  kind         text not null check (kind in ('waiting','follow_up','appointment','note','due_change')),
  waiting_for  text,
  waiting_on   text,
  body         text not null default '',
  event_date   date,
  event_time   time,
  old_due      date,
  new_due      date,
  created_by   uuid references public.users(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (kind not in ('waiting','follow_up','appointment') or event_date is not null)
);

create index on public.task_updates (task_id, created_at);

comment on table public.task_updates is
  'ไทม์ไลน์ความคืบหน้าของงาน — รอเขา/ตามแล้ว/นัด/อัปเดต/เลื่อนวัน · รายการที่มีวันเปลี่ยนวันครบกำหนดของงาน';

/** เปลี่ยน due_date โดยไม่ให้ trigger เลื่อนวันเขียนประวัติซ้ำ */
create or replace function public.task_set_due_silently(p_task_id uuid, p_due date, p_start boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('amgo.skip_due_log', 'on', true);
  update public.tasks
     set due_date = p_due,
         status   = case when p_start and status = 'todo' then 'doing' else status end
   where id = p_task_id;
  perform set_config('amgo.skip_due_log', 'off', true);
end;
$$;

revoke execute on function public.task_set_due_silently(uuid, date, boolean) from anon, authenticated, public;

/** รายการนี้ยังเป็นรายการล่าสุดของงานไหม */
create or replace function public.task_update_is_latest(p_id uuid, p_task_id uuid, p_created_at timestamptz)
returns boolean language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.task_updates
    where task_id = p_task_id and id <> p_id
      and (created_at > p_created_at or (created_at = p_created_at and id > p_id))
  );
$$;

create or replace function public.task_updates_before_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  w record;
begin
  if new.kind = 'due_change' then
    return new; -- เขียนโดย trigger ของ tasks · old_due/new_due ส่งมาแล้ว
  end if;

  if new.kind = 'follow_up' and (new.waiting_for is null or new.waiting_on is null) then
    select waiting_for, waiting_on into w
      from public.task_updates
     where task_id = new.task_id and kind in ('waiting','follow_up')
     order by created_at desc limit 1;
    new.waiting_for := coalesce(new.waiting_for, w.waiting_for);
    new.waiting_on  := coalesce(new.waiting_on, w.waiting_on);
  end if;

  if new.event_date is not null then
    select due_date into new.old_due from public.tasks where id = new.task_id;
    new.new_due := new.event_date;
  else
    new.old_due := null;
    new.new_due := null;
  end if;
  return new;
end;
$$;

create or replace function public.task_updates_after_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.kind = 'due_change' then
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

create or replace function public.task_updates_before_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.task_id is distinct from old.task_id or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'แก้งานต้นทาง/คนบันทึก/เวลาบันทึกไม่ได้';
  end if;
  if old.kind = 'due_change' or new.kind = 'due_change' then
    if new.kind is distinct from old.kind or new.old_due is distinct from old.old_due
       or new.new_due is distinct from old.new_due then
      raise exception 'ประวัติเลื่อนวันแก้ได้เฉพาะเหตุผล';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if (new.kind is distinct from old.kind or new.event_date is distinct from old.event_date)
     and not public.task_update_is_latest(old.id, old.task_id, old.created_at) then
    raise exception 'แก้ประเภท/วันที่ได้เฉพาะรายการล่าสุด — รายการเก่าแก้ได้แค่ข้อความ';
  end if;

  new.old_due := old.old_due;
  new.new_due := case when new.event_date is not null then new.event_date end;
  -- ไม่เคยมีวัน แล้วเพิ่งใส่วัน → ตั้งต้นจากวันครบกำหนดตอนนี้
  if old.event_date is null and new.event_date is not null then
    select due_date into new.old_due from public.tasks where id = new.task_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.task_updates_after_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.kind = 'due_change' or new.event_date is not distinct from old.event_date then
    return null;
  end if;
  -- วันใหม่ หรือเอาวันออก (กลับไปวันก่อนบันทึก) — เฉพาะถ้ายังไม่มีใครเปลี่ยนวันต่อจากนี้
  perform public.task_set_due_silently(new.task_id, coalesce(new.event_date, new.old_due), false)
    from public.tasks t
   where t.id = new.task_id
     and t.due_date is not distinct from coalesce(old.new_due, t.due_date);
  return null;
end;
$$;

create or replace function public.task_updates_after_delete()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.kind = 'due_change' or old.new_due is null
     or not public.task_update_is_latest(old.id, old.task_id, old.created_at) then
    return null;
  end if;
  perform public.task_set_due_silently(old.task_id, old.old_due, false)
    from public.tasks t
   where t.id = old.task_id and t.due_date is not distinct from old.new_due;
  return null;
end;
$$;

create trigger task_updates_before_insert before insert on public.task_updates
  for each row execute function public.task_updates_before_insert();
create trigger task_updates_after_insert after insert on public.task_updates
  for each row execute function public.task_updates_after_insert();
create trigger task_updates_before_update before update on public.task_updates
  for each row execute function public.task_updates_before_update();
create trigger task_updates_after_update after update on public.task_updates
  for each row execute function public.task_updates_after_update();
create trigger task_updates_after_delete after delete on public.task_updates
  for each row execute function public.task_updates_after_delete();

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.task_updates enable row level security;

create policy task_updates_read on public.task_updates for select to authenticated using (true);

create policy task_updates_insert on public.task_updates for insert to authenticated
  with check (public.can_access_task(task_id) and created_by = auth.uid() and kind <> 'due_change');

create policy task_updates_update on public.task_updates for update to authenticated
  using (public.is_admin() or (created_by = auth.uid() and created_at > now() - interval '24 hours'))
  with check (public.is_admin() or (created_by = auth.uid() and created_at > now() - interval '24 hours'));

create policy task_updates_delete on public.task_updates for delete to authenticated
  using (public.is_admin() or (created_by = auth.uid() and created_at > now() - interval '24 hours'));

-- ── เลื่อนวันจากช่องครบกำหนด → ลงไทม์ไลน์แทนตารางเดิม ─────────────────
create or replace function public.tasks_log_due_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(current_setting('amgo.skip_due_log', true), '') = 'on' then
    return null;
  end if;
  insert into public.task_updates (task_id, kind, body, old_due, new_due, created_by)
  values (new.id, 'due_change', coalesce(new.due_change_reason, ''), old.due_date, new.due_date, auth.uid());
  return null;
end;
$$;

-- ยังไม่มีแถวในตารางเดิม (เช็ค 28 ต.ค. 69 = 0 แถว) — ไม่ต้องย้ายข้อมูล
drop table public.task_due_changes;

comment on column public.tasks.due_change_reason is
  'เหตุผลของการเลื่อนวันครั้งล่าสุด — ส่งมาพร้อม due_date ใหม่ · ประวัติเต็มอยู่ที่ task_updates (kind = due_change)';

-- ── รูปแนบในอัปเดต — รูปของงานเดิม update_id = null ──────────────────
alter table public.task_images
  add column update_id uuid references public.task_updates(id) on delete cascade;
create index on public.task_images (update_id) where update_id is not null;

-- ── สถานะล่าสุดของแต่ละงาน — บรรทัดเล็กบนการ์ด + ระบบแจ้งเตือน ───────────
-- follow_ups = ตามไปแล้วกี่ครั้งนับจาก "รอเขา" ครั้งล่าสุด
create view public.task_status_line with (security_invoker = on) as
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
where u.kind <> 'due_change'
order by u.task_id, u.created_at desc, u.id desc;

grant select on public.task_status_line to authenticated;
