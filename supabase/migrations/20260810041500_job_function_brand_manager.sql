-- เพิ่มตำแหน่ง Brand Manager
--
-- ตั้งเป็นตารางคงที่ จันทร์–ศุกร์ เข้าที่ทำงาน แบบเดียวกับการตลาด
-- (ออฟฟิศมี WFH จันทร์กับพุธ ซึ่งเป็นข้อตกลงของทีมออฟฟิศโดยเฉพาะ
--  ตำแหน่งนี้เลยไม่เอาไปด้วย — ถ้าจริง ๆ ได้ WFH ด้วย HR แก้ตารางได้)

insert into public.job_functions
  (code, name_th, schedule_type, default_days_per_week, coverage_days_per_week, payroll_cycle, sort_order)
values
  ('brand_manager', 'Brand Manager', 'fixed', 5, 5, 'c28', 7)
on conflict (code) do nothing;

insert into public.job_function_work_days (job_function_id, day_of_week, work_mode)
select jf.id, d.dow, case when d.dow in (0, 6) then 'off' else 'onsite' end
from public.job_functions jf
cross join (select generate_series(0,6) as dow) d
where jf.code = 'brand_manager'
on conflict do nothing;
