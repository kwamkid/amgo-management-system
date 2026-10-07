-- คิวงานกลางของทั้งระบบ (เจ้าของสั่ง 8 ต.ค. 69: "อะไรที่ทำในอนาคตใช้คิวได้ทั้งหมด")
--
-- ปัญหาที่แก้: งานยาวเกิน 60 วิ ของ Vercel / cron-job.org รอได้ 30 วิ / งานที่หน้าเว็บวนเรียกเอง
-- พอปิดหน้าก็หยุด — ทุกงานจึงลงคิวนี้แทน แล้วตัวรันกลาง (/api/queue/run) หยิบไปทำทีละชิ้นเล็ก ๆ
--
-- หนึ่งแถว = งานชิ้นเล็กที่จบได้ใน ~40 วิ (เช่น ดึง GSC 1 เว็บ · ถาม AI 1 ข้อ)
-- group_key = ชุดงานที่สั่งพร้อมกัน (แผงคิวบนหน้าเว็บนับความคืบหน้าจากตรงนี้)
-- งานฟลีต (web_jobs) ยังอยู่ตารางเดิม (มีกติกาโฮสต์ละงาน) แต่ใช้ตัวรันกลางตัวเดียวกัน

create table public.queue_jobs (
  id bigint generated always as identity primary key,
  kind text not null,                          -- 'seo.gsc' · 'seo.aeo.ask' … (ตัวทำงานดู lib/queue/handlers.ts)
  group_key text,                              -- 'seo-daily:2026-10-08' · 'aeo:<siteId>:<เวลา>'
  label text,                                  -- ข้อความสั้นไว้โชว์ในแผงคิว
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  priority smallint not null default 5,        -- น้อย = ทำก่อน
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_after timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  error text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index queue_jobs_ready on public.queue_jobs (priority, run_after, id) where status = 'queued';
create index queue_jobs_group on public.queue_jobs (group_key, status);
create index queue_jobs_finished on public.queue_jobs (finished_at) where status in ('done', 'failed');

alter table public.queue_jobs enable row level security;
-- เจ้าของเว็บดูความคืบหน้าได้ · เขียนเฉพาะเซิร์ฟเวอร์
create policy queue_jobs_owner_read on public.queue_jobs
  for select to authenticated using ((select public.is_web_owner()));

-- หยิบงานที่ถึงเวลา (skip locked — ตัวรันหลายตัวพร้อมกันไม่ชนกัน)
-- ก่อนหยิบ: งาน running เกิน 5 นาที = ตายกลางคัน (Vercel ตัดที่ 60 วิ) → กลับเข้าคิว หรือ failed ถ้าลองครบแล้ว
create or replace function public.queue_claim(p_limit int default 6)
returns setof public.queue_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.queue_jobs
  set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
      error = coalesce(error || E'\n', '') || 'งานถูกตัดกลางคัน (เกิน 5 นาที)',
      finished_at = case when attempts >= max_attempts then now() else null end,
      run_after = now()
  where status = 'running' and started_at < now() - interval '5 minutes';

  return query
  update public.queue_jobs q
  set status = 'running', started_at = now(), attempts = q.attempts + 1
  where q.id in (
    select id from public.queue_jobs
    where status = 'queued' and run_after <= now()
    order by priority, run_after, id
    limit p_limit
    for update skip locked
  )
  returning q.*;
end;
$$;

revoke execute on function public.queue_claim(int) from public, anon, authenticated;
grant execute on function public.queue_claim(int) to service_role;

-- เก็บประวัติงานที่จบแล้ว 30 วันพอ (เรียกจากตัวรันวันละครั้ง)
create or replace function public.queue_prune()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.queue_jobs
  where status in ('done', 'failed') and finished_at < now() - interval '30 days';
$$;
revoke execute on function public.queue_prune() from public, anon, authenticated;
grant execute on function public.queue_prune() to service_role;
