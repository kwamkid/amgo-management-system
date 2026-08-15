-- งาน "ตรวจปลั๊กอิน" แยกจาก "อัปเดตปลั๊กอิน" — ดูอย่างเดียว ไม่แตะเว็บ
-- ปลอดภัยพอให้ cron รันทั้งฟลีตทุกคืนได้ ต่างจาก plugin_update ที่แก้ของจริง
-- (ก่อนหน้านี้ตัวเลข "ปลั๊กอินค้าง" จะอัปเดตก็ต่อเมื่อสั่งอัปเดตจริงเท่านั้น
--  ทั้งฟลีตจึงขึ้น "ยังไม่ตรวจ" เพราะไม่มีใครกล้าอัปเดตรวดเดียว 49 เว็บ)
alter table web_jobs drop constraint if exists web_jobs_type_check;
alter table web_jobs add constraint web_jobs_type_check
  check (type in ('scan', 'plugin_update', 'plugin_check', 'backup', 'discover'));

alter table web_run_batches drop constraint if exists web_run_batches_type_check;
alter table web_run_batches add constraint web_run_batches_type_check
  check (type in ('scan', 'plugin_update', 'plugin_check', 'backup', 'discover'));

-- เว็บ WordPress พังแบบไม่ล่ม (จอขาว / critical error / ต่อฐานข้อมูลไม่ได้)
-- ยังตอบ HTTP 200 อยู่ ตัวเช็คที่ดูแต่ status code จึงมองไม่เห็น
-- เก็บอาการที่อ่านได้จากเนื้อหาหน้าจริง null = ปกติ
alter table web_sites add column if not exists page_issue text;
comment on column web_sites.page_issue is
  'อาการที่เจอจากเนื้อหาหน้าเว็บ เช่น critical_error, blank_page — null = ปกติ';
