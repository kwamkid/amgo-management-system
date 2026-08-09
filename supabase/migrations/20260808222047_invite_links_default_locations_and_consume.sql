-- ═══════════════════════════════════════════════════════════════════════
-- ลิงก์เชิญพนักงาน — เติมสิ่งที่ขาดตอนย้าย inviteService
-- ═══════════════════════════════════════════════════════════════════════

-- สาขาที่จะกำหนดให้คนที่สมัครผ่านลิงก์นี้ (ของเดิมมี ตอนย้ายตกไป)
alter table invite_links
  add column if not exists default_location_ids uuid[] not null default '{}';

-- ── นับการใช้งานแบบชนกันไม่ได้ ─────────────────────────────────────────
-- ของเดิมใช้ increment() ของ Firestore  ถ้าอ่านมาบวกแล้วเขียนกลับใน JS
-- สองคนกดพร้อมกันจะนับหายไป 1 และลิงก์ที่จำกัด 1 ครั้งจะถูกใช้ได้ 2 คน
--
-- ตัวนี้เช็คเงื่อนไข + เพิ่มตัวนับในคำสั่งเดียว ผลลัพธ์บอกว่าใช้ได้จริงไหม
create or replace function consume_invite_link(p_code text)
returns table (
  id uuid,
  default_role text,
  default_location_ids uuid[],
  allow_checkin_outside_location boolean,
  require_approval boolean
)
language sql
security definer          -- คนสมัครยังไม่ได้ล็อกอิน จึงยังไม่มีสิทธิ์ตามปกติ
set search_path = ''
as $$
  update public.invite_links l
     set used_count = l.used_count + 1,
         updated_at = now()
   where l.code = upper(trim(p_code))
     and l.is_active
     and (l.expires_at is null or l.expires_at > now())
     and (l.max_uses is null or l.used_count < l.max_uses)
  returning l.id, l.default_role, l.default_location_ids,
            l.allow_checkin_outside_location, l.require_approval;
$$;

comment on function consume_invite_link is
  'ตรวจ+นับในคำสั่งเดียว — ไม่คืนแถวแปลว่าลิงก์ใช้ไม่ได้ (หมดอายุ/ครบโควตา/ปิดแล้ว)';

revoke execute on function consume_invite_link(text) from public, anon, authenticated;

-- ตรวจอย่างเดียว ไม่นับ — ใช้ตอนแสดงหน้าสมัครก่อนกดยืนยัน
create or replace function peek_invite_link(p_code text)
returns table (
  id uuid,
  code text,
  default_role text,
  default_location_ids uuid[],
  allow_checkin_outside_location boolean,
  require_approval boolean,
  max_uses integer,
  used_count integer,
  expires_at timestamptz,
  is_active boolean
)
language sql
security definer
stable
set search_path = ''
as $$
  select l.id, l.code, l.default_role, l.default_location_ids,
         l.allow_checkin_outside_location, l.require_approval,
         l.max_uses, l.used_count, l.expires_at, l.is_active
    from public.invite_links l
   where l.code = upper(trim(p_code));
$$;

revoke execute on function peek_invite_link(text) from public, anon, authenticated;
