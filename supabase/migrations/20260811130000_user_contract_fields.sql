-- สัญญาจ้างต้องระบุตัวลูกจ้างตามกฎหมาย: เลขบัตรประชาชน + ที่อยู่
-- กรอกที่หน้าแก้ไขพนักงาน แท็บข้อมูล — ใช้พิมพ์ในสัญญาทดลองงาน/สัญญาจ้างรายปี

alter table public.users add column if not exists national_id text;
alter table public.users add column if not exists address text;

comment on column public.users.national_id is 'เลขบัตรประชาชน 13 หลัก — ใช้ในสัญญาจ้าง';
comment on column public.users.address is 'ที่อยู่ตามบัตร/ที่ติดต่อได้ — ใช้ในสัญญาจ้าง';
