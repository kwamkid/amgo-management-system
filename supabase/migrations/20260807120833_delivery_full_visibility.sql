-- ═══════════════════════════════════════════════════════════════════
-- แผนที่ส่งของ: ทุกคนเห็นข้อมูลครบ รวมข้อมูลลูกค้า (ตัดสินใจ 2026-08-07)
--
-- ยกเลิก view ที่ตัดข้อมูลลูกค้าออก — เจ้าของระบบยืนยันให้เห็นได้หมด
-- RLS Phase 6: delivery_points อ่านได้ทุก authenticated user
--              เขียนได้เฉพาะ driver (งานตัวเอง) + admin/hr
-- ═══════════════════════════════════════════════════════════════════

drop view if exists delivery_points_map;

update role_permissions
set note = 'ดูแผนที่และรายละเอียดงานได้ทั้งหมด รวมข้อมูลลูกค้า · ปักหมุดไม่ได้'
where resource = 'delivery' and role not in ('admin','hr','driver');

update role_permissions
set note = 'ดูได้ทั้งหมดรวมข้อมูลลูกค้า · ปักหมุดและแก้ได้เฉพาะงานของตัวเอง'
where resource = 'delivery' and role = 'driver';

comment on table delivery_points is
  'ของเดิมไม่มี FK ไป route — ผูกด้วย driverId+วันที่เอาเอง Phase 3 ต้อง map ให้ถูก
   · การมองเห็น: พนักงานทุกคนอ่านได้ครบรวม customer_name/phone/address (ตัดสินใจ 2026-08-07)';
