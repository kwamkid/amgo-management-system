-- ═══════════════════════════════════════════════════════════════════════
-- สถานะการทำงาน — ของเดิมมีแค่ is_active true/false ซึ่งบอกไม่ได้ว่า
-- "ปิดบัญชีชั่วคราว" กับ "ลาออกไปแล้ว" ต่างกันยังไง และไม่รู้ว่าออกวันไหน
--
-- 🔴 ผลกระทบจริง: attendance_summary กาง grid วันตามช่วงที่ขอ แล้วบอกว่า
--    ใครไม่มาถือเป็น absent — คนที่ลาออกไปแล้วจะขาดงานสะสมไปเรื่อย ๆ
--    และ payroll จะคิดเงินเดือนเต็มเดือนที่เขาไม่ได้อยู่แล้ว
-- ═══════════════════════════════════════════════════════════════════════

alter table users
  add column if not exists employment_status text not null default 'active'
    check (employment_status in ('active','probation','resigned','terminated','retired')),
  add column if not exists end_date date,
  add column if not exists end_reason text;

comment on column users.employment_status is
  'active=ทำงานปกติ · probation=ทดลองงาน · resigned=ลาออก · terminated=เลิกจ้าง · retired=เกษียณ';
comment on column users.end_date is
  'วันสุดท้ายที่ทำงาน — หลังวันนี้ไม่นับขาดงานและไม่คิดเงินเดือน';

-- ออกไปแล้วต้องมีวันสุดท้าย ไม่งั้นระบบไม่รู้ว่าจะหยุดนับตรงไหน
alter table users drop constraint if exists ended_needs_end_date;
alter table users add constraint ended_needs_end_date
  check (employment_status in ('active','probation') or end_date is not null)
  not valid;

-- ── ย้ายข้อมูลเดิม: is_active=false 12 คน ──────────────────────────────
-- ไม่รู้ว่าลาออกหรือโดนเลิกจ้าง และไม่รู้วันสุดท้าย → ตั้งเป็น resigned
-- แล้วใช้วันเช็คอินครั้งสุดท้ายเป็นวันออก (ดีกว่าเดา) ใครไม่เคยเช็คอินใช้วันสมัคร
update users u
   set employment_status = 'resigned',
       end_date = coalesce(
         (select max(c.work_date) from checkins c where c.user_id = u.id),
         (u.registered_at at time zone 'Asia/Bangkok')::date
       ),
       end_reason = 'ยกมาตอนย้ายระบบ — ของเดิมมีแค่ is_active=false ไม่ได้บันทึกเหตุผล/วันที่'
 where not u.is_active
   and u.employment_status = 'active';

alter table users validate constraint ended_needs_end_date;

-- ── ให้ is_active ตามสถานะเสมอ จะได้ไม่มีวันขัดกันเอง ──────────────────
create or replace function trg_sync_is_active()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.is_active := new.employment_status in ('active','probation');
  return new;
end;
$$;

drop trigger if exists users_sync_is_active on users;
create trigger users_sync_is_active
  before insert or update of employment_status on users
  for each row execute function trg_sync_is_active();

comment on column users.is_active is
  'อนุมานจาก employment_status อัตโนมัติ (trigger) — อย่าเขียนตรง ๆ ให้แก้ที่ employment_status';
