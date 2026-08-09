-- ═══════════════════════════════════════════════════════════════════════
-- RLS: ผู้ใช้ · เช็คอิน · การลา
--
-- หลักคิด: "เห็นของตัวเองเสมอ · หัวหน้าเห็นของทีม · HR แก้ได้"
-- ตารางตั้งค่า (สถานที่ กะ วันหยุด) ให้พนักงานอ่านได้หมด เพราะหน้าเช็คอิน
-- ต้องใช้คำนวณ geofence
-- ═══════════════════════════════════════════════════════════════════════

/* ── users ─────────────────────────────────────────────────────────────
   อ่านได้ทุกคน — ทั้งระบบต้องแสดงชื่อ/รูปคนอื่น (ใบลา ตารางเวร แผนที่ส่งของ)
   ข้อมูลอ่อนไหวจริง ๆ คือเงินเดือน ซึ่งอยู่คนละตาราง (user_compensation) */
create policy users_select on users
  for select to authenticated
  using (deleted_at is null);

/* แก้ของตัวเองได้เฉพาะข้อมูลติดต่อ — role/สถานะ/หน่วยงาน ห้ามแตะ
   (บังคับด้วย trigger ข้างล่าง เพราะ RLS เช็ครายคอลัมน์ไม่ได้) */
create policy users_update_own on users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy users_manage on users
  for all to authenticated
  using (is_hr()) with check (is_hr());

create or replace function trg_guard_user_self_edit()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  -- HR/admin แก้ได้หมด
  if public.is_hr() then return new; end if;

  -- คนทั่วไปแก้ตัวเองได้แค่ข้อมูลติดต่อ ที่เหลือดันค่าเดิมกลับ
  new.role                := old.role;
  new.employment_status   := old.employment_status;
  new.employment_type     := old.employment_type;
  new.business_unit_id    := old.business_unit_id;
  new.start_date          := old.start_date;
  new.start_date_verified := old.start_date_verified;
  new.end_date            := old.end_date;
  new.days_per_week       := old.days_per_week;
  new.payroll_cycle       := old.payroll_cycle;
  new.requires_checkin    := old.requires_checkin;
  new.wfh_eligible        := old.wfh_eligible;
  new.is_active           := old.is_active;
  new.needs_approval      := old.needs_approval;
  new.allow_checkin_outside_location := old.allow_checkin_outside_location;
  new.deleted_at          := old.deleted_at;
  return new;
end;
$$;

create trigger users_guard_self_edit
  before update on users
  for each row execute function trg_guard_user_self_edit();

comment on function trg_guard_user_self_edit is
  'RLS สั่งได้แค่ "แก้แถวนี้ได้/ไม่ได้" แยกรายคอลัมน์ไม่ได้ — ตัวนี้กันไม่ให้พนักงานเลื่อนขั้นตัวเอง';

/* ── checkins ──────────────────────────────────────────────────────── */
create policy checkins_select_own on checkins
  for select to authenticated
  using (user_id = auth.uid() or can_view_all());

create policy checkins_insert_own on checkins
  for insert to authenticated
  with check (user_id = auth.uid());

/* แก้ได้เฉพาะกะที่ยังไม่ปิด — ปิดแล้วต้องให้ HR แก้ จะได้มีร่องรอยใน checkin_edits */
create policy checkins_update_own_open on checkins
  for update to authenticated
  using (user_id = auth.uid() and checkout_time is null)
  with check (user_id = auth.uid());

create policy checkins_manage on checkins
  for all to authenticated
  using (is_hr()) with check (is_hr());

create policy checkin_edits_select on checkin_edits
  for select to authenticated
  using (
    can_view_all()
    or exists (select 1 from checkins c where c.id = checkin_id and c.user_id = auth.uid())
  );

create policy checkin_edits_manage on checkin_edits
  for all to authenticated
  using (is_hr()) with check (is_hr());

/* ── การลา ─────────────────────────────────────────────────────────── */
create policy leave_requests_select on leave_requests
  for select to authenticated
  using (user_id = auth.uid() or can_view_all());

create policy leave_requests_insert_own on leave_requests
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

/* ถอนใบลาของตัวเองได้เฉพาะตอนยังไม่อนุมัติ */
create policy leave_requests_update_own_pending on leave_requests
  for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid());

/* 🔴 อนุมัติได้เฉพาะ hr/admin — manager อนุมัติไม่ได้ (ตัดสินใจ 2026-08-07) */
create policy leave_requests_manage on leave_requests
  for all to authenticated
  using (is_hr()) with check (is_hr());

create policy leave_days_select on leave_days
  for select to authenticated
  using (user_id = auth.uid() or can_view_all());

create policy leave_days_manage on leave_days
  for all to authenticated
  using (is_hr()) with check (is_hr());

/* ยื่นใบลาต้องเขียน leave_days ของตัวเองได้ด้วย */
create policy leave_days_insert_own on leave_days
  for insert to authenticated
  with check (user_id = auth.uid());

create policy leave_quotas_select on leave_quotas
  for select to authenticated
  using (user_id = auth.uid() or can_view_all());

create policy leave_quotas_manage on leave_quotas
  for all to authenticated
  using (is_hr()) with check (is_hr());

create policy leave_quota_history_select on leave_quota_history
  for select to authenticated
  using (user_id = auth.uid() or can_view_all());

create policy leave_quota_history_manage on leave_quota_history
  for all to authenticated
  using (is_hr()) with check (is_hr());

create policy carry_over_logs_manage on carry_over_logs
  for all to authenticated
  using (is_hr()) with check (is_hr());
