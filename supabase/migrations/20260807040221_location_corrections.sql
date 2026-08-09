-- ═══════════════════════════════════════════════════════════════════════
-- แผนแก้พิกัด/รัศมีสถานที่ — apply ตอน Phase 3 (ไม่แตะ Firebase)
--
-- วัดจาก checkin จริง 2,306 ครั้ง (90 วัน) ไม่ได้เดา
-- เก็บเป็นตารางไม่ใช่ hardcode ในสคริปต์ เพราะต้องรู้ย้อนหลังได้ว่า
-- แก้อะไรด้วยเหตุผลอะไร (ค่าเดิมยังอยู่ครบใน Firebase)
-- ═══════════════════════════════════════════════════════════════════════

create table location_corrections (
  firestore_name text primary key,
  action         text not null check (action in ('fix','merge_into','tighten')),
  new_lat        double precision,
  new_lng        double precision,
  new_radius     integer,
  merge_into_name text,
  new_location_type text check (new_location_type in ('office','mall','event','home')),
  evidence       text not null,
  created_at     timestamptz not null default now()
);

alter table location_corrections enable row level security;

comment on table location_corrections is
  'แผนแก้ข้อมูลสถานที่ — วัดจาก checkin จริง 90 วัน (2,306 ครั้ง)';

insert into location_corrections
  (firestore_name, action, new_lat, new_lng, new_radius, merge_into_name, new_location_type, evidence) values
('Emporium', 'fix', 13.7306421, 100.5693582, 200, null, 'mall',
 'p50 ห่างหมุด 533m · 75 checkin อยู่ในรัศมี 0% · ระยะเกาะกลุ่ม 520-674m = หมุดผิดไม่ใช่ GPS เพี้ยน'),
('ABC สาขา Mega', 'fix', null, null, 500, null, 'mall',
 'p90=444m p95=480m จาก 150 checkin · รัศมี 200m ครอบแค่ 71% → 500m ครอบ 96%'),
('Siam Paragon', 'fix', null, null, 300, null, 'mall',
 'p90=286m จาก 138 checkin · 200m ครอบ 87% → 300m ครอบ 97% (รวม Toys zone แล้ว)'),
('Siam Paragon (Toys zone)', 'merge_into', null, null, null, 'Siam Paragon', null,
 'ห่างจาก Siam Paragon แค่ 190m = ห้างเดียวกัน คนละแผนก → ย้ายคนไป + ตั้ง department'),
('วังเด็ก', 'fix', null, null, 150, null, 'office',
 'p95=119m จาก 510 checkin · 50m ครอบ 90% → 150m ครอบ 95% (รวม aDay Fresh 182 checkin แล้ว)'),
('	aDay Fresh', 'merge_into', null, null, null, 'วังเด็ก', null,
 'ห่างจากวังเด็กแค่ 35m = ออฟฟิศหลักเดียวกัน → ย้ายคน 7 คน + ตั้ง department (ชื่อเดิมมี tab นำหน้า)'),
('ABC @Rama 2', 'tighten', null, null, 50, null, 'mall',
 'p95=33m จาก 93 checkin · บีบจาก 100m → 50m ยังครอบ 99%'),
('โกดังใหม่ตลาดไท', 'tighten', null, null, 50, null, 'office',
 'p95=30m จาก 335 checkin · บีบจาก 100m → 50m ยังครอบ 97%'),
('Central Chidlom', 'tighten', null, null, 150, null, 'mall',
 'p95=111m จาก 70 checkin · บีบจาก 200m → 150m ยังครอบ 96%'),
('คลังหลัก พระราม 2', 'fix', null, null, 100, null, 'office', 'รัศมีเดิมครอบ 99% แล้ว — แก้แค่ประเภท'),
('Central World',      'fix', null, null, 200, null, 'mall',   'รัศมีเดิมครอบ 97% แล้ว — แก้แค่ประเภท'),
('ABC สาขา Icon Siam', 'fix', null, null, 200, null, 'mall',   'ปิดสาขาไปแล้ว (3 checkin) — แก้แค่ประเภท'),
('IMPACT, Muang Thong Thani,', 'fix', null, null, 500, null, 'event',
 'ออกบูธ — มีแค่ 6 checkin ข้อมูลไม่พอปรับรัศมี คงเดิมไว้'),
('บ้านปู ADF',  'fix', null, null, 100, null, 'home', 'p50=21m คนยืนตรงหมุด — รัศมีเดิมพอ แก้แค่ประเภท'),
('บ้านขวัญ',    'fix', null, null, 100, null, 'home', 'มีแค่ 1 checkin ข้อมูลไม่พอ — แก้แค่ประเภท');
