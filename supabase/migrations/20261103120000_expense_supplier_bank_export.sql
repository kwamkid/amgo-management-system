-- ใบเบิก: จ่าย supplier + ไฟล์โอน SCB + สรุปสิ้นเดือนตามฟอร์ม EXPENSES REIMBURSEMENT — 3 พ.ย. 69
--
-- เจ้าของ: ค่าใช้จ่ายมี 2 แบบ
--   1. reimburse = พนักงานออกไปก่อน → แนบใบเสร็จ/สลิปที่ตัวเองโอน → บริษัทคืนให้
--   2. supplier  = ให้บริษัทโอนจ่าย supplier ตรง (ค่า operation · จ้างผลิตโปสเตอร์) → แนบใบวางบิล/ใบแจ้งหนี้
-- ทั้งสองแบบผ่านขั้นอนุมัติเดิม (ผู้จัดการ → บัญชี) · supplier โอนเสมอ ไม่รวมเงินเดือน
-- บัญชีส่งออกรายการรอโอนเป็นไฟล์เข้า SCB (exported_at กันโอนซ้ำ) แล้วบันทึกจ่ายพร้อมสลิป
--
-- ช่องเพิ่มเติมตามฟอร์มบัญชี (z/Reimbursement.xlsx): ต้นทาง/ปลายทาง/ระยะทางของค่าแท็กซี่ ·
-- วัตถุประสงค์/ผู้ร่วมของค่ารับรอง · VAT 7% · หมวดใหม่ "ค่าโทรศัพท์"

alter table public.expense_claims
  add column kind text not null default 'reimburse' check (kind in ('reimburse', 'supplier')),
  -- บัญชีรับเงินของ supplier (reimburse ใช้บัญชีของพนักงานใน users)
  add column payee_name text,
  add column payee_bank text,
  add column payee_account_no text,
  add column route_from text,
  add column route_to text,
  add column distance_km numeric(8, 2) check (distance_km is null or distance_km >= 0),
  -- ค่ารับรอง: วัตถุประสงค์ทางธุรกิจ · ผู้ร่วม/ความสัมพันธ์ทางธุรกิจ
  add column purpose text,
  add column attendees text,
  -- ยอด amount รวม VAT แล้ว · 0 = ไม่มีใบกำกับภาษี
  add column vat_amount numeric(12, 2) not null default 0 check (vat_amount >= 0),
  add column exported_at timestamptz,
  add column exported_by uuid references public.users(id);

alter table public.expense_claims drop constraint expense_claims_category_check;
alter table public.expense_claims add constraint expense_claims_category_check
  check (category in ('travel', 'fuel', 'parking', 'meal', 'phone', 'supplies', 'shipping', 'other'));

alter table public.expense_claims add constraint expense_claims_vat_le_amount
  check (vat_amount < amount);

-- supplier: โอนเสมอ · ต้องมีบัญชีปลายทาง · ต้องแนบใบวางบิล/ใบแจ้งหนี้ (ไม่มีทางเลือก "ไม่มีใบเสร็จ")
alter table public.expense_claims add constraint expense_claims_supplier_fields
  check (kind <> 'supplier' or (
    payout = 'transfer'
    and length(trim(coalesce(payee_name, ''))) > 0
    and length(trim(coalesce(payee_bank, ''))) > 0
    and length(trim(coalesce(payee_account_no, ''))) > 0
    and cardinality(receipt_paths) > 0
  ));

-- รายการรอโอนที่ยังไม่ส่งออก — แท็บรอโอน
create index expense_claims_to_transfer_idx on public.expense_claims (exported_at)
  where status = 'approved' and payout = 'transfer';

-- สรุปสิ้นเดือน: ดึงตามเดือนของวันที่จ่าย/วันที่ใบแจ้งหนี้
create index expense_claims_month_idx on public.expense_claims (expense_date)
  where status in ('approved', 'paid');

-- สลิปโอนทั้งชุด (SCB โอนหลายรายการ = สลิป/รายงานใบเดียว) อัปโหลดลงโฟลเดอร์ของเจ้าของใบทุกคน
-- policy "ใบเสร็จ: บัญชีแนบสลิป" เดิมครอบแล้ว — พนักงานยังเห็นสลิปของใบตัวเองได้ตาม policy select เดิม
