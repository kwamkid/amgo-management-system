-- ใบเบิกค่าใช้จ่าย (Expense reimbursement) — 30 ก.ย. 69
--
-- พนักงานจ่ายไปก่อน → ถ่ายใบเสร็จยื่นเบิก → ผู้จัดการ/แอดมินอนุมัติ → บัญชี/HR
-- ตรวจแล้วจ่าย · กติกาเจ้าของ:
--   · ต้องแนบรูปใบเสร็จทุกใบ ไม่มีวงเงิน — ไม่มีใบเสร็จ (ค่าวิน) เขียนเหตุผลแทน
--   · จ่ายคืน "เลือกได้ทีละใบ": รวมกับเงินเดือนงวดถัดไป หรือ โอนแยก
--   · เงินทดรองจ่าย (ขอก่อนแล้วเคลียร์) ยังไม่ทำ — ทำเบิกคืนก่อน
--
-- ไม่มีความสัมพันธ์หัวหน้า-ลูกน้องในระบบ ขั้นแรกจึงให้ผู้จัดการ/แอดมินคนไหนก็ได้
-- (แบบเดียวกับใบลา) · ขั้นบัญชี = HR + แอดมิน + ตำแหน่ง "บัญชี" · อนุมัติใบตัวเองไม่ได้

-- ── ใครคือฝ่ายบัญชี ─────────────────────────────────────────────────
create or replace function public.is_finance()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.is_hr() or exists (
    select 1 from public.users u
    join public.job_functions jf on jf.id = u.job_function_id
    where u.id = auth.uid() and jf.code = 'accountant'
  );
$$;

-- ── ตารางใบเบิก ────────────────────────────────────────────────────────
create table public.expense_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- snapshot ชื่อตอนยื่น (กติกาเดียวกับใบลา) — อ่านจริงทับด้วย getDisplayNames()
  user_name text not null default '',
  -- บริษัทที่จ่ายคืน — ว่าง = ต้นสังกัด
  company_id uuid references public.companies(id),

  expense_date date not null,
  category text not null
    check (category in ('travel', 'fuel', 'parking', 'meal', 'supplies', 'shipping', 'other')),
  description text not null check (length(trim(description)) > 0),
  amount numeric(12, 2) not null check (amount > 0),

  -- path ใน bucket expense-receipts · ไม่มีใบเสร็จต้องบอกเหตุผล
  receipt_paths text[] not null default '{}',
  no_receipt_reason text,

  -- จ่ายคืนแบบไหน — พนักงานเลือกตอนยื่น บัญชีเปลี่ยนได้ตอนอนุมัติ
  payout text not null default 'payroll' check (payout in ('payroll', 'transfer')),

  status text not null default 'pending_manager'
    check (status in ('pending_manager', 'pending_finance', 'approved', 'paid', 'rejected', 'cancelled')),

  manager_id uuid references public.users(id),
  manager_at timestamptz,
  finance_id uuid references public.users(id),
  finance_at timestamptz,
  rejected_by uuid references public.users(id),
  rejected_at timestamptz,
  rejected_reason text,

  -- payout = payroll: งวดเงินเดือนที่รวมจ่าย (วันที่ 1 ของเดือนป้ายงวด)
  payroll_month date,

  paid_at timestamptz,
  paid_by uuid references public.users(id),
  paid_note text,
  slip_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expense_claims_receipt_or_reason
    check (cardinality(receipt_paths) > 0 or length(trim(coalesce(no_receipt_reason, ''))) > 0),
  constraint expense_claims_payroll_month
    check (payout <> 'payroll' or status not in ('approved', 'paid') or payroll_month is not null)
);

create index expense_claims_user_idx on public.expense_claims (user_id, expense_date desc);
create index expense_claims_open_idx on public.expense_claims (status)
  where status in ('pending_manager', 'pending_finance', 'approved');
create index expense_claims_payroll_idx on public.expense_claims (payroll_month, user_id)
  where payout = 'payroll';

create trigger expense_claims_touch
  before update on public.expense_claims
  for each row execute function public.set_updated_at();

alter table public.expense_claims enable row level security;

-- เห็นของตัวเอง · ผู้จัดการ/HR/แอดมิน/บัญชีเห็นหมด
create policy expense_claims_select on public.expense_claims
  for select to authenticated
  using (user_id = auth.uid() or public.can_view_all() or public.is_finance());

-- ยื่นได้เฉพาะของตัวเอง สถานะเริ่มต้นเท่านั้น
create policy expense_claims_insert_own on public.expense_claims
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending_manager');

-- แก้/ยกเลิกใบตัวเองได้ตราบใดที่ยังไม่มีใครอนุมัติ — ยกเลิกได้อย่างเดียว ไปสถานะอื่นไม่ได้
create policy expense_claims_update_own_pending on public.expense_claims
  for update to authenticated
  using (user_id = auth.uid() and status = 'pending_manager')
  with check (user_id = auth.uid() and status in ('pending_manager', 'cancelled'));

