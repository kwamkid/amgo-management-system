-- ลำดับการ์ดในบอร์ดงาน (ลากวาง) — 28 ต.ค. 69
alter table public.tasks add column sort_order double precision not null default 0;
comment on column public.tasks.sort_order is
  'ลำดับในคอลัมน์ของบอร์ด (น้อยอยู่บน) — ลากวางแล้วตั้งเป็นค่ากลางระหว่างการ์ดข้างเคียง';
