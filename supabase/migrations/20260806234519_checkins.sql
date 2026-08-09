-- ═══════════════════════════════════════════════════════════════════════
-- 0002 — checkins (กำไรใหญ่สุดของการย้าย)
--
-- ของเดิม: checkins/{date}/records/{id} — query ข้ามวันไม่ได้เลย
-- รายงาน 30 วัน = ยิง 30 query แล้ว group ใน JS (reportService.ts:261-293)
-- ของใหม่: ตารางเดียว + work_date → query เดียวจบ, JOIN users/locations ได้
--
-- ข้อมูลจริง 10,254 records / 404 วัน (2025-06-26 → 2026-08-07)
-- ═══════════════════════════════════════════════════════════════════════

create table checkins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete restrict,
  work_date   date not null,               -- เดิมคือชื่อ parent doc

  -- ── check in ──
  checkin_time      timestamptz not null,
  checkin_lat       double precision not null,
  checkin_lng       double precision not null,
  checkin_type      text not null default 'onsite'
                    check (checkin_type in ('onsite','offsite','wfh')),
  checkin_photo_url text,

  primary_location_id   uuid references locations(id) on delete set null,
  primary_location_name text,              -- snapshot ตอนเช็คอิน
  locations_in_range    text[] not null default '{}',

  -- กะที่เลือก — ของเดิมเก็บเป็นชื่อ+เวลา ไม่ใช่ id (selectedShift = null ทุกแถว)
  -- ใส่ทั้ง FK และ snapshot: FK ไว้ JOIN, snapshot ไว้กันกะถูกแก้ทีหลัง
  shift_id          uuid references shifts(id) on delete set null,
  shift_name        text,
  shift_start_time  time,
  shift_end_time    time,

  -- ── check out (null ได้ = ยังไม่เช็คเอาท์) ──
  checkout_time  timestamptz,
  checkout_lat   double precision,
  checkout_lng   double precision,
  checkout_note  text,

  -- ── ชั่วโมงทำงาน ──
  regular_hours  numeric(5,2) not null default 0,
  overtime_hours numeric(5,2) not null default 0,
  break_hours    numeric(5,2) not null default 0,
  -- ตรวจข้อมูลจริงแล้ว 10,254/10,254 แถว total = regular + overtime พอดี (0 mismatch)
  -- จึงทำเป็น generated column ได้โดยไม่แก้ตัวเลขย้อนหลัง
  total_hours    numeric(5,2) generated always as (regular_hours + overtime_hours) stored,

  -- ── สถานะ + flags ──
  status       text not null default 'checked-in'
               check (status in ('checked-in','completed','pending')),
  is_late      boolean not null default false,
  late_minutes integer not null default 0,

  is_overnight_shift      boolean not null default false,
  needs_overtime_approval boolean not null default false,
  forgot_checkout         boolean not null default false,
  auto_checkout           boolean not null default false,
  auto_checkout_at        timestamptz,
  auto_checkout_note      text,

  note text,

  -- snapshot ชื่อ/รูป ณ เวลานั้น (เอกสารทางการ — ไม่ JOIN เอา
  -- เพราะรายงานย้อนหลังต้องตรงกับตอนนั้น แม้คนจะเปลี่ยนชื่อทีหลัง)
  user_name   text not null default '',
  user_avatar text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- บังคับที่ระดับ DB: เช็คเอาท์ต้องหลังเช็คอิน (ของเดิมเป็นแค่ logic ใน JS)
  constraint checkout_after_checkin
    check (checkout_time is null or checkout_time > checkin_time),

  -- เช็คเอาท์แล้วต้องมีพิกัดครบ
  constraint checkout_coords_together
    check ((checkout_lat is null) = (checkout_lng is null)),

  constraint hours_not_negative
    check (regular_hours >= 0 and overtime_hours >= 0 and break_hours >= 0)
);

-- index ตามรูปแบบ query จริง
create index on checkins (work_date, user_id);          -- รายงานรายวัน
create index on checkins (user_id, work_date desc);     -- ประวัติรายคน
create index on checkins (work_date) where status <> 'completed';  -- หาคนลืมเช็คเอาท์
create index on checkins (primary_location_id, work_date);

-- กันเช็คอินซ้อนในวันเดียวกัน (ยังไม่ปิดงานเก่าห้ามเปิดใหม่)
-- ⚠️ ต้องยืนยันกติกาธุรกิจก่อนเปิดใช้ — ถ้ามีเคสเช็คอิน 2 รอบต่อวัน
--    (เช้า/บ่าย คนละกะ) ให้ลบ index นี้ทิ้ง
create unique index checkins_one_open_per_day
  on checkins (user_id, work_date)
  where status <> 'completed';

create trigger checkins_updated_at before update on checkins
  for each row execute function set_updated_at();

comment on column checkins.work_date is
  'เดิมคือชื่อ parent doc ของ checkins/{date}/records — แบนมาเป็นคอลัมน์';
comment on column checkins.total_hours is
  'generated — ยืนยันแล้วว่าข้อมูลเดิม 10,254 แถวตรงสูตร regular+overtime ครบ 100%';

-- ── checkin_edits — audit trail จาก editHistory[] ──────────────────────
create table checkin_edits (
  id            uuid primary key default gen_random_uuid(),
  checkin_id    uuid not null references checkins(id) on delete cascade,
  edited_by     uuid references users(id),
  edited_by_name text not null default '',
  edited_at     timestamptz not null,
  field         text not null,
  old_value     text,
  new_value     text,
  reason        text not null default ''
);

create index on checkin_edits (checkin_id, edited_at desc);

comment on table checkin_edits is 'แตกจาก checkins.editHistory[] — ห้ามลบ เป็นหลักฐานการแก้เวลาทำงาน';

alter table checkins      enable row level security;
alter table checkin_edits enable row level security;
