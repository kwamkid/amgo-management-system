-- 🔴 แก้ช่องโหว่: ตอน rename can_write → can_write_all ค่า true ที่เคยหมายถึง
-- "ยื่นใบลาของตัวเอง" กลายเป็น "อนุมัติใบลาคนอื่น" ทันที
-- ทำให้ employee/driver/marketing อนุมัติใบลาได้ทั้งที่ไม่ควร
--
-- กติกาที่ถูกต้อง: อนุมัติลาได้เฉพาะ hr + admin เท่านั้น
update role_permissions
set can_write_all = false
where resource = 'leave'
  and role not in ('hr','admin');

-- ตรวจซ้ำทั้งตาราง: role ที่ไม่ใช่ hr/admin ต้องไม่มี can_write_all
-- ยกเว้น marketing/manager ที่ดูแล influencer ได้จริง
update role_permissions
set can_write_all = false
where role in ('employee','driver')
  and resource not in ('delivery');

-- driver จัดการงาน delivery ของตัวเองเท่านั้น
update role_permissions
set can_write_all = false, can_write_own = true
where role = 'driver' and resource = 'delivery';

comment on column role_permissions.can_write_all is
  '⚠️ จัดการข้อมูล "ของคนอื่น" — อนุมัติใบลา แก้เวลา ตั้งโควตา ตั้งเงินเดือน
   ห้ามให้ role ที่ไม่ใช่ hr/admin/marketing(influencer) มีค่านี้เป็น true';
