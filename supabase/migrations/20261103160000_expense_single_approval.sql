-- ใบเบิก: อนุมัติรอบเดียวโดยฝ่ายบัญชี — ตัดขั้นผู้จัดการ (เจ้าของ 3 พ.ย. 69)
--
-- เดิม: ยื่น → ผู้จัดการ → บัญชี · ใหม่: ยื่น → บัญชีอนุมัติ → ส่งไฟล์ SCB → เจ้าของ approve ในแอปธนาคาร → บัญชีแนบสลิป
-- ใบใหม่เริ่มที่ pending_finance เลย · ค่า pending_manager ยังอยู่ใน check constraint (ข้อมูลเก่า/ย้อนดู)
-- expense_manager_decide() ไม่มีหน้าจอเรียกแล้ว — คงไว้ไม่ลบ

alter table public.expense_claims alter column status set default 'pending_finance';

-- ใบที่ค้างรอผู้จัดการอยู่ ย้ายไปรอบัญชี
update public.expense_claims set status = 'pending_finance' where status = 'pending_manager';

drop policy if exists expense_claims_insert_own on public.expense_claims;
create policy expense_claims_insert_own on public.expense_claims
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending_finance');

-- แก้/ยกเลิกใบตัวเองได้จนกว่าบัญชีจะอนุมัติ — ยกเลิกได้อย่างเดียว ไปสถานะอื่นไม่ได้
drop policy if exists expense_claims_update_own_pending on public.expense_claims;
create policy expense_claims_update_own_pending on public.expense_claims
  for update to authenticated
  using (user_id = auth.uid() and status = 'pending_finance')
  with check (user_id = auth.uid() and status in ('pending_finance', 'cancelled'));
