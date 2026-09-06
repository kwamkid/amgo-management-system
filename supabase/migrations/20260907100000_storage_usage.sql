-- (ลงบน production แล้ว 7 ก.ย. 69 ผ่าน Management API — ไฟล์นี้คือสำเนา)
-- วัดพื้นที่ storage ต่อ bucket (ขนาดจาก metadata ของ storage.objects) — ใช้จาก server เท่านั้น
create or replace function public.storage_usage()
returns table (bucket text, files bigint, bytes bigint, oldest timestamptz)
language sql security definer set search_path = public, storage as $$
  select bucket_id::text, count(*)::bigint, coalesce(sum((metadata->>'size')::bigint), 0)::bigint, min(created_at)
  from storage.objects group by bucket_id order by 3 desc
$$;
revoke all on function public.storage_usage() from public, anon, authenticated;
grant execute on function public.storage_usage() to service_role;
insert into public.app_config (key, value, note) values ('storage_quota_mb', '1024', 'โควตา storage ของแพลน (Free = 1024 MB) — cron ลบรูปเก่าสุดเมื่อใช้เกิน 85%') on conflict (key) do nothing;
