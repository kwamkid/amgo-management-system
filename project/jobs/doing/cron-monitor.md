## Cron like aoocommerce — groups + heartbeats + status board (owner 2026-11-23 "ทำให้เหมือนกัน")

Read first: lib/cron/schedule.ts · lib/cron/runner.ts · aoocommerce lib/cron/groups.ts, app/api/cron/[group]/route.ts, lib/monitor/heartbeat.ts, migrations 20261019_system_heartbeats.sql

Design (amgo keeps its better parts):
- Keep `when` daily/until/every in Thai time + `cron_runs` PK lock (aoocommerce has no lock, no catch-up).
- Each job gets `group`: people · web · data. cron-job.org = 1 job per group, every 10 min, "Notify on failure" on. `/api/cron/tick` stays = all groups (transition; lock stops doubles).
- `/api/cron/[group]`: claim due jobs, run them, wait ≤ 25 s; any finished-failed job → 502 (cron-job.org alerts); unfinished ones keep running in after().
- `system_heartbeats` (1 row/job, same RPC `record_heartbeats` as aoocommerce): dispatch row `cron:<group>`, work rows per job via `trackJob`. History = `cron_runs` (already per run) — no system_heartbeat_runs.
- Queue: drainQueue records `queue:<kind>` finish heartbeats so queued work (seo, marketing, nightly) shows its real result.
- Board: admin page /settings/system — light per job (ok/late/failing/never) + recent runs.

- [x] migration system_heartbeats + record_heartbeats (owner runs SQL)
- [x] lib/monitor/heartbeat.ts (recordHeartbeats, trackJob)
- [x] schedule.ts group field + runner split per group + 502
- [x] app/api/cron/[group]/route.ts, tick = all groups
- [x] queue heartbeat in drainQueue
- [x] lib/monitor/health.ts + API + /settings/system page
- [x] docs/cron.md + .claude/rules/queue.md update
- [ ] owner: run SQL · add 3 cron-job.org jobs · then delete tick job

- [ ] Chrome test /settings/system (desktop + 375px) after SQL is run — dev server start was denied this session
- [ ] after a day live: check lights match reality (late rules in lib/monitor/health.ts lastDueStart)

Gotchas: groups wait ≤ 25 s then answer (502 if a finished job failed); unfinished jobs continue in after(). tick = all groups, still works. Unit check of settleWithin passed (scratch test).
Resume at: owner steps (SQL, cron-job.org), then the Chrome test.
