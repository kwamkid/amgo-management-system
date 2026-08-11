-- สรุปเงินเดือนรายเดือน — หน้าคล้าย excel ให้ HR กรอกค่าคอม/เงินพิเศษ/หัก
-- แล้วรวมเป็นยอดโอนต่อคน export ไฟล์ขึ้นระบบธนาคาร
create table public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  month date not null, -- วันที่ 1 ของเดือนนั้น
  user_id uuid not null references public.users(id) on delete cascade,
  base_salary numeric not null default 0,
  work_days numeric not null default 0,
  absent_days numeric not null default 0,
  ot_hours numeric not null default 0,
  ot_rate numeric not null default 0,
  commission numeric not null default 0, -- จากยอดขายเดือนก่อน — HR กรอก/ดึงจากเดือนก่อน
  extra numeric not null default 0, -- เบี้ยเลี้ยง/ค่าที่พัก/เงินพิเศษ
  deduction numeric not null default 0,
  note text not null default '',
  total numeric generated always as
    (base_salary + round(ot_hours * ot_rate, 2) + commission + extra - deduction) stored,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (month, user_id)
);

alter table public.payroll_entries enable row level security;

-- เงินเดือนเป็นความลับ — HR/แอดมินเท่านั้น
create policy payroll_entries_manage on public.payroll_entries
  for all to authenticated using (public.is_hr()) with check (public.is_hr());
