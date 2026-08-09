-- ═══════════════════════════════════════════════════════════════════════
-- แก้ตารางงานหน่วยงานตามที่เจ้าของยืนยัน (2026-08-07)
--   · โกดังใหม่ตลาดไท / คลังหลัก พระราม 2 = จันทร์-เสาร์
--   · ออฟฟิศ AGD = ทำงาน จ-ศ แต่เข้าออฟฟิศแค่ อ พฤ ศ (จ,พ = wfh)
--   · ร้าน/ห้าง เปิด 7 วัน แต่คนหนึ่งทำ 5-6 วัน  ← แยกเป็น 2 ตัวเลข
--   · ออกบูธ ไม่ใช่หน่วยงาน — ทุกคนมีสิทธิไป นานๆ ที และมีอีกหลายที่
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. แยก "ไซต์ต้องมีคนกี่วัน" ออกจาก "คนหนึ่งทำกี่วัน" ────────────────
alter table business_units
  add column if not exists coverage_days_per_week smallint
    check (coverage_days_per_week between 1 and 7);

comment on column business_units.coverage_days_per_week is
  'ไซต์นี้ต้องมีคนอยู่กี่วัน/สัปดาห์ (ร้าน=7 เปิดทุกวัน) — ใช้วางแผนจัดเวร ไม่ใช่ของรายบุคคล';
comment on column business_units.default_days_per_week is
  'คนหนึ่งคนทำกี่วัน/สัปดาห์ (ค่าเริ่มต้นของหน่วยงาน) — users.days_per_week ทับได้รายคน';

-- ── 2. สถานที่ที่ทุกคนเข้าได้ (ออกบูธ) ──────────────────────────────────
alter table locations
  add column if not exists open_to_all boolean not null default false;

comment on column locations.open_to_all is
  'true = ไม่ต้องอยู่ใน user_allowed_locations ก็เช็คอินได้ — ใช้กับงานออกบูธที่ทุกคนมีสิทธิไป';

update locations set open_to_all = true where location_type = 'event';

create or replace function can_checkin_at(p_user_id uuid, p_location_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.locations l
    where l.id = p_location_id
      and l.is_active
      and (
        l.open_to_all
        or exists (select 1 from public.user_allowed_locations ual
                    where ual.user_id = p_user_id and ual.location_id = l.id)
      )
  );
$$;

comment on function can_checkin_at is
  'จุดออกบูธ (location_type=event) ทุกคนเช็คอินได้ นับชั่วโมงอย่างเดียว ไม่กระทบตารางเวร';

-- ── 3. ออกบูธ IMPACT ไม่ใช่หน่วยงาน — ลบทิ้ง เหลือเป็นสถานที่อย่างเดียว ──
-- (ยังไม่มีใครถูก assign เข้าหน่วยงาน จึงลบได้ปลอดภัย)
delete from business_unit_work_days
 where business_unit_id in (select id from business_units where name = 'ออกบูธ IMPACT');
delete from business_units where name = 'ออกบูธ IMPACT';

-- ── 4. คลังสินค้า = จันทร์-เสาร์ ────────────────────────────────────────
with wh as (
  select id from business_units
   where name in ('โกดังใหม่ตลาดไท', 'คลังหลัก พระราม 2')
)
insert into business_unit_work_days (business_unit_id, day_of_week, work_mode)
select wh.id, 6, 'onsite' from wh
on conflict (business_unit_id, day_of_week)
do update set work_mode = 'onsite';

update business_units
   set coverage_days_per_week = 6, default_days_per_week = 6
 where name in ('โกดังใหม่ตลาดไท', 'คลังหลัก พระราม 2');

-- ── 5. ออฟฟิศ AGD: ทำงาน จ-ศ · เข้าออฟฟิศ อ พฤ ศ · จ,พ ทำที่บ้าน ────────
with bu as (
  select id from business_units bu
   where bu.name = 'ออฟฟิศ AGD'
)
insert into business_unit_work_days (business_unit_id, day_of_week, work_mode)
select bu.id, d.dow, d.mode
from bu, (values
  (0, 'off'), (1, 'wfh'), (2, 'onsite'), (3, 'wfh'),
  (4, 'onsite'), (5, 'onsite'), (6, 'off')
) as d(dow, mode)
on conflict (business_unit_id, day_of_week)
do update set work_mode = excluded.work_mode;

update business_units
   set coverage_days_per_week = 5, default_days_per_week = 5
 where name = 'ออฟฟิศ AGD';

-- ── 6. ร้าน/ห้าง: เปิด 7 วัน · คนหนึ่งทำ 6 วัน (ตั้งรายคนเป็น 5 ได้) ────
update business_units
   set coverage_days_per_week = 7, default_days_per_week = 6
 where unit_type = 'shop';

-- ── 7. ออฟฟิศแบบสลับเวร — coverage = จำนวนวันที่คนหนึ่งทำ (ยังไม่ได้ถาม) ─
update business_units
   set coverage_days_per_week = default_days_per_week
 where coverage_days_per_week is null
   and default_days_per_week is not null;
