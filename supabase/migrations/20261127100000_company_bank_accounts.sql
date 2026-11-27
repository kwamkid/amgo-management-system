-- บัญชีธนาคารของบริษัท (หลายบัญชี หลายธนาคาร) — dropdown "บัญชีตัดเงิน" ตอนส่งออกไฟล์โอน · 27 พ.ย. 69
--
-- เดิมเก็บได้บัญชีเดียว companies.scb_debit_account · เจ้าของอยากให้เลือกได้ เผื่อมีบัญชี/ธนาคารอื่นเพิ่ม
-- ไฟล์ CPX ตอนนี้ตัดเงินได้เฉพาะบัญชี SCB (แอปแสดงบัญชีธนาคารอื่นแต่เลือกไม่ได้จนกว่าจะมีไฟล์ของธนาคารนั้น)
-- companies.scb_debit_account ยังใช้อยู่ = บัญชี SCB ที่ใช้ล่าสุด (หน้ายื่นใบเบิก/รายละเอียดใบโชว์)
-- เพิ่ม/ลบได้เฉพาะ is_finance() ผ่านฟังก์ชัน · อ่านได้ทุกคนที่ล็อกอิน (เหมือน companies)

create table public.company_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bank text not null,                      -- รหัสใน lib/constants/banks.ts: SCB, KBANK …
  account_no text not null check (account_no ~ '^[0-9]{10,15}$'),
  label text,                              -- ชื่อเรียก เช่น "บัญชีหลัก", "บัญชีเงินเดือน"
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  unique (company_id, bank, account_no)
);

create index company_bank_accounts_company_idx on public.company_bank_accounts(company_id);

alter table public.company_bank_accounts enable row level security;

create policy company_bank_accounts_read on public.company_bank_accounts
  for select to authenticated using (true);

-- ย้ายบัญชี SCB เดิมเข้าตาราง
insert into public.company_bank_accounts (company_id, bank, account_no, label)
select id, 'SCB', scb_debit_account, 'บัญชีหลัก'
  from public.companies
 where scb_debit_account is not null
on conflict do nothing;

create or replace function public.add_company_bank_account(
  p_company_id uuid, p_bank text, p_account text, p_label text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_acc text := regexp_replace(coalesce(p_account, ''), '[^0-9]', '', 'g');
  v_id uuid;
begin
  if not public.is_finance() then raise exception 'เฉพาะฝ่ายบัญชี/HR'; end if;
  if v_acc !~ '^[0-9]{10,15}$' then raise exception 'เลขบัญชีต้องเป็นตัวเลข 10–15 หลัก'; end if;
  if coalesce(trim(p_bank), '') = '' then raise exception 'เลือกธนาคาร'; end if;
  insert into public.company_bank_accounts (company_id, bank, account_no, label, created_by)
  values (p_company_id, trim(p_bank), v_acc, nullif(trim(coalesce(p_label, '')), ''), auth.uid())
  on conflict (company_id, bank, account_no) do update set label = coalesce(excluded.label, public.company_bank_accounts.label)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.delete_company_bank_account(p_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.is_finance() then raise exception 'เฉพาะฝ่ายบัญชี/HR'; end if;
  delete from public.company_bank_accounts where id = p_id;
end;
$$;

revoke all on function public.add_company_bank_account(uuid, text, text, text) from public, anon;
revoke all on function public.delete_company_bank_account(uuid) from public, anon;
grant execute on function public.add_company_bank_account(uuid, text, text, text) to authenticated;
grant execute on function public.delete_company_bank_account(uuid) to authenticated;
