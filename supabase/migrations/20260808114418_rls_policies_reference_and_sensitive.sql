-- ═══════════════════════════════════════════════════════════════════════
-- RLS: ตารางอ้างอิง · ข้อมูลอ่อนไหว · delivery · influencer
-- ═══════════════════════════════════════════════════════════════════════

/* ── ตารางตั้งค่าที่พนักงานต้องอ่านได้ ─────────────────────────────────
   หน้าเช็คอินต้องรู้พิกัด/รัศมี/กะ · หน้าลาต้องรู้วันหยุดกับประเภทการลา
   แก้ได้เฉพาะ hr/admin */
do $$
declare t text;
begin
  foreach t in array array[
    'locations','shifts','holidays','leave_types','leave_type_defaults',
    'companies','business_units','business_unit_work_days',
    'role_settings','role_permissions','payroll_cycles','ot_rate_settings',
    'user_allowed_locations','user_work_schedules','schedule_exceptions'
  ]
  loop
    execute format('create policy %I_read on %I for select to authenticated using (true)', t, t);
    execute format('create policy %I_manage on %I for all to authenticated using (public.is_hr()) with check (public.is_hr())', t, t);
  end loop;
end $$;

/* ── 🔴 เงินเดือน — อ่อนไหวที่สุดในระบบ ──────────────────────────────
   เห็นได้เฉพาะเจ้าตัวกับ hr/admin · manager ห้ามเห็นเงินเดือนลูกน้อง */
create policy user_compensation_select_own on user_compensation
  for select to authenticated
  using (user_id = auth.uid() or is_hr());

create policy user_compensation_manage on user_compensation
  for all to authenticated
  using (is_hr()) with check (is_hr());

/* ── 🔴 audit log — admin เท่านั้น ────────────────────────────────────
   เก็บค่าก่อน/หลังของทุกตาราง รวมเงินเดือน ถ้าให้ HR อ่านได้ก็เท่ากับ
   เปิดประวัติเงินเดือนย้อนหลังทั้งบริษัท */
create policy audit_log_admin_only on audit_log
  for select to authenticated
  using (is_admin());

/* เขียนได้อย่างเดียวผ่าน trigger — ไม่มี policy update/delete ให้ใครเลย
   แม้แต่ admin ก็ลบร่องรอยไม่ได้ผ่าน API */
create policy audit_log_insert on audit_log
  for insert to authenticated
  with check (true);

/* ── สิทธิ์รายบุคคล ─────────────────────────────────────────────────── */
create policy user_permissions_select on user_permissions
  for select to authenticated
  using (user_id = auth.uid() or is_hr());

create policy user_permissions_manage on user_permissions
  for all to authenticated
  using (is_admin()) with check (is_admin());

create policy user_settings_plan_read on user_settings_plan
  for select to authenticated using (is_hr());
create policy user_settings_plan_manage on user_settings_plan
  for all to authenticated using (is_admin()) with check (is_admin());

/* ── ลิงก์เชิญ — คนนอกยังไม่มี session ต้องตรวจผ่าน API ฝั่ง server ─── */
create policy invite_links_read on invite_links
  for select to authenticated using (is_hr());
create policy invite_links_manage on invite_links
  for all to authenticated using (is_hr()) with check (is_hr());

/* ── delivery — ทุกคนดูได้หมดรวมข้อมูลลูกค้า ปักหมุดได้เฉพาะ driver ──
   (ตัดสินใจ 2026-08-07: "ให้เห็นได้หมดเลยครับ") */
create policy delivery_routes_read on delivery_routes
  for select to authenticated using (true);
create policy delivery_routes_own on delivery_routes
  for all to authenticated
  using (driver_id = auth.uid() or is_hr())
  with check (driver_id = auth.uid() or is_hr());

create policy delivery_points_read on delivery_points
  for select to authenticated using (true);
create policy delivery_points_own on delivery_points
  for all to authenticated
  using (driver_id = auth.uid() or is_hr())
  with check (driver_id = auth.uid() or is_hr());

/* ── influencer marketing — ปิดใช้งานอยู่ เปิดให้ marketing/hr/admin ── */
do $$
declare t text;
begin
  foreach t in array array[
    'influencers','influencer_children','social_channels','campaigns',
    'campaign_brands','campaign_influencers','campaign_products',
    'brands','products','submissions','submitted_links'
  ]
  loop
    execute format(
      'create policy %I_marketing on %I for all to authenticated
         using (public.auth_role() in (''marketing'',''manager'',''hr'',''admin''))
         with check (public.auth_role() in (''marketing'',''manager'',''hr'',''admin''))', t, t);
  end loop;
end $$;

/* ── ตารางระบบ — admin เท่านั้น ─────────────────────────────────────── */
create policy app_settings_read on app_settings
  for select to authenticated using (true);
create policy app_settings_manage on app_settings
  for all to authenticated using (is_admin()) with check (is_admin());

create policy migration_id_map_admin on migration_id_map
  for all to authenticated using (is_admin()) with check (is_admin());
create policy location_corrections_admin on location_corrections
  for all to authenticated using (is_admin()) with check (is_admin());
