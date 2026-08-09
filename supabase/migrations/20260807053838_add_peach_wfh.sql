-- พีช — WFH ได้ แต่คง role marketing ไว้ (ตัดสินใจ 2026-08-07)
-- marketing ยังต้องเช็คอินตาม role_settings จึงนับชั่วโมง/OT ได้ปกติ
-- (ต่างจาก 4 คนที่เป็น manager ซึ่งไม่ต้องเช็คอินเลย)
insert into user_settings_plan
  (match_line_display_name, nickname, full_name_hint, set_role,
   wfh_eligible, requires_checkin, employment_type, note)
values
  ('Peach.567🍑', 'พีช', 'นายณัฐวัฒน์ ชูภักดิ์ (พีช)', 'marketing',
   true, null, 'monthly',
   'WFH ได้ — คง role marketing ไว้ (คนเดียวที่ยังใช้งาน) ยังดูแล Influencer/Campaign')
on conflict (match_line_display_name) do update
  set wfh_eligible = excluded.wfh_eligible,
      set_role     = excluded.set_role,
      note         = excluded.note;
