-- ตำแหน่งไหนเห็นเมนูงานส่งของบ้าง — นอกเหนือจาก role driver/admin/hr ที่เห็นอยู่แล้ว
-- เคสแรกคือ Call Center: role เป็น employee ธรรมดา แต่ต้องดูสรุปงานส่ง + แผนที่คนขับ
-- เพื่อประสานงานลูกค้า (เจ้าของสั่ง 11 ส.ค. 69: "call center ต้องเห็นเมนูส่งของ")

alter table public.job_functions
  add column if not exists sees_delivery boolean not null default false;

update public.job_functions set sees_delivery = true where name_th = 'Call Center';

comment on column public.job_functions.sees_delivery is
  'ตำแหน่งนี้เห็นเมนู Delivery Tracking แม้ role ไม่ใช่ driver/admin/hr';
