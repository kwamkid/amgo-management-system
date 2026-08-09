-- ═══════════════════════════════════════════════════════════════════════
-- สิทธิ์เพิ่มเติมรายคน (ตัดสินใจ 2026-08-07)
--
-- ปัญหาที่แก้: role ถูกใช้ทำ 2 หน้าที่พร้อมกัน — "ตำแหน่งงาน" กับ "เข้าเมนูไหนได้"
-- ตัวอย่างจริง: ปู กับ ขวัญ เป็น employee แต่ถูกตั้งเป็น driver เพราะอยากให้เห็น
-- เมนูคนขับ → รายงานแยกตามตำแหน่งผิด และถ้ามีกติกาเฉพาะ driver (เบี้ยเลี้ยง)
-- 2 คนนี้จะได้ไปด้วยทั้งที่ไม่ควร
--
-- แก้โดย: role = ตำแหน่งจริงเสมอ · สิทธิ์เพิ่มมาที่ตารางนี้
-- ═══════════════════════════════════════════════════════════════════════

create table user_permissions (
  user_id    uuid not null references users(id) on delete cascade,
  resource   text not null,
  can_read_own  boolean not null default false,
  can_read_all  boolean not null default false,
  can_write_own boolean not null default false,
  can_write_all boolean not null default false,
  reason     text not null default '',   -- บังคับเขียนเหตุผล จะได้รู้ว่าทำไมมีข้อยกเว้น
  granted_by uuid references users(id),
  created_at timestamptz not null default now(),
  primary key (user_id, resource)
);

create index on user_permissions (resource);
alter table user_permissions enable row level security;

create trigger user_permissions_audit
  after insert or update or delete on user_permissions
  for each row execute function trg_audit();

comment on table user_permissions is
  'สิทธิ์เพิ่มเติมรายคน — ทับ role_permissions · ใช้เมื่อคนหนึ่งต้องเข้าเมนูที่ตำแหน่งเขาไม่มี
   โดยไม่ต้องเปลี่ยนตำแหน่ง (เช่น พนักงานที่ช่วยวิ่งส่งของด้วย)';

create or replace function effective_permission(p_user_id uuid, p_resource text)
returns table (can_read_own boolean, can_read_all boolean,
               can_write_own boolean, can_write_all boolean, source text)
language sql stable security invoker set search_path = ''
as $$
  select
    coalesce(up.can_read_own,  rp.can_read_own,  false),
    coalesce(up.can_read_all,  rp.can_read_all,  false),
    coalesce(up.can_write_own, rp.can_write_own, false),
    coalesce(up.can_write_all, rp.can_write_all, false),
    case when up.user_id is not null then 'รายคน' else 'ตามตำแหน่ง' end
  from public.users u
  left join public.role_permissions rp on rp.role = u.role and rp.resource = p_resource
  left join public.user_permissions up on up.user_id = u.id and up.resource = p_resource
  where u.id = p_user_id;
$$;

comment on function effective_permission is
  'สิทธิ์จริงของคนหนึ่ง = role_permissions ทับด้วย user_permissions';
