-- ═══════════════════════════════════════════════════════════════════════
-- ใครอนุมัติโอที และอนุมัติเมื่อไหร่
--
-- ของเดิมเก็บ overtimeApproved / manualCheckoutBy / manualCheckoutAt
-- ตอนย้าย schema ตกไป — แต่นี่คือ "การตัดสินใจเรื่องเงิน" ต้องรู้ว่าใครกด
-- (needs_overtime_approval บอกได้แค่ว่า "รออนุมัติ" ไม่ได้บอกผลและคนอนุมัติ)
-- ═══════════════════════════════════════════════════════════════════════

alter table checkins
  add column if not exists overtime_approved boolean not null default false,
  add column if not exists manual_checkout_by uuid references users(id) on delete set null,
  add column if not exists manual_checkout_at timestamptz;

comment on column checkins.overtime_approved is
  'HR อนุมัติชั่วโมงโอทีแล้ว — ถ้า false ชั่วโมงที่เกินเวลาปิดจะไม่ถูกนับเป็นโอที';
comment on column checkins.manual_checkout_by is
  'ใครเป็นคนปิดกะให้ (ตอน manual_checkout = true)';

-- ปิดกะให้คนอื่นต้องรู้ว่าใครทำ
alter table checkins drop constraint if exists manual_checkout_needs_actor;
alter table checkins add constraint manual_checkout_needs_actor
  check (not manual_checkout or manual_checkout_by is not null)
  not valid;  -- ข้อมูลเก่าที่ย้ายมาไม่มีคนทำ จึงไม่ย้อนตรวจ
