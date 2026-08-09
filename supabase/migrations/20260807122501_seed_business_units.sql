-- ═══════════════════════════════════════════════════════════════════
-- สร้างหน่วยงานจริง (ร่างจาก 13 สาขา + ข้อมูลที่เจ้าของระบบให้)
--
-- ⚠️ บางส่วนเป็นการอนุมานจากชื่อ/ที่ตั้ง ต้องให้เจ้าของตรวจ:
--    · ทุกสาขาห้าง/ABC → AGD และรอบเงินเดือน c4
--    · ออฟฟิศ/คลัง → รอบ c28
--    · บ้านขวัญ ยังไม่รู้ว่าบริษัทไหน เดาเป็น AGD
--    · IMPACT ออกบูธ ใช้ทีมขาย เดาเป็น c4
-- (ข้อ 2-4 แก้แล้วใน migration ถัดไป business_unit_schedule_corrections)
-- ═══════════════════════════════════════════════════════════════════

insert into business_units
  (company_id, location_id, name, unit_type, schedule_type, default_days_per_week,
   standard_hours_per_day, payroll_cycle)
select c.id, l.id, v.unit_name, v.unit_type, v.sched, v.dpw, 8, v.cycle
from (values
  -- วังเด็ก 1 สถานที่ = 3 หน่วยงาน 2 บริษัท
  ('AGD', 'วังเด็ก',                     'ออฟฟิศ AGD',        'office',    'fixed',    null, 'c28'),
  ('AGD', 'วังเด็ก',                     'ABC วังเด็ก',        'shop',      'rotating',    5, 'c4'),
  ('ADF', 'วังเด็ก',                     'ออฟฟิศ ADF',        'office',    'rotating',    6, 'c28'),
  -- คลังสินค้า
  ('AGD', 'คลังหลัก พระราม 2',            'คลังหลัก พระราม 2',  'warehouse', 'fixed',    null, 'c28'),
  ('ADF', 'โกดังใหม่ตลาดไท',              'โกดังใหม่ตลาดไท',    'warehouse', 'fixed',    null, 'c28'),
  -- ร้าน ABC
  ('AGD', 'ABC @Rama 2',                 'ABC พระราม 2',      'shop',      'rotating',    5, 'c4'),
  ('AGD', 'ABC สาขา Mega',               'ABC Mega',          'shop',      'rotating',    5, 'c4'),
  ('AGD', 'ABC สาขา Icon Siam',          'ABC Icon Siam',     'shop',      'rotating',    5, 'c4'),
  -- เคาน์เตอร์ห้าง (PC)
  ('AGD', 'Siam Paragon',                'Siam Paragon',      'shop',      'rotating',    5, 'c4'),
  ('AGD', 'Central World',               'Central World',     'shop',      'rotating',    5, 'c4'),
  ('AGD', 'Central Chidlom',             'Central Chidlom',   'shop',      'rotating',    5, 'c4'),
  ('AGD', 'Emporium',                    'Emporium',          'shop',      'rotating',    5, 'c4'),
  -- ออกบูธ
  ('AGD', 'IMPACT, Muang Thong Thani,',  'ออกบูธ IMPACT',      'shop',      'rotating',    5, 'c4'),
  -- จุดทำงานที่บ้านพนักงาน
  ('ADF', 'บ้านปู ADF',                  'ADF บ้านปู',         'office',    'rotating',    6, 'c28'),
  ('AGD', 'บ้านขวัญ',                    'จุดทำงานบ้านขวัญ',   'office',    'rotating',    5, 'c28')
) as v(co, loc_name, unit_name, unit_type, sched, dpw, cycle)
join companies c on c.code = v.co
join locations l on l.name = v.loc_name
on conflict (company_id, name) do nothing;

-- ออฟฟิศ AGD เข้า อังคาร(2) พฤหัส(4) ศุกร์(5) — ที่เหลือหยุด
insert into business_unit_work_days (business_unit_id, day_of_week, work_mode)
select bu.id, d.dow, d.mode
from business_units bu
cross join (values (0,'off'),(1,'off'),(2,'onsite'),(3,'off'),(4,'onsite'),(5,'onsite'),(6,'off'))
  as d(dow, mode)
where bu.name = 'ออฟฟิศ AGD'
on conflict do nothing;

-- คลังสินค้าทั้ง 2 แห่ง — จันทร์ถึงศุกร์
insert into business_unit_work_days (business_unit_id, day_of_week, work_mode)
select bu.id, d.dow, d.mode
from business_units bu
cross join (values (0,'off'),(1,'onsite'),(2,'onsite'),(3,'onsite'),(4,'onsite'),(5,'onsite'),(6,'off'))
  as d(dow, mode)
where bu.unit_type = 'warehouse'
on conflict do nothing;
