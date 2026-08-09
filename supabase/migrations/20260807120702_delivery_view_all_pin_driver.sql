-- ═══════════════════════════════════════════════════════════════════════
-- แผนที่ส่งของ: ทุกคนดูได้ครบ · ปักหมุดได้เฉพาะ driver (ตัดสินใจ 2026-08-07)
--
-- ผลพลอยได้: ปู/ขวัญ ไม่ต้องเป็น driver เพื่อ "ดูแผนที่" อีกต่อไป
-- เพราะทุกคนดูได้อยู่แล้ว — เหลือแค่ให้สิทธิ์ "ปักหมุด" เพิ่มรายคน
--
-- หมายเหตุ: เคยเสนอให้ซ่อน customer_name/phone/address จากคนทั่วไป
-- เจ้าของระบบยืนยันว่าให้เห็นได้หมด → ไม่ทำ view ปิดบัง
-- ═══════════════════════════════════════════════════════════════════════

insert into role_permissions (role, resource, can_read_own, can_read_all, can_write_own, can_write_all, note)
select r.role, 'delivery', true, true, false, false,
       'ดูแผนที่และรายละเอียดงานได้ทั้งหมด รวมข้อมูลลูกค้า · ปักหมุดไม่ได้'
from role_settings r
on conflict (role, resource) do update
  set can_read_all = true, can_read_own = true;

update role_permissions
set can_write_own = true,
    note = 'ดูได้ทั้งหมดรวมข้อมูลลูกค้า · ปักหมุดและแก้ได้เฉพาะงานของตัวเอง'
where resource = 'delivery' and role = 'driver';

update role_permissions
set can_write_all = true, can_write_own = true, note = 'จัดการงานส่งของได้ทุกคน'
where resource = 'delivery' and role in ('admin','hr');

comment on table delivery_points is
  'ของเดิมไม่มี FK ไป route — ผูกด้วย driverId+วันที่เอาเอง Phase 3 ต้อง map ให้ถูก
   · การมองเห็น: พนักงานทุกคนอ่านได้ครบรวม customer_name/phone/address (ตัดสินใจ 2026-08-07)';
