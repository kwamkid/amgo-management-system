-- now() = เวลาเริ่ม transaction → แก้หลายรายการใน transaction เดียว
-- จะได้ timestamp เท่ากันหมด เรียงลำดับเหตุการณ์ไม่ได้
-- audit log ต้องใช้เวลานาฬิกาจริง
alter table audit_log alter column changed_at set default clock_timestamp();

comment on column audit_log.changed_at is
  'clock_timestamp() ไม่ใช่ now() — ต้องได้เวลาจริงต่อรายการ ไม่ใช่เวลาเริ่ม transaction';
