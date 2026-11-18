# Tasks made easy + Edith — plan (started 2026-11-18)

> Owner wants the task system (/tasks) easy enough that staff actually use it, working together with the Edith Discord bot (Hermes, all staff, own data only). Not designed yet — start here in a fresh chat.

## Owner answers (2026-11-18)
- Why staff don't use it (all four): must open the web to see tasks · creating/updating is fiddly · nobody chases tasks · the screen is hard to read.
- Edith should (all four): turn a Discord message into a task ("ask เฟื่อง to do the GB promo by Friday") · update/close tasks from chat (reply "done", attach progress photos) · DM each person a morning summary (today, due soon, overdue) · chase overdue tasks for the owner and report back to แอม.

## Already exists (check before building)
- Bot API for tasks + timeline/images: .claude/rules/domains/bot-api.md, docs/bot-api.md (Edith key = scope `general`, caller's own data).
- Edith task DMs 08:30 TH already run on the VPS (/root/edith_reminders.py) — see project/jobs/doing/hermes-bots.md and 01-AGD/.claude/rules/domains/hermes-bots.md (VPS is shared: no docker restart/prune, no Traefik change, no reboot without telling the owner).
- Voice → task drafts (project/jobs/plans/voice-tasks.md) feeds the same tasks table.
- Person filter strip on /tasks: components/tasks/AssigneeStrip.tsx + components/shared/PersonStrip.tsx (count badge clipping fixed 936d08f).

## Next
- Look at /tasks as staff see it on a phone, list the friction, propose a simpler flow + which Edith commands/API changes, then ask the owner before building.
