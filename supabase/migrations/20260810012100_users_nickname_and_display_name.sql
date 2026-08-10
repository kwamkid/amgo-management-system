-- แยก "ชื่อเล่น" ออกมาเป็นคอลัมน์ของตัวเอง
--
-- ── ปัญหา ─────────────────────────────────────────────────────────────
-- ชื่อที่ระบบเก่าเก็บมามี 3 แบบปนกัน
--   1. ชื่อจริง + ชื่อเล่นในวงเล็บ   "นางสาวอนงค์ สุขพลอย (แตน)"
--   2. ชื่อจริงอย่างเดียว            "Palapol junturat"
--   3. ชื่อ LINE ล้วน ๆ              "🌨️🌈🌻" · "winko" · "koโก koโก"
-- แบบที่ 3 ดูไม่ออกว่าใครเป็นใคร และไม่มีทางรู้จากข้อมูลที่มี
--
-- ── ที่ทำ ──────────────────────────────────────────────────────────────
-- · ดึงชื่อเล่นจากวงเล็บท้ายชื่อออกมาเก็บแยก (แบบที่ 1 — ทำได้อัตโนมัติ)
-- · name_verified บอกว่า "มีคนยืนยันชื่อนี้แล้ว" แบบเดียวกับ start_date_verified
--   แบบที่ 3 ได้ false ทั้งหมด → หน้า bulk edit ขึ้นเตือนให้ HR กรอก
-- · display_name เป็นคอลัมน์คำนวณ ใช้แสดงผลทุกที่ จะได้ไม่ต้องต่อสตริงเอง
--   ในโค้ดหลายสิบจุดแล้วเผลอทำไม่เหมือนกัน

alter table public.users
  add column if not exists nickname      text,
  add column if not exists name_verified boolean not null default false;

comment on column public.users.nickname is 'ชื่อเล่น — ใช้เรียกกันในที่ทำงาน';
comment on column public.users.name_verified is 'true = มีคนยืนยันว่าเป็นชื่อจริง (false = ยังเป็นชื่อ LINE ที่ลากมาจากระบบเก่า)';

-- ช่องว่างซ้ำจากการกรอกมือ ทำให้จับคู่ชื่อพลาด — เก็บกวาดก่อน
update public.users
set full_name = btrim(regexp_replace(full_name, '\s+', ' ', 'g'))
where full_name <> btrim(regexp_replace(full_name, '\s+', ' ', 'g'));

-- 1) ชื่อเล่นที่อยู่ในวงเล็บท้ายชื่อ — ย้ายออกมา
update public.users
set nickname      = nullif(btrim((regexp_match(full_name, '\(([^()]*)\)\s*$'))[1]), ''),
    full_name     = btrim(regexp_replace(full_name, '\s*\([^()]*\)\s*$', '')),
    name_verified = true
where full_name ~ '\([^()]*\)\s*$';

-- 2) ชื่อที่ไม่เหมือนชื่อ LINE = เคยมีคนกรอกไว้แล้ว ถือว่าชื่อจริงใช้ได้
--    (ที่ยังขาดคือชื่อเล่น)
update public.users
set name_verified = true
where not name_verified
  and btrim(full_name) <> btrim(line_display_name);

-- 3) บัญชีระบบไม่ใช่คน ไม่ต้องรอใครมากรอก
update public.users set name_verified = true where is_system;

-- 4) ชื่อสำหรับแสดงผล — "ชื่อจริง (ชื่อเล่น)"
alter table public.users
  add column display_name text
  generated always as (
    case
      when nickname is null or btrim(nickname) = '' then full_name
      else full_name || ' (' || btrim(nickname) || ')'
    end
  ) stored;

comment on column public.users.display_name is 'ชื่อที่ใช้แสดงผล = ชื่อจริง (ชื่อเล่น) — คำนวณอัตโนมัติ เขียนตรง ๆ ไม่ได้';
