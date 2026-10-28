-- created_at แบบ clock_timestamp — หลายรายการในทรานแซกชันเดียวกันยังเรียงลำดับได้
-- (task_update_is_latest ใช้ created_at ตัดสินว่ารายการไหนล่าสุด)
alter table public.task_updates alter column created_at set default clock_timestamp();
