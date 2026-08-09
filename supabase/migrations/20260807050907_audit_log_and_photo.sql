-- ═══════════════════════════════════════════════════════════════════════
-- ประวัติการแก้ไขทั้งระบบ + รูปพนักงาน (ตัดสินใจ 2026-08-07)
-- ═══════════════════════════════════════════════════════════════════════

alter table users add column photo_url text;
comment on column users.photo_url is
  'รูปที่ HR อัปโหลด — แยกจาก line_picture_url ซึ่งถูกเขียนทับทุกครั้งที่ล็อกอินด้วย LINE';

-- 🔒 มี jsonb ของข้อมูลจริงข้างใน รวมเงินเดือน → RLS ต้องเข้มเท่าตารางต้นทาง
create table audit_log (
  id          bigserial primary key,
  table_name  text not null,
  record_id   text not null,
  action      text not null check (action in ('INSERT','UPDATE','DELETE')),
  changed_by  uuid references users(id),   -- null = ระบบ/สคริปต์ migration
  -- clock_timestamp ไม่ใช่ now() — now() คือเวลาเริ่ม transaction
  -- แก้หลายรายการใน transaction เดียวจะได้เวลาเท่ากันหมด เรียงลำดับไม่ได้
  changed_at  timestamptz not null default clock_timestamp(),
  old_values  jsonb,
  new_values  jsonb,
  changed_fields text[]
);

create index on audit_log (table_name, record_id, changed_at desc);
create index on audit_log (changed_at desc);
create index on audit_log (changed_by) where changed_by is not null;

alter table audit_log enable row level security;

comment on table audit_log is
  '🔒 ประวัติการแก้ทุกตารางสำคัญ — มีข้อมูลจริงใน jsonb รวมเงินเดือน RLS ต้องเข้ม';

create or replace function trg_audit()
returns trigger
language plpgsql
security definer            -- ต้อง definer เพื่อเขียน audit_log ได้แม้ RLS ปิดอยู่
set search_path = ''
as $$
declare
  v_old jsonb; v_new jsonb; v_changed text[]; v_id text;
begin
  v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;

  if tg_op = 'UPDATE' then
    select array_agg(key) into v_changed
    from jsonb_each(v_new)
    where key <> 'updated_at'                        -- เปลี่ยนทุกครั้งอยู่แล้ว
      and v_new -> key is distinct from v_old -> key;
    if v_changed is null then return null; end if;   -- ไม่มีอะไรเปลี่ยนจริง
  end if;

  v_id := coalesce(v_new ->> 'id', v_old ->> 'id',
                   v_new ->> 'user_id', v_old ->> 'user_id', '?');

  insert into public.audit_log
    (table_name, record_id, action, changed_by, old_values, new_values, changed_fields)
  values (tg_table_name, v_id, tg_op, auth.uid(), v_old, v_new, v_changed);
  return null;
end;
$$;

-- ไม่ติดกับ checkins เพราะมี checkin_edits อยู่แล้ว (เก็บ "เหตุผล" ด้วย อ่านง่ายกว่า)
-- และ checkin มี 10,000+ แถว/ปี audit จะบวมเร็ว
do $$
declare t text;
begin
  foreach t in array array[
    'users', 'user_compensation', 'leave_quotas', 'leave_requests', 'leave_days',
    'leave_type_defaults', 'role_settings', 'role_permissions',
    'companies', 'business_units', 'business_unit_work_days',
    'locations', 'shifts', 'user_work_schedules', 'schedule_exceptions',
    'ot_rate_settings', 'holidays', 'app_settings', 'invite_links'
  ] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on %I
         for each row execute function trg_audit()', t || '_audit', t);
  end loop;
end $$;

create or replace view salary_history as
select
  c.user_id, u.full_name, c.effective_from, c.base_salary, c.pay_type,
  lag(c.base_salary) over w as previous_salary,
  c.base_salary - lag(c.base_salary) over w as change_amount,
  round((c.base_salary - lag(c.base_salary) over w)
        / nullif(lag(c.base_salary) over w, 0) * 100, 1) as change_percent,
  c.note, c.created_at as recorded_at
from user_compensation c
join users u on u.id = c.user_id
window w as (partition by c.user_id order by c.effective_from)
order by u.full_name, c.effective_from desc;

comment on view salary_history is
  '🔒 ประวัติการขึ้นเงินเดือน — คำนวณส่วนต่างและ % จากแถวก่อนหน้าอัตโนมัติ';
