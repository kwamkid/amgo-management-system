-- Tax invoice number (เลขที่ใบกำกับภาษี) on expense claims — owner 27 Nov 2026
-- Staff can fill it when submitting or any time later (even after approval/payment);
-- finance can set it too. The RPC only touches this one column.

alter table public.expense_claims add column if not exists tax_invoice_no text;

create or replace function public.set_expense_tax_invoice_no(p_id uuid, p_no text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.expense_claims
     set tax_invoice_no = nullif(btrim(p_no), '')
   where id = p_id
     and status <> 'cancelled'
     and (user_id = auth.uid() or public.is_finance());
  if not found then
    raise exception 'แก้เลขที่ใบกำกับภาษีไม่ได้ (ไม่ใช่ใบของคุณหรือใบถูกยกเลิกแล้ว)';
  end if;
end;
$$;

revoke all on function public.set_expense_tax_invoice_no(uuid, text) from public;
grant execute on function public.set_expense_tax_invoice_no(uuid, text) to authenticated;
