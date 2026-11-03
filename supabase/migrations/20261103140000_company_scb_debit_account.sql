-- บัญชี SCB ต้นทาง (บัญชีตัดเงิน) ของแต่ละบริษัท — ไฟล์โอน SCB CPX ของใบเบิก/จ่าย supplier · 3 พ.ย. 69
--
-- ไฟล์ CPX ต้องมีบัญชีตัดเงิน 1 บัญชีต่อไฟล์ (บรรทัด BCHDET) · คนละบริษัทคนละบัญชี
-- companies แก้ได้เฉพาะ HR/แอดมิน (policy companies_manage) แต่คนตั้งบัญชีนี้คือฝ่ายบัญชี
-- → ให้แก้คอลัมน์เดียวผ่านฟังก์ชันที่ตรวจ is_finance()
-- เลขบัญชี SCB = ตัวเลข 10 หลัก (ตรวจ check digit ฝั่งแอป — lib/services/bankTransferFile.ts)

alter table public.companies
  add column scb_debit_account text check (scb_debit_account is null or scb_debit_account ~ '^[0-9]{10}$');

create or replace function public.set_company_scb_debit_account(p_company_id uuid, p_account text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.is_finance() then raise exception 'เฉพาะฝ่ายบัญชี/HR'; end if;
  update public.companies
     set scb_debit_account = nullif(regexp_replace(coalesce(p_account, ''), '[^0-9]', '', 'g'), '')
   where id = p_company_id;
  if not found then raise exception 'ไม่พบบริษัท'; end if;
end;
$$;

revoke all on function public.set_company_scb_debit_account(uuid, text) from public, anon;
grant execute on function public.set_company_scb_debit_account(uuid, text) to authenticated;
