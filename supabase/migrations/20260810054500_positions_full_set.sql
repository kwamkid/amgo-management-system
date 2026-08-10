-- เติมตำแหน่งให้ครบตามโครงจริงของบริษัท
--
-- โลจิสติกส์แบบเหมารวมแยกกลับเป็น 3 ตำแหน่ง (หัวหน้าคลัง · จัดของ · ขับรถ)
-- เพราะจะใช้ออกใบรับรองเงินเดือน/สัญญาจ้าง — ชื่อตำแหน่งต้องตรงกับงานจริง
-- ทำได้เพราะยังไม่มีใครถูกผูกตำแหน่ง (ตรวจแล้ว 0 คน)

update public.job_functions
   set is_active = true, name_th = 'พนักงานขับรถ', default_role = 'driver', sort_order = 16
 where code = 'driver';

update public.job_functions set is_active = false where code = 'warehouse';

insert into public.job_functions
  (code, name_th, schedule_type, default_days_per_week, coverage_days_per_week, payroll_cycle, sort_order, default_role)
values
  ('accountant',         'บัญชี',              'fixed', 5, 5, 'c28',  5, 'employee'),
  ('purchasing',         'จัดซื้อ',            'fixed', 5, 5, 'c28',  6, 'employee'),
  ('platform_marketing', 'Platform Marketing', 'fixed', 5, 5, 'c28',  8, 'marketing'),
  ('vdo_production',     'VDO Production',     'fixed', 5, 5, 'c28', 11, 'employee'),
  ('sales',              'พนักงานขาย',         'fixed', 5, 5, 'c28', 12, 'employee'),
  ('warehouse_lead',     'หัวหน้าคลังสินค้า',  'fixed', 6, 6, 'c28', 14, 'driver'),
  ('packer',             'พนักงานจัดของ',      'fixed', 6, 6, 'c28', 15, 'driver')
on conflict (code) do update
  set name_th = excluded.name_th, default_role = excluded.default_role,
      sort_order = excluded.sort_order, is_active = true;

update public.job_functions set sort_order = 4  where code = 'callcenter';
update public.job_functions set sort_order = 7  where code = 'marketing';
update public.job_functions set sort_order = 9  where code = 'brand_manager';
update public.job_functions set sort_order = 10 where code = 'graphic';
update public.job_functions set sort_order = 13 where code = 'shop';

insert into public.job_function_work_days (job_function_id, day_of_week, work_mode)
select jf.id, d.dow,
       case
         when d.dow = 0 then 'off'
         when d.dow = 6 and jf.code not in ('warehouse_lead','packer') then 'off'
         else 'onsite'
       end
from public.job_functions jf
cross join (select generate_series(0,6) as dow) d
where jf.code in ('accountant','purchasing','platform_marketing','vdo_production','sales','warehouse_lead','packer')
on conflict do nothing;
