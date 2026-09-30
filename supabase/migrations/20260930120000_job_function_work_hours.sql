-- เวลาทำงานของตำแหน่ง (30 ก.ย. 69)
--
-- คนไม่มีกะ (ทุกตำแหน่งยกเว้น PC) ใช้ "เวลาปกติ" 08:30/09:00–17:30/18:00 หมด
-- (fixedScheduleRules.ts) แต่ฝ่ายผลิต (Min/แตน) เข้าตี 4 เลิก 15:00 จริง —
-- ลืมเช็คเอาท์แล้ว cron ปิดให้ที่ 17:30 และเลิก 15:00 ตามปกติถูกมองว่าออกก่อนเวลา
--
-- ตั้งทั้งคู่ = ใช้เวลานี้แทนเวลาปกติ · ว่าง = เหมือนเดิม
alter table public.job_functions
  add column if not exists work_start_time time,
  add column if not exists work_end_time time;

alter table public.job_functions
  add constraint job_functions_work_hours_pair
  check ((work_start_time is null) = (work_end_time is null));

update public.job_functions
   set work_start_time = '04:00', work_end_time = '15:00'
 where code = 'production';
