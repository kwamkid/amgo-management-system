-- ใครได้ค่าล่วงเวลา (OT) บ้าง — ตอนนี้มีเฉพาะพนักงานขายหน้าร้าน (PC)
--
-- เป็นสิทธิ์ของตำแหน่งเหมือน role/รอบจ่าย: ติ๊กที่ job_functions แล้วทั้งตำแหน่งได้ตาม
-- ยกเว้นรายคนได้ที่ users.ot_eligible (null = ตามตำแหน่ง · true/false = ทับค่าตำแหน่ง)
--
-- ชั่วโมง OT ใน checkins ยังบันทึกตามจริงทุกคน — สิทธิ์นี้คุมแค่ว่า
-- หน้าสรุปเงินเดือนจะเติมชั่วโมง OT ให้อัตโนมัติหรือไม่ (HR พิมพ์เองได้เสมอ)

alter table public.job_functions
  add column if not exists ot_eligible boolean not null default false;

update public.job_functions
  set ot_eligible = true
  where name_th = 'พนักงานขายหน้าร้าน (PC)';

alter table public.users
  add column if not exists ot_eligible boolean;

comment on column public.job_functions.ot_eligible is 'ตำแหน่งนี้ได้ค่าล่วงเวลาไหม — ค่าตั้งต้นของทุกคนในตำแหน่ง';
comment on column public.users.ot_eligible is 'ทับค่าตำแหน่งรายคน: null = ตามตำแหน่ง';
