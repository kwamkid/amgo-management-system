-- รูปแนบในงาน (เจ้าของขอ 28 ต.ค. 69) — รองรับรูป iPhone (HEIC) · ย่อก่อนอัปโหลด
--
-- ย่อบนเครื่องผู้ใช้ด้วย lib/utils/resizeImage.ts → JPEG เสมอ (HEIC แปลงด้วย heic-to)
-- bucket จึงรับแค่ image/jpeg และจำกัด 5 MB ไว้กันหลุด
-- path = <task_id>/<เวลา>.jpg — สิทธิ์ของรูปตามสิทธิ์ของงาน
-- ใครเห็นงานได้ = เพิ่ม/ดู/ลบรูปได้ (งานที่แอดมินมอบให้ แก้ชื่อไม่ได้ แต่แนบรูปผลงานได้)

/** เห็นงานนี้ได้ไหม — แอดมิน · คนสร้าง · ผู้รับผิดชอบ */
create or replace function public.can_access_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and (t.created_by = auth.uid()
           or exists (select 1 from public.task_assignees a
                      where a.task_id = t.id and a.user_id = auth.uid()))
  );
$$;

revoke execute on function public.can_access_task(uuid) from anon, public;
grant execute on function public.can_access_task(uuid) to authenticated;

create table public.task_images (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  path        text not null unique,
  created_by  uuid references public.users(id) default auth.uid(),
  created_at  timestamptz not null default now()
);

create index on public.task_images (task_id);

alter table public.task_images enable row level security;

create policy task_images_read on public.task_images for select to authenticated
  using (public.can_access_task(task_id));

create policy task_images_insert on public.task_images for insert to authenticated
  with check (public.can_access_task(task_id) and created_by = auth.uid());

create policy task_images_delete on public.task_images for delete to authenticated
  using (public.can_access_task(task_id));

-- ── storage ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-images', 'task-images', false, 5242880, array['image/jpeg']);

create policy "task-images read" on storage.objects for select to authenticated
  using (bucket_id = 'task-images'
         and public.can_access_task(((storage.foldername(name))[1])::uuid));

create policy "task-images insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'task-images'
              and public.can_access_task(((storage.foldername(name))[1])::uuid));

create policy "task-images delete" on storage.objects for delete to authenticated
  using (bucket_id = 'task-images'
         and public.can_access_task(((storage.foldername(name))[1])::uuid));
