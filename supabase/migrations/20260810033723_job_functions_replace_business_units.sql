-- แยก "บริษัท" กับ "หน้าที่" ออกจากกัน — เลิกใช้หน่วยงานรายสาขา
--
-- ── ปัญหาของเดิม ──────────────────────────────────────────────────────
-- business_units ยัด 3 เรื่องไว้ในช่องเดียว: บริษัทไหน · ทำหน้าที่อะไร · สาขาไหน
-- เลยมี 14 หน่วยงาน ซึ่ง 8 อันคือสาขาหน้าร้านที่ตั้งค่า "เหมือนกันเป๊ะ"
-- (shop · สลับเวร · 6 วัน · เปิด 7 วัน · 8 ชม. · รอบ 4) ต่างกันแค่ชื่อ
--
-- แล้วยังทำให้ข้อมูลผิดด้วย: คนผูกหน่วยงานได้คนละ 1 อัน แต่พนักงานหน้าร้าน
-- เช็คอินได้หลายสาขา คนที่วิ่ง 2 สาขาจึงถูกบังคับให้เลือกข้าง
--
-- ── โครงใหม่ 3 แกน ────────────────────────────────────────────────────
--   บริษัท   users.company_id       → แยกเมนู · สิทธิ์ · อัตรา OT · รายงาน
--   หน้าที่  users.job_function_id  → ตารางเวร · วัน/สัปดาห์ · รอบจ่ายเงิน
--   สถานที่  user_allowed_locations → เช็คอินตรงไหนได้ (มีอยู่แล้ว ไม่แตะ)
--
-- ทำตอนนี้เพราะยังไม่มีใครถูกผูกหน่วยงานสักคน (0 จาก 41) — ไม่มีข้อมูลต้องย้าย

/* ── หน้าที่ ───────────────────────────────────────────────────────── */

create table if not exists public.job_functions (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique,
  name_th                text not null,
  -- fixed = รู้ว่าวันไหนเข้า · rotating = สลับเวร ระบบไม่รู้ว่าวันนี้เวรใคร
  schedule_type          text not null default 'fixed'
                           check (schedule_type in ('fixed','rotating')),
  default_days_per_week  smallint check (default_days_per_week between 1 and 7),
  -- หน่วยงานเปิดกี่วัน (ร้านเปิด 7 แต่คนทำ 6) — ใช้คิดโควตาลาพักร้อน
  coverage_days_per_week smallint check (coverage_days_per_week between 1 and 7),
  standard_hours_per_day numeric(4,2) not null default 8,
  payroll_cycle          text,
  sort_order             integer not null default 0,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.job_functions is
  'หน้าที่ของพนักงาน — เป็นตัวกำหนดตารางเวรและรอบจ่ายเงิน (แทน business_units เดิมที่แยกรายสาขา)';

create table if not exists public.job_function_work_days (
  job_function_id uuid not null references public.job_functions(id) on delete cascade,
  day_of_week     smallint not null check (day_of_week between 0 and 6),
  work_mode       text not null check (work_mode in ('onsite','wfh','off')),
  primary key (job_function_id, day_of_week)
);

comment on table public.job_function_work_days is
  'ตารางประจำสัปดาห์ของแต่ละหน้าที่ — 0 = อาทิตย์  ใช้เฉพาะหน้าที่แบบ fixed';

alter table public.job_functions          enable row level security;
alter table public.job_function_work_days enable row level security;

-- อ่านได้ทุกคน (หน้าจอต้องเอาไปทำ dropdown) · แก้ได้เฉพาะ HR
create policy job_functions_read   on public.job_functions          for select using (true);
create policy job_functions_manage on public.job_functions          for all
  using (public.is_hr()) with check (public.is_hr());
create policy job_function_work_days_read   on public.job_function_work_days for select using (true);
create policy job_function_work_days_manage on public.job_function_work_days for all
  using (public.is_hr()) with check (public.is_hr());

create trigger job_functions_updated_at before update on public.job_functions
  for each row execute function public.set_updated_at();

/* ── ค่าตั้งต้น ────────────────────────────────────────────────────────
   ยกมาจาก business_units เดิมตรง ๆ ไม่ได้คิดใหม่:
     หน้าร้าน  = ค่าของ 8 สาขา ABC/Central/Emporium/Paragon (เหมือนกันหมด)
     คลัง      = คลังหลัก พระราม 2 + โกดังใหม่ตลาดไท
     ออฟฟิศ    = ออฟฟิศ AGD (รวม WFH จันทร์กับพุธ ที่ตั้งไว้เดิม)
   ที่เพิ่มใหม่คือ Call Center · ขับรถส่งของ · การตลาด ซึ่งเดิมไม่มีหน่วยงาน
   รองรับ (คนกลุ่มนี้มีอยู่จริงใน users.role) — HR แก้ตารางทีหลังได้           */

insert into public.job_functions
  (code, name_th, schedule_type, default_days_per_week, coverage_days_per_week, payroll_cycle, sort_order)
values
  ('shop',       'หน้าร้าน',        'rotating', 6, 7, 'c4',  1),
  ('warehouse',  'คลังสินค้า',      'fixed',    6, 6, 'c28', 2),
  ('office',     'ออฟฟิศ',          'fixed',    5, 5, 'c28', 3),
  ('callcenter', 'Call Center',     'fixed',    6, 6, 'c28', 4),
  ('driver',     'ขับรถส่งของ',     'fixed',    6, 6, 'c28', 5),
  ('marketing',  'การตลาด',         'fixed',    5, 5, 'c28', 6)
on conflict (code) do nothing;

-- คลัง · ขับรถ = จันทร์–เสาร์ เข้าที่ทำงาน
insert into public.job_function_work_days (job_function_id, day_of_week, work_mode)
select jf.id, d.dow, case when d.dow = 0 then 'off' else 'onsite' end
from public.job_functions jf
cross join (select generate_series(0,6) as dow) d
where jf.code in ('warehouse','driver')
on conflict do nothing;

-- ออฟฟิศ · การตลาด = จันทร์–ศุกร์ (ออฟฟิศ WFH จันทร์กับพุธ ตามที่ตั้งไว้เดิม)
insert into public.job_function_work_days (job_function_id, day_of_week, work_mode)
select jf.id, d.dow,
       case
         when d.dow in (0, 6) then 'off'
         when jf.code = 'office' and d.dow in (1, 3) then 'wfh'
         else 'onsite'
       end
from public.job_functions jf
cross join (select generate_series(0,6) as dow) d
where jf.code in ('office','marketing')
on conflict do nothing;

-- Call Center = จันทร์–เสาร์ รับสายจากที่บ้านได้
insert into public.job_function_work_days (job_function_id, day_of_week, work_mode)
select jf.id, d.dow, case when d.dow = 0 then 'off' else 'wfh' end
from public.job_functions jf
cross join (select generate_series(0,6) as dow) d
where jf.code = 'callcenter'
on conflict do nothing;

/* ── ผูกเข้ากับพนักงาน ─────────────────────────────────────────────── */

alter table public.users
  add column if not exists company_id      uuid references public.companies(id),
  add column if not exists job_function_id uuid references public.job_functions(id);

comment on column public.users.company_id is
  'บริษัทที่สังกัด — ใช้แยกเมนูและสิทธิ์ ไม่ผูกกับตารางงาน';
comment on column public.users.job_function_id is
  'หน้าที่ — เป็นตัวกำหนดตารางเวรและรอบจ่ายเงิน';

create index if not exists users_company_idx       on public.users(company_id);
create index if not exists users_job_function_idx  on public.users(job_function_id);;
