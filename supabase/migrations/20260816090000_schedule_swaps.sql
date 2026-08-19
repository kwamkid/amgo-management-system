-- ใบสลับวันหยุด — "วันหยุดวันนี้ขอมาทำงาน แล้วไปหยุดวันอื่นแทน"
--
-- ── ทำไมต้องมี (เจ้าของสั่ง 16 ส.ค. 69) ──────────────────────────────
-- ของเดิมไม่มีใบ มีแค่การหักลบเงียบ ๆ ในรายงาน: เช็คอินตรงวันหยุดประจำ
-- = ได้เครดิต 1 แล้วเอาไปล้างวันขาดใบไหนก็ได้ในช่วงเดียวกัน
-- (reportService: absentDays − offDaySwapDays) ผลคือ
--   · ไม่รู้ว่าวันทำงานกับวันหยุดคู่ไหนจับคู่กัน และไม่มีที่เขียนเหตุผล
--   · เครดิตไปกลบวันขาดจริง ๆ ที่ไม่เกี่ยวกันได้
--   · ข้ามงวดจ่ายแล้วพัง — เครดิตอยู่งวดหนึ่ง วันหยุดอยู่อีกงวด
-- schedule_exceptions ที่ทำไว้รองรับเรื่องนี้อยู่แล้วมี 0 แถวมาตลอด
-- เพราะซ่อนอยู่ในหน้าแก้ไขพนักงาน ไม่มีใครเข้าไปกรอก
--
-- ใบนี้เก็บ "คู่วัน" แล้ว trigger เขียน schedule_exceptions ให้ตอนอนุมัติ
-- รายงาน/ตารางวัน/การนับวันขาด จึงไม่ต้องมีโค้ดพิเศษ — expected_work_mode
-- อ่าน schedule_exceptions เป็นอยู่แล้ว

create table schedule_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  -- snapshot ชื่อตอนยื่น (กติกาเดียวกับ leave_requests) — อ่านจริงทับด้วย getDisplayNames()
  user_name text not null default '',

  -- วันหยุดประจำที่ขอมาทำงาน
  worked_date date not null,
  -- วันทำงานปกติที่ขอไปหยุดแทน
  off_date date not null,

  reason text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),

  approved_by uuid references users(id),
  approved_at timestamptz,
  rejected_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- สลับกับตัวเองไม่ได้
  constraint schedule_swaps_dates_differ check (worked_date <> off_date)
);

create index schedule_swaps_user_idx on schedule_swaps (user_id, worked_date desc);
create index schedule_swaps_status_idx on schedule_swaps (status) where status = 'pending';

-- วันเดียวกันของคนเดียวกัน ห้ามมีใบที่ยังมีผลซ้อนกัน
create unique index schedule_swaps_worked_once
  on schedule_swaps (user_id, worked_date)
  where status in ('pending', 'approved');
create unique index schedule_swaps_off_once
  on schedule_swaps (user_id, off_date)
  where status in ('pending', 'approved');

alter table schedule_swaps enable row level security;

-- เห็นของตัวเอง · คนที่ดูได้ทั้งบริษัทเห็นหมด (กติกาเดียวกับใบลา)
create policy schedule_swaps_select on schedule_swaps
  for select to authenticated
  using (user_id = auth.uid() or can_view_all());

-- ยื่นได้เฉพาะของตัวเอง และต้องเป็น pending — อนุมัติให้ตัวเองไม่ได้
create policy schedule_swaps_insert_own on schedule_swaps
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- แก้ใบตัวเองได้ตราบใดที่ยังไม่มีใครอนุมัติ
create policy schedule_swaps_update_own_pending on schedule_swaps
  for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid());

create policy schedule_swaps_manage on schedule_swaps
  for all to authenticated
  using (is_hr()) with check (is_hr());

-- ── ผลของการอนุมัติ ─────────────────────────────────────────────────
-- อนุมัติ → เขียน schedule_exceptions 2 แถว (มาทำงาน / ไปหยุด)
-- ถอนอนุมัติ/ยกเลิก → ลบทิ้ง ตารางกลับไปเป็นปกติเอง
--
-- work_mode รับแค่ onsite/wfh/off — "มาทำงาน" จึงเป็น onsite ตรงกับที่
-- WorkScheduleCard เขียนอยู่เดิม (เคยพลาดใส่ 'work' แล้ว check constraint ตีกลับ)
--
-- security definer เพราะ schedule_exceptions เปิดให้ is_hr() เท่านั้น
-- แต่คนกดอนุมัติอาจเป็น manager — ให้ trigger เขียนแทนจะได้ไม่ต้องเปิดสิทธิ์
create or replace function schedule_swaps_sync_exceptions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ลบร่องรอยของใบเดิมก่อนเสมอ แล้วค่อยเขียนใหม่ตามสถานะปัจจุบัน
  -- (แก้วันในใบที่อนุมัติแล้วก็ยังตรง ไม่มีแถวกำพร้าค้าง)
  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    delete from schedule_exceptions
     where user_id = old.user_id
       and exception_date in (old.worked_date, old.off_date)
       and note like '[ใบสลับวันหยุด]%';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.status = 'approved' then
    insert into schedule_exceptions (user_id, exception_date, work_mode, note, created_by)
    values
      (new.user_id, new.worked_date, 'onsite',
       '[ใบสลับวันหยุด] มาทำงานแทนวันหยุด' ||
         case when new.reason <> '' then ' — ' || new.reason else '' end,
       new.approved_by),
      (new.user_id, new.off_date, 'off',
       '[ใบสลับวันหยุด] หยุดชดเชยวันที่ ' || to_char(new.worked_date, 'DD/MM'),
       new.approved_by)
    on conflict (user_id, exception_date) do update
      set work_mode = excluded.work_mode,
          note = excluded.note,
          created_by = excluded.created_by;
  end if;

  return new;
end;
$$;

create trigger schedule_swaps_sync
  after insert or update or delete on schedule_swaps
  for each row execute function schedule_swaps_sync_exceptions();

-- updated_at ให้ตรงกับตารางอื่นในระบบ
create trigger schedule_swaps_touch
  before update on schedule_swaps
  for each row execute function set_updated_at();
