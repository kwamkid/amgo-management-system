-- ค่าตอบแทนข้ามบริษัท — พนักงานสังกัดบริษัทเดียว (เงินเดือน/OT อยู่ต้นสังกัด)
-- แต่รายได้พิเศษบางรายการอาจจ่ายจากอีกบริษัท (เช่น อยู่ AGD แต่ได้ค่าคอมจาก ADF)
--
-- ผลกับ payroll: งวดจ่ายแตกเป็นรายบริษัท — แถวหลักของต้นสังกัด (เงินเดือน/OT/วันมา-ขาด)
-- + แถวเสริมของบริษัทอื่นที่จ่ายเฉพาะค่าคอม/เงินพิเศษ → กรอง/export ไฟล์ธนาคารแยกบริษัทได้

alter table public.user_pay_items
  add column if not exists company_id uuid references public.companies(id);

comment on column public.user_pay_items.company_id is
  'บริษัทผู้จ่ายรายการนี้ — null = บริษัทต้นสังกัดของพนักงาน';

alter table public.payroll_entries
  add column if not exists company_id uuid references public.companies(id);

comment on column public.payroll_entries.company_id is
  'งวดจ่ายของบริษัทไหน — แถวต้นสังกัดมีเงินเดือน/OT · แถวบริษัทอื่นมีแค่ค่าคอม/พิเศษ/หัก';

-- แถวเก่าทั้งหมดเป็นงวดของบริษัทต้นสังกัด
update public.payroll_entries p
set company_id = u.company_id
from public.users u
where u.id = p.user_id and p.company_id is null;

-- เดิม unique ต่อ (เดือน, คน) — ตอนนี้คนเดียวมีได้หลายงวดตามบริษัท
-- nulls not distinct: คนที่ยังไม่มีต้นสังกัด (company_id null) ก็ยังห้ามซ้ำ
alter table public.payroll_entries drop constraint payroll_entries_month_user_id_key;
alter table public.payroll_entries
  add constraint payroll_entries_month_user_company_key
  unique nulls not distinct (month, user_id, company_id);
