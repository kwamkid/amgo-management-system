-- ═══════════════════════════════════════════════════════════════════════
-- โควตาตั้งต้นต้องไม่พังตอนขึ้นปีใหม่
--
-- leave_type_defaults ตั้งไว้แค่ปี 2024-2027 พอถึง 1 ม.ค. 2028
-- seed_leave_quota จะไม่สร้างอะไรเลย (เงียบ ๆ คืน 0) แปลว่าพนักงานทุกคน
-- ไม่มีโควตาลา และไม่มีใครรู้จนกว่าจะมีคนยื่นใบลาแล้วไม่ผ่าน
--
-- เจอตอนเขียน scripts/test-leave-flow.mjs (ทดสอบใบลาคร่อมปี 2027→2028)
--
-- แก้: ปีไหนไม่ได้ตั้งไว้ ให้ยืมค่าจากปีล่าสุดที่ตั้งไว้แทน
-- ═══════════════════════════════════════════════════════════════════════

create or replace function seed_leave_quota(p_user_id uuid, p_year smallint)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_inserted integer;
  v_source_year smallint;
begin
  select d.year into v_source_year
    from public.leave_type_defaults d
   where d.year <= p_year
   order by d.year desc limit 1;

  if v_source_year is null then return 0; end if;

  insert into public.leave_quotas (user_id, year, leave_type, total_days, used_days)
  select p_user_id, p_year, d.leave_type, d.default_days, 0
  from public.leave_type_defaults d
  where d.year = v_source_year
  on conflict (user_id, year, leave_type) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function seed_leave_quota is
  'ปีที่ยังไม่ได้ตั้ง default จะยืมค่าจากปีล่าสุดที่ตั้งไว้ — กันระบบหยุดทำงานตอนขึ้นปีใหม่';
