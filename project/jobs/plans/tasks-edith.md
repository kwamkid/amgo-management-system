# Tasks made easy + Edith — plan (started 2026-11-18)

> Owner wants the task system (/tasks) easy enough that staff actually use it, working together with the Edith Discord bot (Hermes, all staff, own data only). Not designed yet — start here in a fresh chat.

<!-- toc -->
**Contents** (6)
- Owner answers (2026-11-18)
- Already exists (check before building)
- Phone review (2026-11-18, 390px on prod)
- Decisions (owner, 2026-11-18)
- Built 2026-11-18 — commit 1bfaf5e (migration applied by owner, verified via REST: #1–#43, chase kind accepted). UI not y
- Next
<!-- /toc -->

## Owner answers (2026-11-18)
- Why staff don't use it (all four): must open the web to see tasks · creating/updating is fiddly · nobody chases tasks · the screen is hard to read.
- Edith should (all four): turn a Discord message into a task ("ask เฟื่อง to do the GB promo by Friday") · update/close tasks from chat (reply "done", attach progress photos) · DM each person a morning summary (today, due soon, overdue) · chase overdue tasks for the owner and report back to แอม.

## Already exists (check before building)
- Bot API for tasks + timeline/images: .claude/rules/domains/bot-api.md, docs/bot-api.md (Edith key = scope `general`, caller's own data).
- Edith task DMs 08:30 TH already run on the VPS (/root/edith_reminders.py) — see project/jobs/doing/hermes-bots.md and 01-AGD/.claude/rules/domains/hermes-bots.md (VPS is shared: no docker restart/prune, no Traefik change, no reboot without telling the owner).
- Voice → task drafts (project/jobs/plans/voice-tasks.md) feeds the same tasks table.
- Person filter strip on /tasks: components/tasks/AssigneeStrip.tsx + components/shared/PersonStrip.tsx (count badge clipping fixed 936d08f).

## Phone review (2026-11-18, 390px on prod)
- Kanban shows only "ต้องทำ" on a phone; other columns off-screen; long-press drag across a horizontally scrolling board is hard.
- Closing a task = open card → scroll to StepSelect (labels truncated) → scroll → บันทึก. No one-tap done.
- "ต้องทำ" sorted by manual sortOrder, not urgency; voice-made tasks mostly have no due date.
- Modal opens as an edit form (RichTextEditor); progress hidden in 2nd tab with 4 kinds to choose.
- Staff can only assign themselves (web + Edith). No short task number to reference in Discord.
- Discord buttons impossible (one gateway per bot token, owner refused extra bot apps) → Edith commands are text.

## Decisions (owner, 2026-11-18)
- Phone /tasks = "my tasks" list grouped overdue / today / this week / no due; tap circle = done (undo toast); task sheet read-first with status buttons that save instantly + chat-like update box + camera; edit behind "แก้ไข"; quick add with due chips (today/tomorrow/Friday/pick). Desktop keeps the kanban.
- Anyone may assign tasks to anyone (web + Edith). Recipient sees it in the morning DM; creator can edit/delete it. Needs RLS/trigger + bot API rule change together.
- Short task number `#N` (`tasks.no`) on cards, in DMs, accepted by `/api/bot/tasks/{id}`.
- Edith chases overdue tasks once a day at 14:00 TH (DM "#57 เลยกำหนด 3 วัน ติดอะไรไหม", reply logged to timeline, new update kind `chase`), summary DM to แอม at 17:30 TH. VPS script change (edith_reminders.py or new script) — tell owner before touching VPS.

## Built 2026-11-18 — commit 1bfaf5e (migration applied by owner, verified via REST: #1–#43, chase kind accepted). UI not yet seen in a browser.
- Migration `20261118090000_tasks_no_assign_chase.sql`: tasks.no (+seq, backfill by created_at) · task_assignees_creator(_delete) · kind `chase` (after_insert skips it, task_status_line view skips it).
- Bot API: `no` in every task · `/tasks/{id}` (+ images/updates subroutes) accept uuid or `57`/`#57` (`resolveTaskId`) · anyone assigns on create; non-creator may only remove self (`assigneeChangeError`) · `POST /tasks/{id}/updates {kind:"chase"}` superadmin only, created_by null · `GET /tasks/chase` (superadmin): overdue + chases, chasedToday, repliedToday, lastReply.
- Web: TaskList.tsx (phone, grouped, tap circle = done + ยกเลิก) · board hidden on phone · #no on cards · creator picks assignees · timeline shows chase as Edith.
- docs/bot-api.md NOT updated yet — file has another session's uncommitted brief edits; update after they commit.
- Known gap: a chase becomes the "latest" update, so the assignee can no longer edit kind/date of their previous entry (task_update_is_latest). Acceptable for now.

## Tasksuke import (2026-11-19, owner asked — staff were still using Tasksuke)
- All 653 tasks of Tasksuke company AGD → amgo tasks #44–#697 (gap at #85 from a retried row), `source_ref = 'tasksuke:<id>'` (idempotent re-run; delete with `source_ref like 'tasksuke:%'`). 584 done · 47 todo · 22 doing (Tasksuke `review` → doing).
- 145 comments → task_updates kind `note` with original author/time; 114 images (covers + comment images) converted to JPEG into `task-images`. Brand guessed from title (226 tasks).
- People matched by name (13). Nrm. and Nattanaree have no amgo account (done tasks only) — name kept in notes/comment text.
- Tasksuke itself is still live: owner should tell staff to stop adding there, or re-run the import (script in session scratchpad, not kept).

## Next
- Still to build: task sheet read-first + instant status buttons + chat-like update box · quick add with due chips · Edith SOUL commands + VPS chase script (tell owner).
- Build order: (1) migration `tasks.no` + assign-anyone policy + `chase` kind (ask owner before running migration) → (2) bot API: `no` everywhere, lookup by number, `GET /tasks/chase` → (3) phone list UI → (4) Edith SOUL/script (VPS, tell owner) → docs/bot-api.md.
