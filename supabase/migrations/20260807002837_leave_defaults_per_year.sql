-- ═══════════════════════════════════════════════════════════════════════
-- 0009 — โควตาลาปรับได้ "รายปี" (รายคนทำได้อยู่แล้วผ่าน leave_quotas)
--
-- แยก "ประเภทลาคืออะไร" (ชื่อ ไม่เปลี่ยน) ออกจาก "ปีนั้นให้กี่วัน" (เปลี่ยนทุกปี)
--
-- ลำดับความสำคัญตอนใช้งาน:
--   leave_quotas (รายคน รายปี)  >  leave_type_defaults (รายปี)  >  ขั้นต่ำกฎหมาย
-- ═══════════════════════════════════════════════════════════════════════

alter table leave_types drop column default_days;

create table leave_type_defaults (
  leave_type    text not null references leave_types(code) on delete restrict,
  year          smallint not null,
  default_days  numeric(4,1) not null,
  note          text not null default '',
  updated_by    uuid references users(id),
  updated_at    timestamptz not null default now(),
  primary key (leave_type, year),
  constraint days_not_negative check (default_days >= 0)
);

create trigger leave_type_defaults_updated_at before update on leave_type_defaults
  for each row execute function set_updated_at();

alter table leave_type_defaults enable row level security;

comment on table leave_type_defaults is
  'ค่าตั้งต้นรายปี — ปรับได้ทุกปีโดยไม่กระทบโควตารายคนที่ตั้งไปแล้ว (leave_quotas)';

insert into leave_type_defaults (leave_type, year, default_days, note)
select t.code, y.year, t.days, 'ขั้นต่ำตามกฎหมายแรงงานไทย'
from (values ('sick', 30.0), ('vacation', 6.0), ('personal', 3.0)) as t(code, days)
cross join (values (2024), (2025), (2026), (2027)) as y(year)
on conflict (leave_type, year) do nothing;

-- ตั้งโควตาปีใหม่ให้พนักงาน 1 คน — ไม่ทับค่าที่ HR ปรับไว้แล้ว
-- แก้ปัญหาข้อมูลเดิมที่มีคนโควตา 0 เพราะไม่มีใครไปตั้งให้
create or replace function seed_leave_quota(p_user_id uuid, p_year smallint)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  insert into public.leave_quotas (user_id, year, leave_type, total_days, used_days)
  select p_user_id, p_year, d.leave_type, d.default_days, 0
  from public.leave_type_defaults d
  where d.year = p_year
  on conflict (user_id, year, leave_type) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function seed_leave_quota is
  'ตั้งโควตาปีใหม่ให้พนักงาน 1 คนจาก leave_type_defaults — ไม่ทับค่าที่ HR ปรับไว้แล้ว';
