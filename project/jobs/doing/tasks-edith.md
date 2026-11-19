# ✅ Tasks + Edith — 2026-11-20

> Plan: [tasks-edith.md](../plans/tasks-edith.md). This file = open items only.

<!-- toc -->
**Contents** (1)
- Resume note
<!-- /toc -->

- [x] Tasksuke import 2026-11-19 (e0c3a53 notes): 653 tasks → #44–#697 · owner told staff to stop using Tasksuke (2026-11-19).
- [x] Phone task sheet (TaskSheet.tsx, commit "Tasks: phone task sheet"): tap row on phone → read view (#no · due · brand · people · แก้ไข) · StepSelect saves instantly · notes · chat feed old→new · composer (camera/gallery multi-pick + text → kind `note`). Desktop board still opens the edit modal. Tested at 390px with writes mocked.
- [ ] Owner to try TaskSheet on a real phone (camera picker on iPhone, keyboard covering the composer).
- [ ] Quick add with due chips (today / tomorrow / Friday / pick).
- [ ] Edith SOUL commands + VPS chase script (14:00 TH chase DM, 17:30 summary to แอม) — tell the owner before touching the VPS.
- [ ] docs/bot-api.md: document `no`, `#57` lookup, `GET /tasks/chase`, `/api/bot/voice/*` — file has the brief chat's uncommitted edits; wait until they commit.

## Resume note
Resume at: quick add with due chips (phone). TaskSheet done 2026-11-20.
### State
Nothing uncommitted for this topic. Other chats' uncommitted files: Sidebar.tsx, components/shared/index.ts, docs/bot-api.md, brief files — don't touch.
### Gotchas
StepSelect hides icons under 380px container width (container query) so labels don't truncate. Testing at phone width: window resize doesn't work in this Chrome — load /tasks in a 390px iframe and patch its fetch (block /rest/v1 non-GET + storage uploads; let /object/sign through or images fail with data.map).
Dev server on :3002 uses the PROD database — mock fetch for write tests. A note on a todo task flips it to doing (task_updates trigger).
### Read first
project/jobs/plans/tasks-edith.md
