-- ═══════════════════════════════════════════════════════════════════════
-- 🔴 กู้ชั่วโมงทำงานที่ระบบเดิมไม่ได้บันทึก (พบตอน migrate 2026-08-07)
--
-- อาการ: เช็คอิน-เช็คเอาท์ครบ status=completed แต่ regular_hours = 0
-- สัดส่วนต่อเดือน: 2-7% (ก.ค.-ธ.ค. 2025) → 14% (ม.ค. 2026) → 20-27% (ก.พ. เป็นต้นมา)
-- รวม 1,465 ครั้ง — กระทบค่าโอทีและการคิดเงินเดือนโดยตรง
--
-- แก้: คำนวณใหม่จาก checkout_time - checkin_time - break_hours
--      ใส่เป็น regular_hours ทั้งก้อน ไม่เดาว่าส่วนไหนเป็นโอที
--      (แยกโอทีต้องรู้กะที่แน่นอน ซึ่งข้อมูลเดิมไม่ครบ)
-- ═══════════════════════════════════════════════════════════════════════

alter table checkins
  add column if not exists hours_recomputed boolean not null default false;

comment on column checkins.hours_recomputed is
  'true = ชั่วโมงคำนวณย้อนหลังจากเวลาเข้า-ออก เพราะระบบเดิมบันทึกเป็น 0 — ตัวเลขนี้ไม่ได้มาจากของเดิม';

with fixed as (
  update checkins c
  set regular_hours = round(
        greatest(0,
          extract(epoch from (c.checkout_time - c.checkin_time)) / 3600.0
          - coalesce(c.break_hours, 0)
        )::numeric, 2),
      hours_recomputed = true
  where c.checkout_time is not null
    and c.checkin_time is not null
    and c.checkout_time > c.checkin_time
    and coalesce(c.regular_hours, 0) = 0
    and coalesce(c.overtime_hours, 0) = 0
  returning c.regular_hours
)
insert into app_settings (key, value)
select 'migration_recomputed_hours',
       jsonb_build_object(
         'rows', count(*),
         'hours_restored', round(sum(regular_hours), 1),
         'reason', 'ระบบเดิมไม่ได้บันทึกชั่วโมง เริ่มหนักขึ้นตั้งแต่ ม.ค. 2026',
         'method', 'checkout_time - checkin_time - break_hours'
       )
from fixed
on conflict (key) do update set value = excluded.value;

-- ── RPC สำหรับตรวจยอดรวม (ของเดิม select ผ่าน PostgREST ติดลิมิต 1000 แถว) ──
create or replace function sum_total_hours()
returns table (rows bigint, total_hours numeric, recomputed_rows bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*),
         round(sum(c.total_hours), 1),
         count(*) filter (where c.hours_recomputed)
  from public.checkins c;
$$;
