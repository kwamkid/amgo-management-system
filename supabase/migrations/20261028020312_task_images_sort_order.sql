-- ลากเรียงรูปได้ (เจ้าของ 28 ต.ค. 69) — รูปแรกของงาน (update_id null) = ปกบนการ์ด
-- รูปในแต่ละอัปเดตเรียงแยกกันตาม update_id
alter table public.task_images add column sort_order double precision not null default 0;
update public.task_images i set sort_order = r.n
  from (select id, row_number() over (partition by task_id, update_id order by created_at) as n from public.task_images) r
 where r.id = i.id;
-- เรียงใหม่ = แก้ sort_order · สิทธิ์เท่ากับเพิ่ม/ลบรูป
create policy task_images_update on public.task_images for update to authenticated
  using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
comment on column public.task_images.sort_order is 'ลำดับรูป (ลากเรียงได้) — รูปแรกของงาน (update_id null) = ปกบนการ์ด';
