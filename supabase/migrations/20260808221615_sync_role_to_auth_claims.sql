-- ═══════════════════════════════════════════════════════════════════════
-- users.role → auth.users.raw_app_meta_data.role
--
-- auth_role() อ่าน role จาก JWT (app_metadata) ไม่ใช่จากตาราง users
-- เพราะถ้าอ่านจากตาราง policy ของ users จะเรียกตัวเองวนไม่จบ
--
-- ผลข้างเคียงคือ "แก้ role ในตาราง users แล้ว JWT ไม่รู้เรื่อง"
-- HR เลื่อนใครเป็น manager → คนนั้นยังถูกตัดสินด้วยสิทธิ์เดิมตลอดไป
-- ของเดิมบน Firebase มี /api/users/update-claims คอยยิงตาม แต่ต้องจำเรียกเอง
-- และหน้าแก้หลายคนพร้อมกันก็ไม่ได้เรียก
--
-- ย้ายมาไว้ที่ฐานข้อมูลแทน — แก้ทางไหนก็ตามกันครบ
--
-- หมายเหตุ: JWT ที่ออกไปแล้วยังถือ role เดิมจนกว่าจะ refresh (ประมาณ 1 ชม.)
-- ถ้าต้องการให้มีผลทันทีต้องบังคับ sign out — ยังไม่ได้ทำ
-- ═══════════════════════════════════════════════════════════════════════

create or replace function trg_sync_role_claim()
returns trigger
language plpgsql
security definer          -- ต้อง definer เพราะ schema auth ห้ามเขียนตรง ๆ
set search_path = ''
as $$
begin
  update auth.users
     set raw_app_meta_data =
           coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new.role)
   where id = new.id;
  return null;
end;
$$;

comment on function trg_sync_role_claim is
  'มิเรอร์ role ลง app_metadata — ห้ามย้ายไป user_metadata เด็ดขาด ผู้ใช้แก้เองได้';

drop trigger if exists users_sync_role_claim on users;
create trigger users_sync_role_claim
  after insert or update of role on users
  for each row execute function trg_sync_role_claim();

-- ตามเก็บคนที่ claim ไม่ตรงกับตารางอยู่ตอนนี้
update auth.users a
   set raw_app_meta_data =
         coalesce(a.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', u.role)
  from public.users u
 where u.id = a.id
   and coalesce(a.raw_app_meta_data ->> 'role', '') is distinct from u.role;
