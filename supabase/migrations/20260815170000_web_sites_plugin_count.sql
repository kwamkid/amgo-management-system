-- เก็บจำนวนปลั๊กอินทั้งหมดคู่กับจำนวนที่ค้าง เพื่อให้หน้าตารางแสดงเป็น "ค้าง/ทั้งหมด"
-- (ค้าง 3 จาก 5 กับ ค้าง 3 จาก 40 คนละเรื่องกัน ตัวเลขเดี่ยวบอกไม่ได้)
-- ค่านี้ได้มาฟรีตอนตรวจปลั๊กอินอยู่แล้ว — wp plugin list คืนทุกตัวมา เราแค่เคยทิ้งจำนวนรวมไป
alter table web_sites add column if not exists plugin_count integer not null default 0;
comment on column web_sites.plugin_count is
  'จำนวนปลั๊กอินทั้งหมดที่ติดตั้งอยู่ — อัปเดตทุกครั้งที่ตรวจ/อัปเดตปลั๊กอิน';

-- เติมย้อนหลังจากรายชื่อที่เคยบันทึกไว้ ไม่ต้อง SSH เข้าไปนับใหม่
update web_sites s
set plugin_count = (select count(*) from web_plugins p where p.site_id = s.id)
where s.plugin_count = 0;
