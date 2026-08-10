-- แก้ตัวกันพนักงานแก้ข้อมูลตัวเอง 2 เรื่อง
--
-- ── 1. มันบล็อกโค้ดฝั่งเซิร์ฟเวอร์ไปด้วย (บั๊กจริงที่เจอ) ──────────────
-- is_hr() อ่าน role จาก app_metadata ใน JWT  แต่ service key ไม่มี JWT แบบนั้น
-- auth_role() จึงคืน 'anon' → is_hr() = false → trigger ดันค่ากลับ
--
-- ผลคือ /api/users/delete ที่เขียนด้วย service key "บอกว่าสำเร็จแต่ไม่เกิดอะไร"
-- ลบพนักงานแบบ soft delete กับกู้คืน ไม่ทำงานมาตลอด (พิสูจน์แล้วด้วยการทดลองเขียนจริง)
--
-- โค้ดที่ถือ service key เป็นโค้ดของเราเอง ไม่ใช่ผู้ใช้ — ปล่อยผ่านได้
-- ตัวชี้ขาดคือ auth.uid() ว่างหรือไม่: ผู้ใช้จริงมีเสมอ · service key ไม่มี
-- (คนที่ไม่ได้ล็อกอินก็แตะตารางนี้ไม่ได้อยู่แล้ว policy บังคับ id = auth.uid())
--
-- ── 2. คอลัมน์ที่ยังไม่ได้กัน ──────────────────────────────────────────
-- is_system            เพิ่งเพิ่มไปเมื่อวาน — ตั้งเองแล้วหายจากรายงานทั้งระบบ
-- line_user_id         เปลี่ยนได้ = ผูกบัญชีตัวเองไปทับตัวตนคนอื่น
-- home_lat/lng/radius  เป็นตัวตัดสินว่าเช็คอิน WFH เข้าเขตไหม ย้ายเองได้ = เช็คอินจากที่ไหนก็ได้
-- primary_location_id  สาขาที่สังกัด
-- invite_link_*        ที่มาของการสมัคร
-- approved_* / deleted_by  ร่องรอยว่าใครอนุมัติ/ใครลบ

create or replace function public.trg_guard_user_self_edit()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  -- HR/admin แก้ได้หมด
  if public.is_hr() then return new; end if;

  -- ไม่มีผู้ใช้ = โค้ดฝั่งเซิร์ฟเวอร์ที่ถือ service key (ของเราเอง) ปล่อยผ่าน
  if (select auth.uid()) is null then return new; end if;

  -- คนทั่วไปแก้ตัวเองได้แค่ ชื่อจริง · ชื่อเล่น · ข้อมูลติดต่อ · รูป
  -- ที่เหลือดันค่าเดิมกลับเงียบ ๆ
  new.role                := old.role;
  new.employment_status   := old.employment_status;
  new.employment_type     := old.employment_type;
  new.business_unit_id    := old.business_unit_id;
  new.start_date          := old.start_date;
  new.start_date_verified := old.start_date_verified;
  new.end_date            := old.end_date;
  new.days_per_week       := old.days_per_week;
  new.payroll_cycle       := old.payroll_cycle;
  new.requires_checkin    := old.requires_checkin;
  new.wfh_eligible        := old.wfh_eligible;
  new.is_active           := old.is_active;
  new.needs_approval      := old.needs_approval;
  new.allow_checkin_outside_location := old.allow_checkin_outside_location;
  new.deleted_at          := old.deleted_at;

  new.is_system           := old.is_system;
  new.line_user_id        := old.line_user_id;
  new.home_lat            := old.home_lat;
  new.home_lng            := old.home_lng;
  new.home_radius         := old.home_radius;
  new.primary_location_id := old.primary_location_id;
  new.invite_link_id      := old.invite_link_id;
  new.invite_link_code    := old.invite_link_code;
  new.approved_at         := old.approved_at;
  new.approved_by         := old.approved_by;
  new.deleted_by          := old.deleted_by;
  new.deleted_by_name     := old.deleted_by_name;
  return new;
end;
$function$;

comment on function public.trg_guard_user_self_edit is
  'พนักงานแก้แถวตัวเองได้แค่ชื่อจริง ชื่อเล่น และข้อมูลติดต่อ — โค้ดที่ถือ service key ไม่โดนกัน';
