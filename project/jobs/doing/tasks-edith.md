# ✅ Tasks + Edith — 2026-11-20

> Plan: [tasks-edith.md](../plans/tasks-edith.md). This file = open items only.

<!-- toc -->
**Contents** (1)
- Resume note
<!-- /toc -->

- [x] Tasksuke import 2026-11-19 (e0c3a53 notes): 653 tasks → #44–#697 · owner told staff to stop using Tasksuke (2026-11-19).
- [x] Phone task sheet (TaskSheet.tsx, commit "Tasks: phone task sheet"): tap row on phone → read view (#no · due · brand · people · แก้ไข) · StepSelect saves instantly · notes · chat feed old→new · composer (camera/gallery multi-pick + text → kind `note`). Desktop board still opens the edit modal. Tested at 390px with writes mocked.
- [x] Quick add with due chips (TaskQuickAdd.tsx, commit "Tasks: phone quick add"): phone "เพิ่มงาน" = title + วันนี้/พรุ่งนี้/ศุกร์นี้(หน้า)/เลือกวัน + assignees; "เพิ่มรายละเอียด" opens the full form prefilled. Desktop unchanged.
- [x] Phone list: stage tabs ต้องทำ/กำลังทำ/เสร็จแล้ว (none = open) · icon-only filter button (FilterBar with lead) · overdue group light red (f5bc65d, 7829b5e).
- [x] Task push (owner 2026-11-20): web → lib/tasks/notifyClient.ts → /api/tasks/notify (assigned · task_updated → assignees + creator · task_done only if done_at < 2 min) · bot task routes call sendTaskEvent in after()
- [x] Central cron (owner 2026-11-20): one cron-job.org job GET /api/cron/tick every 10 min · schedule in lib/cron/schedule.ts (task-reminders 08:30 is a row there) · lock + history table cron_runs · light jobs inline, heavy via http, web-jobs only when queued. Dry-run checked (?dry=1&at=).
- [x] Migration cron_runs run by owner 2026-11-20 (table verified via REST) · pushed 95b99b3..c0b39b3.
- [x] Switchover 2026-11-20 08:20 TH: owner seeded today's done slots, added tick job, disabled the 10 old jobs; test run 202 → checkout-reminder ok, web-uptime ok 27 s (49 sites). Old: seed today's done daily slots (auto-checkout, web-nightly, cleanup-photos, seo-daily — SQL given to owner, my REST write was blocked) · cron-job.org: add tick, DISABLE (not delete) the 10 old jobs, ideally before 09:00 TH (else web-expiry runs twice) · delete old jobs on 2026-11-21 after one full day of ok rows in cron_runs.
- [x] Dashboard MyTasksZone (overdue + due today, after check-in or requiresCheckin=false) · check-in success with such tasks → router.push('/dashboard'). UAT-0324–0327 written for phone tasks + dashboard box.
- [x] Edith SOUL commands + VPS chase script (14:00 TH chase DM, 17:30 summary to แอม) — live 2026-11-20.
  - [x] 2026-11-20 local draft: `00-Hermes/edith/edith_chase.py` (`chase` 14:00 · `summary` 17:30 · `--dry` · skip Sat/Sun · owner skipped · max 5 tasks/DM, rotation by lastChaseAt) + `00-Hermes/edith/edith_soul_tasks.md` (#57 commands). Dry-run with mock data OK. Overdue now: 30 tasks, เฟื่อง 16, all assignees have Discord ids.
  - [x] GET /tasks/chase also returns tasks chased today that are now done/rescheduled (`overdue:false`) so the 17:30 summary sees "done" replies.
  - [x] 2026-11-20 VPS (owner OK): /root/edith_chase.py (keys from profile .env like edith_reminders.py; `--only <discordId>` test, owner id includes own tasks) · root crontab `0 7 * * 1-5 chase` + `30 10 * * 1-5 summary` → /root/hermes-credits/edith-chase.log (backup /root/crontab.bak-20261120) · test chase+summary DM sent to แอม only (5 chase rows logged on แอม's tasks #700 #705 #4 #8 #13) · Edith SOUL paragraph "Task numbers + 14:00 chase" after "You cannot see…" (backup SOUL.md.bak-20261120) · gateway restarted, running. Copy: 00-Hermes/edith/.
- [ ] Push fbed575 (chase route keeps tasks chased today) before the 17:30 summary matters — until then done/rescheduled replies drop out of the summary.
- [ ] Check 2026-11-20 14:00 run (edith-chase.log) + 17:30 summary; ask a staff member if replies like "#57 เสร็จ" worked.
- [ ] docs/bot-api.md: document `no`, `#57` lookup, `GET /tasks/chase`, `/api/bot/voice/*` — file has the brief chat's uncommitted edits; wait until they commit.

## Resume note
Resume at: check first real chase run (VPS /root/hermes-credits/edith-chase.log after 14:00 TH) and the 17:30 summary; push fbed575; then docs/bot-api.md once the brief chat commits.
### State
Nothing uncommitted for this topic; all code pushed (..c0b39b3). Other chats' uncommitted: Sidebar.tsx, shared/index.ts, docs/bot-api.md, brief files, types/database.ts, import_distributions migration — don't touch. Cron cut over to /api/cron/tick 2026-11-20 (follow-up 2026-11-21 in followups.md).
### Gotchas
Dev :3002 = PROD DB: mock fetch for writes (knowledge/learning/general.md 2026-11-20). My REST writes to prod were blocked by the permission classifier — give the owner SQL instead. A note on a todo task flips it to doing (trigger). Bot routes push via sendTaskEvent in after().
### Read first
project/jobs/plans/tasks-edith.md · project/jobs/doing/hermes-bots.md (VPS) · 01-AGD/.claude/rules/domains/hermes-bots.md
