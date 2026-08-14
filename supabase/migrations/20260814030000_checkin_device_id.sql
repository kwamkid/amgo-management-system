-- รหัสเครื่องที่ใช้กดเช็คอิน — จับเคสมือถือเครื่องเดียวเช็คอินให้หลายคน
-- (เจ้าของสั่ง 14 ส.ค. 69 — ดัก "ให้คนอื่น login เครื่องแทนกัน")
alter table public.checkins
  add column device_id text;

create index checkins_device_date on public.checkins (device_id, work_date)
  where device_id is not null;
