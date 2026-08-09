-- ═══════════════════════════════════════════════════════════════════════
-- 🔴 อุดช่องโหว่: view รันด้วยสิทธิ์ของคนสร้าง ไม่ใช่คนเรียก
--
-- Postgres ตั้ง view เป็น SECURITY DEFINER โดยปริยาย = ข้าม RLS ของตารางข้างใน
-- ผลคือ salary_history ยิงผ่าน /rest/v1/salary_history ได้ทันทีที่ล็อกอิน
-- แล้วเห็น "เงินเดือนทุกคนทั้งบริษัท" ทั้งที่ policy ของ user_compensation
-- กำหนดไว้ว่าเห็นได้เฉพาะของตัวเอง — view เดินอ้อมไปเลย
--
-- security_invoker = true บังคับให้ view เคารพ RLS ของคนที่เรียก
-- ═══════════════════════════════════════════════════════════════════════

alter view salary_history      set (security_invoker = true);
alter view employee_directory  set (security_invoker = true);

comment on view salary_history is
  'security_invoker=true — เห็นเฉพาะแถวที่ RLS ของ user_compensation ยอมให้เห็น (ตัวเอง หรือ hr/admin)';

-- ── trg_audit เป็นฟังก์ชัน trigger ไม่ควรเรียกจาก REST ได้ ────────────
revoke execute on function trg_audit() from anon, authenticated, public;

-- ── ฟังก์ชันเช็คสิทธิ์: ต้องให้ authenticated เรียกได้ (policy ใช้อยู่)
--    แต่คนที่ยังไม่ล็อกอินไม่ต้องรู้อะไรทั้งนั้น ────────────────────────
revoke execute on function auth_role(), is_hr(), is_admin(), can_view_all() from anon, public;
grant execute on function auth_role(), is_hr(), is_admin(), can_view_all() to authenticated;
