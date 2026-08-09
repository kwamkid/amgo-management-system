-- ═══════════════════════════════════════════════════════════════════════
-- ค่าที่ต้องตั้งให้พนักงานหลัง Phase 3 ย้ายข้อมูลเสร็จ
-- (ตอนนี้ตาราง users ยังว่าง ตั้งเลยไม่ได้)
--
-- match ด้วย line_display_name เพราะ fullName บางคนไม่มีชื่อเล่น
-- ยืนยันชื่อกับเจ้าของระบบแล้วทุกคน 2026-08-07
--
-- ⚠️ WFH กับ "ไม่ต้องเช็คอิน" เป็นคนละเรื่อง:
--    wfh_eligible=true   → ยังต้องกดเช็คอิน แต่เช็คจากบ้านได้
--    requires_checkin=false → ไม่ต้องเช็คอินเลย
-- ═══════════════════════════════════════════════════════════════════════

create table user_settings_plan (
  match_line_display_name text primary key,
  nickname        text not null,
  full_name_hint  text,
  wfh_eligible    boolean,
  requires_checkin boolean,
  employment_type text check (employment_type in ('monthly','daily')),
  note            text not null default '',
  applied_at      timestamptz
);

alter table user_settings_plan enable row level security;

comment on table user_settings_plan is
  'ค่าที่ต้องตั้งหลัง Phase 3 — applied_at เป็น null คือยังไม่ได้ apply';

insert into user_settings_plan
  (match_line_display_name, nickname, full_name_hint, wfh_eligible, requires_checkin, employment_type, note) values
('Microphone🎙️',   'โฟน',     'Microphone🎙️',                            true, null, 'monthly', 'WFH ได้'),
('Chanchira',      'มิว',     'Chanchira',                               true, null, 'monthly', 'WFH ได้'),
('Mark31',         'มาร์ค',   'Palapol junturat',                        true, null, 'monthly', 'WFH ได้'),
('จิวยี่ 🪐🌟☀️',   'ยิ่ว',    'นายณัฐวัฒน์ โตบัว (ยิ่ว)',                true, null, 'monthly', 'WFH ได้'),
('N ❤️',           'นุช',     'Nutprawee Phanomsuai (Nuch)',             true, null, 'monthly', 'WFH ได้'),
('pangmee ✨',      'แป้งหมี่', 'นางสาวพิชชาภา เบญจมสุทิน (pangmee ✨)',    true, null, 'monthly', 'WFH ได้'),
('F。🍀',           'เฟื่อง',  'Fueangchat Jenkitrungruang (Fueang)',     null, false, 'monthly',
 'ไปไหนก็ได้ ไม่ต้องเช็คอิน — ไม่ใช่ WFH เพราะ WFH ยังต้องกดเช็คอินอยู่');
