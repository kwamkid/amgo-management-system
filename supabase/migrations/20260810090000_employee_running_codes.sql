-- รหัสพนักงานแบบเลขต่อเนื่อง — โชว์เป็น 001, 002, ...
--
-- ตั้งต้น: ยุทธนา (แอม) = 1 · ธัญวรัตน์ (กอล์ฟ) = 2 ตามที่เจ้าของสั่ง
-- ที่เหลือไล่ตามวันเริ่มงาน (ไม่มีวันเริ่มงานใช้วันสมัครแทน)
-- คนสมัครใหม่ได้เลขถัดไปอัตโนมัติจาก sequence — เลขไม่ซ้ำแม้สมัครพร้อมกัน
alter table public.users add column employee_code integer;
alter table public.users add constraint users_employee_code_key unique (employee_code);

with seed (id, code) as (
  values
    ('31e03073-e7c4-44bd-a473-e2fedc1b20e5'::uuid, 1), -- ยุทธนา (แอม)
    ('bbd674a4-405d-455b-ad66-befadd9ddf79'::uuid, 2)  -- ธัญวรัตน์ (กอล์ฟ)
),
others as (
  select id,
         2 + row_number() over (
           order by start_date asc nulls last, registered_at asc nulls last, created_at asc
         ) as code
  from public.users
  where is_system is not true
    and deleted_at is null
    and id not in (select id from seed)
)
update public.users u
   set employee_code = x.code
  from (select * from seed union all select * from others) x
 where u.id = x.id;

create sequence public.users_employee_code_seq;
select setval('public.users_employee_code_seq',
              (select max(employee_code) from public.users));

create or replace function public.trg_assign_employee_code()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  -- บัญชีระบบ (Dev/Super Admin) ไม่ใช่พนักงาน ไม่กินเลข
  if new.employee_code is null and new.is_system is not true then
    new.employee_code := nextval('public.users_employee_code_seq');
  end if;
  return new;
end;
$$;

create trigger users_assign_employee_code
  before insert on public.users
  for each row execute function public.trg_assign_employee_code();
