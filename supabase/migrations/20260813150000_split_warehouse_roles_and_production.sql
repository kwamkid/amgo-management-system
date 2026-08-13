-- แยกสิทธิ์สายคลังออกจากคนขับรถ + เพิ่มตำแหน่งพนักงานฝ่ายผลิต
--
-- เจ้าของสั่ง 13 ส.ค. 69: "มันต้องแยกสิทธิกัน" — เดิมหัวหน้าคลัง/จัดของ/โลจิสติกส์
-- ได้ role driver เหมือนคนขับ ป้ายสิทธิ์เลยขึ้น "พนักงานขับรถ" ทั้งที่ไม่ได้ขับ
-- ตรวจข้อมูลจริง: คนที่เช็คอินส่งของมีแค่ตำแหน่งพนักงานขับรถ — ตัด role driver
-- จากสายคลังได้โดยไม่กระทบใคร แต่ยังให้เห็นเมนูงานส่งของผ่านธง sees_delivery
-- (กลไกเดียวกับ Call Center)

update public.job_functions
   set default_role = 'employee',
       sees_delivery = (code in ('warehouse_lead', 'packer'))
 where code in ('warehouse_lead', 'packer', 'warehouse');

-- คนที่ถือตำแหน่งพวกนี้อยู่ ปรับ role ตาม default ใหม่
update public.users u
   set role = 'employee'
  from public.job_functions jf
 where jf.id = u.job_function_id
   and jf.code in ('warehouse_lead', 'packer', 'warehouse')
   and u.role = 'driver';

-- ตำแหน่งใหม่: พนักงานฝ่ายผลิต — โครงเดียวกับพนักงานจัดของ (6 วัน หยุดอาทิตย์ ไม่มี OT)
insert into public.job_functions
  (code, name_th, schedule_type, default_days_per_week, coverage_days_per_week,
   payroll_cycle, sort_order, default_role, ot_eligible)
values
  ('production', 'พนักงานฝ่ายผลิต', 'fixed', 6, 6, 'c28', 17, 'employee', false)
on conflict (code) do update
  set name_th = excluded.name_th, default_role = excluded.default_role,
      sort_order = excluded.sort_order, is_active = true;

update public.job_functions set sort_order = 18 where code = 'driver';

insert into public.job_function_work_days (job_function_id, day_of_week, work_mode)
select jf.id, d.dow, case when d.dow = 0 then 'off' else 'onsite' end
from public.job_functions jf
cross join (select generate_series(0, 6) as dow) d
where jf.code = 'production'
on conflict do nothing;
