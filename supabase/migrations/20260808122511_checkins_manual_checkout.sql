-- ═══════════════════════════════════════════════════════════════════════
-- HR ปิดกะให้พนักงานเอง — ตกหล่นตอนออกแบบ schema รอบแรก
--
-- ของเดิมใน Firestore มี manualCheckout / manualNote แต่ตอนย้ายมาไม่ได้
-- ทำคอลัมน์รองรับ ทำให้แยกไม่ออกว่าเวลาเลิกงานนี้พนักงานกดเอง
-- หรือ HR ใส่ให้ย้อนหลัง — ซึ่งต่างกันมากเวลาตรวจสอบค่าแรง/โอที
-- ═══════════════════════════════════════════════════════════════════════

alter table checkins
  add column if not exists manual_checkout boolean not null default false,
  add column if not exists manual_note text;

comment on column checkins.manual_checkout is
  'true = HR ปิดกะให้ ไม่ใช่พนักงานกดเอง — ดูเหตุผลที่ manual_note และร่องรอยที่ checkin_edits';

-- ย้ายข้อมูลเดิมจาก Firestore: แถวที่มี auto_checkout_note แต่ไม่ใช่ auto
-- คือ HR ปิดให้ (สคริปต์ย้ายข้อมูลรอบแรกยัดมารวมกัน)
update checkins
   set manual_checkout = true,
       manual_note = auto_checkout_note
 where auto_checkout_note is not null
   and not auto_checkout;

create index if not exists checkins_manual_checkout_idx
  on checkins (work_date) where manual_checkout;
