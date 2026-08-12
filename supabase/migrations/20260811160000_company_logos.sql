-- โลโก้บริษัท — ขึ้นหัวเอกสารทางการ (สัญญาจ้าง/ใบรับรองเงินเดือน)
-- อัพโหลดที่หน้า ตั้งค่า > บริษัท · เก็บใน bucket สาธารณะ (โลโก้ไม่ใช่ข้อมูลลับ
-- และ public URL ทำให้หน้าเอกสารแสดงได้ตรง ๆ ไม่ต้องขอ signed URL ทุกครั้ง)

alter table public.companies add column if not exists logo_url text;

comment on column public.companies.logo_url is 'public URL ของโลโก้ใน bucket company-logos — ใช้บนหัวเอกสาร';

insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do update set public = true;

-- อ่านได้ทุกคน (bucket สาธารณะ) · เขียน/แก้/ลบได้เฉพาะ HR/แอดมิน (นิยามเดียวกับจัดการบริษัท)
create policy "company_logos_read" on storage.objects
  for select using (bucket_id = 'company-logos');
create policy "company_logos_insert" on storage.objects
  for insert with check (bucket_id = 'company-logos' and public.is_hr());
create policy "company_logos_update" on storage.objects
  for update using (bucket_id = 'company-logos' and public.is_hr());
create policy "company_logos_delete" on storage.objects
  for delete using (bucket_id = 'company-logos' and public.is_hr());
