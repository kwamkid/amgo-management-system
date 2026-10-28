-- เจ้าของ 28 ต.ค. 69: "ให้ทุกคนเห็นได้หมด ไม่มีอะไรต้องปิดบัง"
-- อ่านได้ทุกคน · แก้/แนบรูป/ลบ ยังเป็นกติกาเดิม (แอดมิน · คนสร้าง · ผู้รับผิดชอบ)
drop policy tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated using (true);

drop policy task_assignees_read on public.task_assignees;
create policy task_assignees_read on public.task_assignees for select to authenticated using (true);

drop policy task_images_read on public.task_images;
create policy task_images_read on public.task_images for select to authenticated using (true);

drop policy "task-images read" on storage.objects;
create policy "task-images read" on storage.objects for select to authenticated
  using (bucket_id = 'task-images');

comment on table public.tasks is
  'งานของทีม — ทุกคนเห็นทุกงาน (เจ้าของสั่ง 28 ต.ค. 69) · แก้ได้เฉพาะแอดมิน/คนสร้าง/ผู้รับผิดชอบ';
