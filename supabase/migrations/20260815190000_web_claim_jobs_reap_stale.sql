-- เก็บกวาดงานที่ค้างสถานะ running ก่อนหยิบงานใหม่ทุกครั้ง
--
-- ปัญหาจริง (15 ส.ค. 69): Vercel ตัดฟังก์ชันที่ 60 วินาที ถ้างานยังไม่จบ
-- โค้ดที่ปิดงานจะไม่ได้ทำงานเลย แถวค้างสถานะ 'running' ตลอดกาล
-- แล้วกติกา "โฮสต์เดียวกันรันทีละงาน" จะมองว่าโฮสต์นั้นไม่ว่างตลอดไป
-- → คิวของทั้งโฮสต์ตายสนิท (เกิดจริง 3 โฮสต์ ค้าง 30 นาที งานรอ 26 ใบ)
--
-- เกณฑ์ 5 นาที: เพดานจริงคือ 60 วินาที ต่อให้บวกเวลาเผื่อทุกทางแล้ว
-- อะไรที่ยังขึ้น running เกิน 5 นาทีคือตายไปแล้วแน่นอน
create or replace function public.web_claim_jobs(p_limit int default 4)
returns setof public.web_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.web_jobs;
begin
  -- ปลดล็อกโฮสต์ที่ติดงานผี ก่อนจะไปหยิบงานใหม่
  update public.web_jobs
  set status = 'failed',
      finished_at = now(),
      raw_log = coalesce(raw_log, '') ||
        E'\n⚠️ งานถูกตัดกลางคัน (เกิน 5 นาทีโดยไม่ปิดงาน) — ระบบปลดล็อกโฮสต์ให้แล้ว'
  where status = 'running'
    and started_at < now() - interval '5 minutes';

  for j in
    select * from public.web_jobs q
    where q.status = 'queued'
      and not exists (
        select 1 from public.web_jobs r
        where r.status = 'running' and r.host_id = q.host_id
      )
      -- โฮสต์เดียวกันในรอบนี้ก็หยิบได้ตัวเดียว (distinct on)
      and q.id = (
        select q2.id from public.web_jobs q2
        where q2.status = 'queued' and q2.host_id is not distinct from q.host_id
        order by q2.queued_at, q2.id
        limit 1
      )
    order by q.queued_at
    limit p_limit
    for update skip locked
  loop
    update public.web_jobs
    set status = 'running', started_at = now(), attempts = attempts + 1
    where id = j.id;
    j.status := 'running';
    return next j;
  end loop;
end;
$$;
