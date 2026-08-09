-- ═══════════════════════════════════════════════════════════════════
-- แยก can_write เป็น can_write_own / can_write_all (ตัดสินใจ 2026-08-07)
--
-- ปัญหา: can_write ตัวเดียวรวม "ยื่นใบลาของตัวเอง" กับ "อนุมัติใบลาคนอื่น"
-- พอสั่งว่า manager อนุมัติไม่ได้ ถ้าปิด can_write เฉย ๆ manager จะยื่น
-- ใบลาของตัวเองไม่ได้ด้วย → ต้องแยกคอลัมน์
--
-- กติกาใหม่: อนุมัติลาได้เฉพาะ hr + admin · manager แค่ไม่ต้องเช็คอิน
-- ═══════════════════════════════════════════════════════════════════

alter table role_permissions rename column can_write to can_write_all;
alter table role_permissions add column can_write_own boolean not null default false;

comment on column role_permissions.can_write_own is 'แก้/สร้างข้อมูลของตัวเอง เช่น ยื่นใบลา';
comment on column role_permissions.can_write_all is 'จัดการข้อมูลคนอื่น เช่น อนุมัติใบลา แก้เวลา ตั้งโควตา';

-- ทุกคนยื่นใบลาของตัวเองได้
update role_permissions set can_write_own = true where resource = 'leave';

-- 🔴 manager อนุมัติลาไม่ได้แล้ว (เดิมอนุมัติได้)
update role_permissions
set can_write_all = false,
    note = 'ดูใบลาของทีมได้ แต่อนุมัติไม่ได้ — อนุมัติเฉพาะ hr/admin'
where role = 'manager' and resource = 'leave';

update role_permissions
set note = 'อนุมัติใบลาได้'
where role in ('hr','admin') and resource = 'leave';

-- driver แก้งาน delivery ของตัวเองได้ = write_own ไม่ใช่ write_all
update role_permissions
set can_write_own = true, can_write_all = false
where role = 'driver' and resource = 'delivery';
