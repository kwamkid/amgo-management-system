-- AOO Hosting Manager — จัดการเว็บ WordPress ทั้งฟลีตจากที่เดียว
-- (ตามสเปก 6 ส.ค. 69 แต่ย้ายฐานจาก Firebase → Supabase ตามที่เจ้าของสั่ง 15 ส.ค.)
--
-- แกนคือ "คิวงานทีละเว็บ" ไม่ใช่ยิงพร้อมกันทั้ง 42 เว็บ เพราะของจริงเคยทำ
-- server load ของโฮสต์พุ่ง 12+ จนเว็บลูกค้าช้า — 1 job = 1 เว็บ = ไม่กี่วินาที
-- และคุมได้ว่าโฮสต์เดียวกันห้ามรันพร้อมกันเกิน 1 งาน
--
-- SSH เป็นของ "โฮสต์" ไม่ใช่ของเว็บ (1 บัญชี Hostinger = 1 SSH · เว็บอยู่ใต้
-- ~/domains/{domain}/public_html) — เพิ่มโฮสต์ใหม่ = เพิ่มแถว ไม่ต้อง deploy
-- คีย์ส่วนตัวอยู่ใน env ตัวเดียว (WP_SSH_PRIVATE_KEY) เอา public key ไปใส่ทุกโฮสต์

-- ── โฮสต์ ───────────────────────────────────────────────────────────
create table public.web_hosts (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- ชื่อบัญชี เช่น u276288362
  provider text not null default 'Hostinger',
  ssh_host text not null,
  ssh_port int not null default 22,
  ssh_user text not null,
  domains_path text not null default 'domains',  -- โฟลเดอร์ที่รวมเว็บ (relative จาก home)
  hardened boolean not null default false,
  backup_keep int not null default 3,       -- เก็บ backup ที่สั่งเองกี่ไฟล์ล่าสุดต่อเว็บ
  is_active boolean not null default true,
  notes text,
  last_discovered_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── เว็บผูกกับโฮสต์ + ผลสแกนล่าสุด ──────────────────────────────────
alter table public.web_sites
  add column host_id uuid references public.web_hosts(id) on delete set null,
  add column public_html_path text,         -- เช่น domains/adayhome.com/public_html
  add column pending_plugin_count int not null default 0,
  add column last_scan_status text not null default 'unknown'
    check (last_scan_status in ('ok', 'suspect', 'fail', 'unknown')),
  add column last_scan_at timestamptz,
  add column last_backup_at timestamptz,
  add column last_backup_file text;

create index web_sites_host_idx on public.web_sites (host_id);

-- ── รอบการสั่งงาน 1 ครั้ง (กดปุ่ม "ทำทั้งหมด" = 1 batch) ─────────────
create table public.web_run_batches (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('scan', 'plugin_update', 'backup', 'discover')),
  total_jobs int not null default 0,
  done_jobs int not null default 0,
  failed_jobs int not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ── งาน 1 ชิ้น = 1 เว็บ (ยกเว้น discover ที่เป็นระดับโฮสต์) ───────────
create table public.web_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.web_run_batches(id) on delete cascade,
  type text not null check (type in ('scan', 'plugin_update', 'backup', 'discover')),
  host_id uuid references public.web_hosts(id) on delete cascade,
  site_id uuid references public.web_sites(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed')),
  triggered_by text not null default 'user' check (triggered_by in ('user', 'schedule')),
  attempts int not null default 0,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  raw_log text,
  summary jsonb
);

-- คิวหยิบงานจาก (status, queued_at) ตลอด — index ตรงนี้คือหัวใจ
create index web_jobs_queue_idx on public.web_jobs (status, queued_at);
create index web_jobs_batch_idx on public.web_jobs (batch_id);
create index web_jobs_site_idx on public.web_jobs (site_id, queued_at desc);

-- ── ไฟล์ที่ scan เจอแล้วรู้ว่าไม่ใช่มัลแวร์ ──────────────────────────
create table public.web_false_positives (
  id uuid primary key default gen_random_uuid(),
  path_pattern text not null,               -- เทียบแบบ LIKE (ใช้ % แทน *)
  description text not null default '',
  created_at timestamptz not null default now()
);

-- ── หยิบงานถัดไป: โฮสต์ละ 1 งานเท่านั้น ─────────────────────────────
--
-- FOR UPDATE SKIP LOCKED กันสองรอบ cron ที่ทับกันหยิบงานเดียวกัน
-- เงื่อนไข "โฮสต์นี้ต้องไม่มีงานที่ running อยู่" คือกติกากันโหลดพุ่ง
create or replace function public.web_claim_jobs(p_limit int default 4)
returns setof public.web_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.web_jobs;
begin
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

-- ── RLS: เจ้าของเมนูเท่านั้น (เหมือน web_sites) ─────────────────────
alter table public.web_hosts enable row level security;
alter table public.web_jobs enable row level security;
alter table public.web_run_batches enable row level security;
alter table public.web_false_positives enable row level security;

create policy web_hosts_owner on public.web_hosts
  for all to authenticated using (public.is_web_owner()) with check (public.is_web_owner());
create policy web_jobs_owner on public.web_jobs
  for all to authenticated using (public.is_web_owner()) with check (public.is_web_owner());
create policy web_run_batches_owner on public.web_run_batches
  for all to authenticated using (public.is_web_owner()) with check (public.is_web_owner());
create policy web_false_positives_owner on public.web_false_positives
  for all to authenticated using (public.is_web_owner()) with check (public.is_web_owner());

-- ── false positive ที่รู้อยู่แล้วจาก playbook เดิม ────────────────────
insert into public.web_false_positives (path_pattern, description) values
  ('%wp-content/uploads/sucuri/sucuri-%.php', 'ปลั๊กอิน Sucuri เก็บ log เป็นไฟล์ .php'),
  ('%wp-content/cache/%', 'ไฟล์แคชที่ปลั๊กอินสร้างเอง'),
  ('%wp-content/plugins/akismet/%', 'ปลั๊กอิน Akismet มีคำที่ตรง pattern แต่เป็นของแท้');
