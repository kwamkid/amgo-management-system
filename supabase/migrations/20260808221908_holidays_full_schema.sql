-- ═══════════════════════════════════════════════════════════════════════
-- ขยายตาราง holidays ให้ครบตามที่หน้าจอใช้จริง
--
-- ตอนออกแบบครั้งแรก collection holidays บน Firestore ว่างเปล่า จึงสร้างไว้
-- แค่ (วันที่ · ชื่อ) พอมาย้าย holidayService ถึงเห็นว่าหน้าจอใช้มากกว่านั้น:
-- ประเภทวันหยุด · เรตโอที · จำกัดเฉพาะบางสาขา/บางตำแหน่ง · วันหยุดประจำปี
-- ═══════════════════════════════════════════════════════════════════════

alter table holidays
  add column if not exists holiday_type text not null default 'public'
    check (holiday_type in ('public','company','special')),
  add column if not exists is_working_day boolean not null default false,
  -- เรตโอทีต่างกันตามลักษณะงาน (หน้าร้าน 2 เท่า · ออฟฟิศ 1.5 เท่า)
  add column if not exists overtime_rates jsonb not null
    default '{"office":1.5,"retail":2.0,"driver":1.5,"marketing":1.5}'::jsonb,
  -- ว่าง = ใช้ทุกสาขา / ทุกตำแหน่ง
  add column if not exists applicable_location_ids uuid[] not null default '{}',
  add column if not exists applicable_roles text[] not null default '{}',
  add column if not exists description text not null default '',
  add column if not exists recurring boolean not null default false,
  add column if not exists recurring_day smallint check (recurring_day between 1 and 31),
  add column if not exists recurring_month smallint check (recurring_month between 1 and 12),
  add column if not exists created_by uuid references users(id),
  add column if not exists updated_by uuid references users(id);

create index if not exists holidays_date_active on holidays (holiday_date) where is_active;

comment on column holidays.applicable_location_ids is
  'ว่าง = ทุกสาขา — ไม่ได้ทำเป็น foreign key เพราะเป็น array และลบสาขาแล้วไม่ควรลบวันหยุดตาม';
