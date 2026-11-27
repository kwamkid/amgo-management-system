-- หมวดใบเบิก = หมวดบัญชี (รหัสผังบัญชี) + หมวดย่อยไว้ดูสถิติ (เจ้าของ 27 พ.ย. 69)
--
-- เดิม category = 7 ช่องของฟอร์ม Excel "EXPENSES REIMBURSEMENT" ของบัญชี
-- ใหม่: category = หมวดย่อยที่พนักงานเลือก (14 ค่า) · account_code = หมวดบัญชี (รหัสผังบัญชี เช่น 5200-09)
-- account_code null = ยังไม่ระบุ ("อื่น ๆ" รอบัญชีเลือกรหัส) — แอปถอยไปใช้รหัสตั้งต้นของหมวดย่อยถ้ามี
-- ไม่มี RPC ตัวไหนเขียน/อ่าน category (expense_*_decide แตะแค่สถานะ) → ไม่ต้องสร้างฟังก์ชันใหม่

alter table public.expense_claims drop constraint if exists expense_claims_category_check;

-- ค่าเดิม → หมวดย่อยใหม่ (phone · shipping · supplies · other ชื่อเดิม)
update public.expense_claims set category = case category
    when 'travel' then 'taxi'
    when 'parking' then 'toll'
    when 'fuel' then 'gas'
    when 'meal' then 'entertain'
    else category
  end
where category in ('travel', 'parking', 'fuel', 'meal');

alter table public.expense_claims add constraint expense_claims_category_check
  check (category in (
    'taxi', 'toll', 'gas', 'entertain', 'shipping', 'promo', 'ads', 'packaging',
    'stationery', 'supplies', 'repair', 'phone', 'welfare', 'other',
    -- legacy keys: the previous app build still sends these until the new code deploys
    -- (run this migration first, then deploy) — the app maps them via formSectionOf()
    'travel', 'parking', 'fuel', 'meal'
  ));

alter table public.expense_claims
  add column if not exists account_code text
    constraint expense_claims_account_code_format
    check (account_code is null or account_code ~ '^[0-9]{4}-[0-9]{2}$');

comment on column public.expense_claims.category is
  'หมวดย่อย (ไว้ดูสถิติ) ที่พนักงานเลือก — ACCOUNT_GROUPS ใน lib/services/expenseRules.ts';
comment on column public.expense_claims.account_code is
  'หมวดบัญชี = รหัสผังบัญชี (เช่น 5200-09) · null = ยังไม่ระบุ (อื่น ๆ รอบัญชีเลือก)';

-- ใบเก่า: ใส่รหัสบัญชีตามหมวดย่อย (ตรงกับ ACCOUNT_GROUPS)
update public.expense_claims set account_code = case category
    when 'taxi' then '5200-09'
    when 'toll' then '5200-09'
    when 'gas' then '5200-09'
    when 'entertain' then '5200-06'
    when 'shipping' then '5200-05'
    when 'promo' then '5200-04'
    when 'ads' then '5200-02'
    when 'packaging' then '5200-12'
    when 'stationery' then '5320-01'
    when 'supplies' then '5320-03'
    when 'repair' then '5320-02'
    when 'phone' then '5330-05'
    when 'welfare' then '5310-17'
    else null
  end
where account_code is null;
