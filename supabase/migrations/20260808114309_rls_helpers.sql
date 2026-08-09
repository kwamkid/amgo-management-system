-- ═══════════════════════════════════════════════════════════════════════
-- ฟังก์ชันช่วยสำหรับ RLS
--
-- 🔑 อ่าน role จาก JWT ไม่ใช่จากตาราง users
--    ถ้าอ่านจากตาราง policy ของ users จะเรียกตัวเองวนไม่จบ (infinite recursion)
--    และทุก query จะต้อง join users เพิ่มอีกชั้น ช้าโดยไม่จำเป็น
--
-- ⚠️ role อยู่ใน app_metadata เท่านั้น — user_metadata ผู้ใช้แก้เองได้จาก
--    เบราว์เซอร์ (พิสูจน์แล้วตอน Phase 0) ถ้าอ่านจากตรงนั้น = ใครก็เป็น admin ได้
-- ═══════════════════════════════════════════════════════════════════════

create or replace function auth_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'role',
    'anon'
  );
$$;

comment on function auth_role is
  'role ของผู้ใช้ปัจจุบันจาก JWT (app_metadata เท่านั้น) — อย่าเปลี่ยนไปอ่าน user_metadata';

/** จัดการข้อมูลคนอื่นได้ — HR กับ admin */
create or replace function is_hr()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.auth_role() in ('hr','admin'); $$;

/** ผู้ดูแลระบบ */
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.auth_role() = 'admin'; $$;

/** ดูข้อมูลทีมได้ — manager ขึ้นไป (ดูได้ แต่แก้/อนุมัติไม่ได้) */
create or replace function can_view_all()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.auth_role() in ('manager','hr','admin'); $$;

grant execute on function auth_role, is_hr, is_admin, can_view_all to authenticated;
