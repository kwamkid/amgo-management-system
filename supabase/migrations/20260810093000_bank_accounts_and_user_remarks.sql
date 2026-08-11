-- (1) เลขบัญชีเงินเดือน — เจ้าของส่งมาพร้อมทะเบียนพนักงาน ใช้ตอนทำ payroll
alter table public.users add column bank_name text;
alter table public.users add column bank_account_no text;

-- (2) โน้ตต่อพนักงาน (remark) — บันทึกตามวันเวลา เห็นเฉพาะ HR/แอดมิน
-- เริ่มจากหมายเหตุเงินเดือนในทะเบียนพนักงานที่เจ้าของส่งมา (10 ส.ค. 2569)
create table public.user_remarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  remark text not null,
  remark_date timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);

create index user_remarks_user_idx on public.user_remarks (user_id, remark_date desc);

alter table public.user_remarks enable row level security;

create policy user_remarks_read on public.user_remarks
  for select to authenticated using (public.is_hr());

create policy user_remarks_manage on public.user_remarks
  for all to authenticated using (public.is_hr()) with check (public.is_hr());
