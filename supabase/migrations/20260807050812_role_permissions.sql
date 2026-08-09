-- ═══════════════════════════════════════════════════════════════════════
-- ตารางสิทธิ์ (ตัดสินใจ 2026-08-07)
-- เป็นทั้งเอกสารและ config ให้ UI ซ่อน/แสดงเมนู · RLS Phase 6 เขียนตามนี้
--
-- แก้ 2 จุดที่ผิดในระบบเดิม (จาก firestore.rules):
--   1. quotas: allow read if isAuthenticated() → พนักงานทุกคนเห็นโควตาลาของทุกคน
--   2. hr ทำ Influencer/Campaign ได้ ทั้งที่ไม่เกี่ยวกับงาน HR
-- ═══════════════════════════════════════════════════════════════════════

create table role_permissions (
  role       text not null references role_settings(role) on delete cascade,
  resource   text not null,
  can_read_own  boolean not null default false,
  can_read_all  boolean not null default false,
  can_write     boolean not null default false,
  note       text not null default '',
  primary key (role, resource)
);

alter table role_permissions enable row level security;

comment on table role_permissions is 'สิทธิ์ตาม role — RLS Phase 6 เขียนตามตารางนี้ · UI ใช้ซ่อนเมนู';

insert into role_permissions (role, resource, can_read_own, can_read_all, can_write, note) values
('employee','attendance', true,false,false,'เห็นเฉพาะของตัวเอง'),
('driver',  'attendance', true,false,false,''),
('marketing','attendance',true,false,false,''),
('manager', 'attendance', true,true, false,'ดูของทีมได้ แต่แก้เวลาไม่ได้'),
('hr',      'attendance', true,true, true, 'แก้เวลาย้อนหลังได้ (บันทึกใน checkin_edits)'),
('admin',   'attendance', true,true, true, ''),

('employee','leave', true,false,true,'ยื่นใบลาของตัวเองได้'),
('driver',  'leave', true,false,true,''),
('marketing','leave',true,false,true,''),
('manager', 'leave', true,true, true,'อนุมัติได้'),
('hr',      'leave', true,true, true,'อนุมัติได้'),
('admin',   'leave', true,true, true,''),

-- ⚠️ ระบบเดิมทุกคนเห็นโควตาของทุกคน แก้แล้ว
('employee','leave_quota', true,false,false,'เดิมเห็นของทุกคน — แก้ให้เห็นเฉพาะตัวเอง'),
('driver',  'leave_quota', true,false,false,''),
('marketing','leave_quota',true,false,false,''),
('manager', 'leave_quota', true,true, false,'ดูได้เพื่อพิจารณาอนุมัติลา แต่ตั้งไม่ได้'),
('hr',      'leave_quota', true,true, true, ''),
('admin',   'leave_quota', true,true, true, ''),

-- 🔒 เงินเดือน: admin + hr เท่านั้น · เจ้าตัวดูของตัวเองได้
('employee','compensation', true,false,false,'ดูเงินเดือนตัวเองได้'),
('driver',  'compensation', true,false,false,''),
('marketing','compensation',true,false,false,''),
('manager', 'compensation', true,false,false,'🔒 manager ไม่เห็นเงินเดือนลูกน้อง'),
('hr',      'compensation', true,true, true, ''),
('admin',   'compensation', true,true, true, ''),

('manager','employees', false,true,false,'ดูรายชื่อได้ แก้ไม่ได้'),
('hr',     'employees', false,true,true, ''),
('admin',  'employees', false,true,true, ''),
('hr',     'org_setup', false,true,true, 'สาขา หน่วยงาน วันหยุด โควตากลาง'),
('admin',  'org_setup', false,true,true, ''),

-- ⚠️ ระบบเดิม hr ทำ Influencer ได้ด้วย ตัดออก
('marketing','influencer', true,true,true,''),
('manager',  'influencer', true,true,true,''),
('admin',    'influencer', true,true,true,''),

('driver', 'delivery', true, false,true, 'เห็นและแก้เฉพาะงานของตัวเอง'),
('manager','delivery', false,true, false,''),
('hr',     'delivery', false,true, true, ''),
('admin',  'delivery', false,true, true, ''),

('admin',  'system_settings', false,true,true,'admin เท่านั้น');
