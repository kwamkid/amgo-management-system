-- ═══════════════════════════════════════════════════════════════════════
-- แก้ recompute_missing_hours ที่ทำไว้กว้างเกินไป
--
-- ปัญหาที่เจอหลังคำนวณ:
--   · 179 แถว auto_checkout — ระบบปิดให้ตอน 18:00 ไม่ใช่เวลาเลิกงานจริง
--     เฉลี่ยออกมา 15.4 ชม./วัน ซึ่งเป็นไปไม่ได้
--   · 329 แถวเช็คเอาท์เองแต่เกิน 12 ชม. สูงสุด 26.55 ชม.
--     (น่าจะกดเช็คเอาท์วันรุ่งขึ้น)
--
-- ตัวเลขนี้เอาไปคิดค่าโอที ห้ามเดา → แยกเป็น 3 สถานะ ให้ HR ตรวจของที่ไม่แน่ใจ
-- ═══════════════════════════════════════════════════════════════════════

alter table checkins
  add column if not exists hours_status text not null default 'original'
    check (hours_status in ('original', 'recomputed', 'needs_review'));

comment on column checkins.hours_status is
  'original=ตัวเลขจากระบบเดิม · recomputed=คำนวณจากเวลาเข้า-ออก เชื่อถือได้ · needs_review=ไม่รู้เวลาเลิกจริง ต้องให้ HR ใส่เอง';

-- เกิน 16 ชม. = เป็นไปไม่ได้ในวันเดียว ไม่ว่าจะกะไหน
update checkins
   set hours_status = case
         when auto_checkout then 'needs_review'
         when regular_hours > 16 then 'needs_review'
         else 'recomputed'
       end
 where hours_recomputed;

-- ของที่ต้องตรวจ → คืนเป็น 0 ดีกว่าใส่ตัวเลขผิดแล้วจ่ายโอทีเกิน
update checkins
   set regular_hours = 0
 where hours_status = 'needs_review';

alter table checkins drop column hours_recomputed;

create index if not exists checkins_needs_review
  on checkins (work_date) where hours_status = 'needs_review';

drop function if exists sum_total_hours();

create function sum_total_hours()
returns table (rows bigint, total_hours numeric, recomputed bigint, needs_review bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*),
         round(sum(c.total_hours), 1),
         count(*) filter (where c.hours_status = 'recomputed'),
         count(*) filter (where c.hours_status = 'needs_review')
  from public.checkins c;
$$;

update app_settings
   set value = value || jsonb_build_object(
         'revised', 'auto_checkout และเกิน 16 ชม. ถูกตีกลับเป็น needs_review ไม่นับชั่วโมง'
       )
 where key = 'migration_recomputed_hours';
