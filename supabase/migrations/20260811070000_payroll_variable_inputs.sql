-- ค่าตอบแทนผันแปร (ค่าคอมขั้นบันได/ค่าชิ้นงาน) ต้องมียอดตั้งต้นของแต่ละเดือน
-- HR กรอกยอดขาย/จำนวนชิ้นใน dialog ของหน้าสรุปเงินเดือน ระบบคำนวณเป็นค่าคอมให้
-- เก็บยอดที่กรอกไว้กับงวดนั้น — เปิดเดือนเก่าแล้วตอบได้ว่าเลขค่าคอมมาจากยอดไหน

alter table public.payroll_entries
  add column if not exists variable_inputs jsonb;

comment on column public.payroll_entries.variable_inputs is
  '{user_pay_items.id: ยอดที่กรอก} — ยอดขาย (บาท) สำหรับค่าคอมขั้นบันได · จำนวนชิ้นสำหรับค่าชิ้นงาน';
