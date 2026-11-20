-- Per-person rotating day off (owner, 20 Nov 2026)
--
-- The ADF team (ปู · ใจ · ขวัญ) swap days off among themselves; the only rule is
-- N working days a week (6 now, 5 later). 'rotating' already existed for whole
-- job functions (PC shop staff); this lets one person's weekly schedule use it.
-- expected_work_mode() / attendance_summary() already take user_work_schedules
-- first, so a person with all 7 days = 'rotating' is reported as 'not_scheduled'
-- on days they don't come, absence is counted from users.days_per_week, and the
-- HR inbox stops flagging "worked on a day off".

alter table public.user_work_schedules drop constraint user_work_schedules_work_mode_check;
alter table public.user_work_schedules add constraint user_work_schedules_work_mode_check
  check (work_mode in ('onsite', 'wfh', 'off', 'optional', 'rotating'));