-- ฝ่ายบัญชีปิดงานจ่าย (หน้าเงินเดือนตีตราว่าจ่ายแล้ว) — ขั้นอนุมัติผ่านฟังก์ชันด้านล่าง
create policy expense_claims_finance_update on public.expense_claims
  for update to authenticated
  using (public.is_finance()) with check (public.is_finance());

-- ── ขั้นอนุมัติ ───────────────────────────────────────────────────────
-- security definer เพราะผู้จัดการไม่มีสิทธิ์แก้ตารางตรง ๆ · ตรวจลำดับขั้นทุกครั้ง

create or replace function public.expense_manager_decide(p_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare r public.expense_claims%rowtype;
begin
  if public.auth_role() not in ('manager', 'admin') then
    raise exception 'เฉพาะผู้จัดการและแอดมิน';
  end if;
  select * into r from public.expense_claims where id = p_id for update;
  if not found then raise exception 'ไม่พบใบเบิก'; end if;
  if r.user_id = auth.uid() then raise exception 'อนุมัติใบของตัวเองไม่ได้'; end if;
  if r.status <> 'pending_manager' then raise exception 'ใบนี้ไม่ได้รอผู้จัดการแล้ว'; end if;

  if p_approve then
    update public.expense_claims
       set status = 'pending_finance', manager_id = auth.uid(), manager_at = now()
     where id = p_id;
  else
    if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'ต้องใส่เหตุผลที่ไม่อนุมัติ'; end if;
    update public.expense_claims
       set status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), rejected_reason = trim(p_reason)
     where id = p_id;
  end if;
end;
$$;

create or replace function public.expense_finance_decide(
  p_id uuid, p_approve boolean, p_reason text default null,
  p_payout text default null, p_payroll_month date default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.expense_claims%rowtype;
  v_payout text;
begin
  if not public.is_finance() then raise exception 'เฉพาะฝ่ายบัญชี/HR'; end if;
  select * into r from public.expense_claims where id = p_id for update;
  if not found then raise exception 'ไม่พบใบเบิก'; end if;
  if r.user_id = auth.uid() then raise exception 'อนุมัติใบของตัวเองไม่ได้'; end if;
  if r.status <> 'pending_finance' then raise exception 'ใบนี้ไม่ได้รอฝ่ายบัญชี'; end if;

  if not p_approve then
    if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'ต้องใส่เหตุผลที่ไม่อนุมัติ'; end if;
    update public.expense_claims
       set status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), rejected_reason = trim(p_reason)
     where id = p_id;
    return;
  end if;

  v_payout := coalesce(p_payout, r.payout);
  if v_payout not in ('payroll', 'transfer') then raise exception 'วิธีจ่ายไม่ถูกต้อง'; end if;
  if v_payout = 'payroll' and p_payroll_month is null then raise exception 'ต้องระบุงวดเงินเดือน'; end if;

  update public.expense_claims
     set status = 'approved', finance_id = auth.uid(), finance_at = now(),
         payout = v_payout,
         payroll_month = case when v_payout = 'payroll' then date_trunc('month', p_payroll_month)::date end
   where id = p_id;
end;
$$;

revoke all on function public.expense_manager_decide(uuid, boolean, text) from public, anon;
revoke all on function public.expense_finance_decide(uuid, boolean, text, text, date) from public, anon;
grant execute on function public.expense_manager_decide(uuid, boolean, text) to authenticated;
grant execute on function public.expense_finance_decide(uuid, boolean, text, text, date) to authenticated;
grant execute on function public.is_finance() to authenticated;

-- ── รูปใบเสร็จ ────────────────────────────────────────────────────────
-- เอกสารบัญชี — ไม่อยู่ใน FOOTAGE_BUCKETS ของ cron ลบรูปเก่า (storageCapRules.ts)
insert into storage.buckets (id, name, public) values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

create policy "ใบเสร็จ: อัปโหลดของตัวเอง" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'expense-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ใบเสร็จ: ดูของตัวเองหรือคนอนุมัติ" on storage.objects
  for select to authenticated
  using (bucket_id = 'expense-receipts'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.can_view_all() or public.is_finance()));

-- สลิปโอนเงินที่ฝ่ายบัญชีแนบ เก็บใต้โฟลเดอร์ของพนักงานคนนั้น
create policy "ใบเสร็จ: บัญชีแนบสลิป" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'expense-receipts' and public.is_finance());

-- ── หน้าเงินเดือน: ช่องเบิกคืน ──────────────────────────────────────────
-- แยกจาก "พิเศษ" — เงินคืนค่าใช้จ่ายไม่ใช่รายได้ · ยอดรวมต้องบวกด้วย
alter table public.payroll_entries add column if not exists reimbursement numeric not null default 0;
alter table public.payroll_entries drop column total;
alter table public.payroll_entries add column total numeric generated always as
  (base_salary + round(ot_hours * ot_rate, 2) + commission + extra + reimbursement - deduction) stored;
