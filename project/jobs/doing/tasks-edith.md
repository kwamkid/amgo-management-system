# ✅ Tasks + Edith — 2026-11-20

> Plan: [tasks-edith.md](../plans/tasks-edith.md). This file = open items only.

<!-- toc -->
**Contents** (1)
- Resume note
<!-- /toc -->

- [x] Tasksuke import 2026-11-19 (e0c3a53 notes): 653 tasks → #44–#697 · owner told staff to stop using Tasksuke (2026-11-19).
- [x] Phone task sheet (TaskSheet.tsx, commit "Tasks: phone task sheet"): tap row on phone → read view (#no · due · brand · people · แก้ไข) · StepSelect saves instantly · notes · chat feed old→new · composer (camera/gallery multi-pick + text → kind `note`). Desktop board still opens the edit modal. Tested at 390px with writes mocked.
- [ ] Owner to try TaskSheet on a real phone (camera picker on iPhone, keyboard covering the composer).
- [x] Quick add with due chips (TaskQuickAdd.tsx, commit "Tasks: phone quick add"): phone "เพิ่มงาน" = title + วันนี้/พรุ่งนี้/ศุกร์นี้(หน้า)/เลือกวัน + assignees; "เพิ่มรายละเอียด" opens the full form prefilled. Desktop unchanged.
- [x] Phone list: stage tabs ต้องทำ/กำลังทำ/เสร็จแล้ว (none = open) · icon-only filter button (FilterBar with lead) · overdue group light red (f5bc65d, 7829b5e).
- [x] Task push (owner 2026-11-20): web → lib/tasks/notifyClient.ts → /api/tasks/notify (assigned · task_updated → assignees + creator · task_done only if done_at < 2 min) · bot task routes call sendTaskEvent in after() · daily /api/cron/task-reminders.
- [ ] Owner: add cron-job.org job "AMGO — เตือนงาน" 08:30 TH → /api/cron/task-reminders (docs/cron.md job 11). Not set yet.
- [x] Dashboard MyTasksZone (overdue + due today, after check-in or requiresCheckin=false) · check-in success with such tasks → router.push('/dashboard').
- [ ] Edith SOUL commands + VPS chase script (14:00 TH chase DM, 17:30 summary to แอม) — tell the owner before touching the VPS.
- [ ] docs/bot-api.md: document `no`, `#57` lookup, `GET /tasks/chase`, `/api/bot/voice/*` — file has the brief chat's uncommitted edits; wait until they commit.

## Resume note
Resume at: owner sets cron job 11 + tries phone pieces; then Edith SOUL/VPS chase (tell owner first).
### State
Nothing uncommitted for this topic. Other chats' uncommitted files: Sidebar.tsx, components/shared/index.ts, docs/bot-api.md, brief files — don't touch.
### Gotchas
StepSelect hides icons under 380px container width (container query) so labels don't truncate. Testing at phone width: window resize doesn't work in this Chrome — load /tasks in a 390px iframe and patch its fetch (block /rest/v1 non-GET + storage uploads; let /object/sign through or images fail with data.map).
Dev server on :3002 uses the PROD database — mock fetch for write tests. A note on a todo task flips it to doing (task_updates trigger).
### Read first
project/jobs/plans/tasks-edith.md
