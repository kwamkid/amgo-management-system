-- Brand editors (srp_brand_access role 'editor') can already edit srp_products,
-- but the srp-images bucket only allowed admins, so their product-image uploads
-- failed with "new row violates row-level security policy".
-- Product images live at '<brand_id>/<uuid>.<ext>'; logos at 'logos/...' stay admin-only.

create or replace function public.srp_can_write_image(object_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when public.is_admin() then true
    when (storage.foldername(object_name))[1]
         ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then coalesce(public.srp_role(((storage.foldername(object_name))[1])::uuid) = 'editor', false)
    else false
  end;
$$;

grant execute on function public.srp_can_write_image to authenticated;

drop policy if exists "srp_images_insert" on storage.objects;
drop policy if exists "srp_images_update" on storage.objects;
drop policy if exists "srp_images_delete" on storage.objects;

create policy "srp_images_insert" on storage.objects
  for insert with check (bucket_id = 'srp-images' and public.srp_can_write_image(name));
create policy "srp_images_update" on storage.objects
  for update using (bucket_id = 'srp-images' and public.srp_can_write_image(name));
create policy "srp_images_delete" on storage.objects
  for delete using (bucket_id = 'srp-images' and public.srp_can_write_image(name));
