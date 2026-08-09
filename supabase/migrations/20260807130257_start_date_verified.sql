-- ═══════════════════════════════════════════════════════════════════════
-- แยก "วันเริ่มงานจริง" ออกจาก "วันสมัครเข้าระบบ"
--
-- ตอน migrate ไม่มีวันเริ่มงานใน Firestore เลย จึงเอา registered_at มาใส่ไว้ก่อน
-- ผลคือทุกคนมี start_date ครบ ดูเผิน ๆ เหมือนกรอกแล้ว แต่ไม่ใช่ของจริง
--
-- 🔴 เรื่องนี้ไม่ใช่แค่ข้อมูลไม่สวย — employee_directory คิด vacation_eligible
--    จาก start_date ตรง ๆ (ม.30 ต้องทำงานครบ 1 ปีถึงมีสิทธิพักร้อน)
--    ถ้านับจากวันสมัคร = ให้สิทธิผิดคน
-- ═══════════════════════════════════════════════════════════════════════

alter table users
  add column if not exists start_date_verified boolean not null default false;

comment on column users.start_date_verified is
  'false = start_date ยังเป็นวันสมัครที่ยกมาตอน migrate ไม่ใช่วันเริ่มงานจริง — ต้องให้ HR ยืนยัน';
comment on column users.start_date is
  'วันเริ่มงานจริง (คนละอันกับ registered_at) — ดูคู่กับ start_date_verified เสมอ';

update users
   set start_date_verified = false
 where start_date is null
    or start_date = (registered_at at time zone 'Asia/Bangkok')::date;

-- ── อายุงาน/สิทธิพักร้อน ต้องนับจากวันที่ยืนยันแล้วเท่านั้น ──────────────
drop view if exists employee_directory;

create view employee_directory as
  select u.id,
    u.full_name,
    u.role,
    rs.label_th as role_th,
    c.code as company_code,
    c.name_th as company_name,
    bu.name as business_unit,
    l.name as location_name,
    u.employment_type,
    u.start_date,
    u.start_date_verified,
    case when u.start_date_verified then months_of_service(u.start_date) end as months_of_service,
    case when u.start_date_verified
         then round(months_of_service(u.start_date)::numeric / 12.0, 1) end as years_of_service,
    -- ยังไม่ยืนยันวันเริ่มงาน = ยังตอบไม่ได้ว่ามีสิทธิพักร้อนไหม (null ไม่ใช่ false)
    case when u.start_date_verified then months_of_service(u.start_date) >= 12 end as vacation_eligible,
    u.wfh_eligible,
    coalesce(u.days_per_week, bu.default_days_per_week) as days_per_week,
    coalesce(u.requires_checkin, rs.requires_checkin, true) as requires_checkin,
    u.is_active
  from users u
    left join role_settings rs on rs.role = u.role
    left join business_units bu on bu.id = u.business_unit_id
    left join companies c on c.id = bu.company_id
    left join locations l on l.id = u.primary_location_id
  where u.deleted_at is null;

comment on view employee_directory is
  'months_of_service / vacation_eligible เป็น null เมื่อยังไม่ยืนยันวันเริ่มงาน — ห้ามตีความ null ว่าไม่มีสิทธิ';
