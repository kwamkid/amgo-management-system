-- บันทึกการแก้รายได้พิเศษลง audit_log ด้วย
--
-- user_compensation มี trigger อยู่แล้ว แต่ user_pay_items เพิ่งสร้างเลยตกไป
-- ทั้งสองอย่างคือเงินของพนักงาน ต้องรู้ว่าใครแก้เมื่อไหร่จากอะไรเป็นอะไร

drop trigger if exists user_pay_items_audit on public.user_pay_items;
create trigger user_pay_items_audit
  after insert or update or delete on public.user_pay_items
  for each row execute function public.trg_audit();
