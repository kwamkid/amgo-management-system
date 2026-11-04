<!-- toc -->
**Contents** (2)
- 🧪 Dev tracker (UAT · bugs · releases) — 2026-11-03, commits 09d689f c0dd5cf e09334b 6674334 04b29bc
- Resume note
<!-- /toc -->

## 🧪 Dev tracker (UAT · bugs · releases) — 2026-11-03, commits 09d689f c0dd5cf e09334b 6674334 04b29bc
- [ ] Replace the private `Lightbox` in components/dev/UatCaseModal.tsx with the shared `Lightbox` from components/aoo (added by another session 3 Nov, see ui-design-system rule) — rule: anything used in >1 place is shared.
- [x] pushed c0dd5cf + e09334b; MCP tested on prod via JSON-RPC (initialize, tools/list, uat_list, uat_add, uat_retest, uat_update, uat_close, uat_case) — throwaway case deleted. `amgo-dev` registered at user scope.
- [ ] Use the `amgo-dev` MCP tools once from a fresh Claude session in another repo (e.g. aoocommerce: `uat_list`) to confirm the user-scope registration loads there.
- [x] MCP server built in e09334b (+ 6674334 uat_update fix), pushed, tested on prod (`app/api/mcp/dev/route.ts`, `lib/mcp/devTools.ts`, docs §9, `~/.claude/skills/uat/SKILL.md` switched to the tools). Original spec: `POST /api/mcp/dev` in amgo, Streamable HTTP stateless JSON-RPC (copy aoocommerce `app/api/mcp/route.ts` + `lib/mcp/tools.ts` pattern: initialize / tools/list / tools/call, log every call). Auth = Bearer bot key scope `dev` or superadmin (reuse `authBotApi`), same permissions as /api/bot/dev. Tools reusing `lib/services/bot/botDev.ts`: `uat_projects` · `uat_summary(project)` · `uat_list(project, status?)` · `uat_case(no)` (history + signed picture URLs) · `uat_add(project, cases[])` · `uat_update(no, fields)` · `uat_retest(no, fix_note)` · `uat_close(no)`; `project` = repo folder slug. Then: `claude mcp add --scope user --transport http amgo-dev https://app.amgovenger.com/api/mcp/dev --header "Authorization: Bearer <AMGO_DEV_KEY from memo/bot-keys.env>"` · update `~/.claude/skills/uat/SKILL.md` to prefer the `amgo-dev` MCP tools (dev.mjs stays as fallback for downloading pictures; keep "Writing cases") · test from a fresh session in another repo (list, add + close, retest) · document in docs/bot-api.md.
- [ ] Build bug reports: table `dev_bugs` per requirements in project/jobs/doing/dev-tracker.md ("Data model"), per-project numbers BUG-0001, board ใหม่ · รับเรื่อง · กำลังแก้ · รอเทส · ปิดแล้ว, "แจ้งเป็นบั๊ก" from a failed result, menu item "Bug report" under Dev Management, bot API + `dev.mjs` commands.
- [ ] Build releases (`dev_releases`, progress per release, attach cases/bugs) — after bugs.
- [ ] Cross-link bugs ↔ UAT cases (owner: "ทำเป็น link ให้แจ้งกัน เอาไว้ทำทีหลัง").
- [ ] Add `dev_*` tables to types/database.ts (MCP generate_typescript_types) and drop the `as unknown as` casts in lib/services/devService.ts, botDev.ts, app/api/bot/dev/*.
- [ ] Archive /Users/ampstark/aoo-uat (never deployed) once the old tables are dropped.
- [x] 2026-11-04 UAT board header on mobile: search moved to its own full-width row so the project name isn't cut to "A…" — 3db85ef (UAT-0140)
- [x] 2026-11-04 ไกด์ set to `manager` in all 3 dev projects (DB data, not a migration) — can add/edit cases, cannot create projects (UAT-0141)
- [ ] รอคุณแอม: want a comment thread on UAT cases? Today only the result "หมายเหตุ" exists (offered 4 Nov, no answer).
- [ ] รอคุณแอม: auto-add ไกด์ as manager to newly created projects? Today members must be added by hand per project (creator trigger adds only the creator).

## Resume note
Resume at: build bug reports (project/jobs/todo.md) — MCP server is live (e09334b + 6674334 pushed).

### State
- UAT live on prod (09d689f), 88 cases moved (next UAT-0089), CLI `scripts/dev.mjs` tested on prod. MCP `amgo-dev` live and registered at user scope. tsc clean. Projects: aoocommerce, aoosite, amgo-management-system (owner manager, ไกด์ manager since 4 Nov).
- Owner 3 Nov: testers = แอม + ไกด์ · notify owner (push to project managers) · bug numbers per project · UAT first · desktop board shows 4.5 columns.

### Gotchas
- dev_* tables not in types/database.ts (types:gen needs CLI login) — services cast `as unknown as`.
- Result trigger sets case status; guard blocks testers elsewhere — bypass flag `dev.apply_result` (rules file).
- `/api/dev/notify` reads the latest result itself; browser sends only caseId.
- `npm run dev` was denied in this chat — test on prod after push.

### Read first
- Rules .claude/rules/domains/dev-tracker.md · API docs/bot-api.md §8 · UI components/dev/*, app/(admin)/dev/uat/*
- Spec for the rest (owner-approved): bugs = `dev_bugs` (no BUG-0001 per project, title, steps, expected, actual, environment, device, page_url, severity critical/high/normal/low, status, reported_by, assignee_id, release_id, uat_case_id, fix_note, sort_order; pictures like UAT; history table) · board ใหม่ · รับเรื่อง · กำลังแก้ · รอเทส · ปิดแล้ว (+ "ไม่แก้" reason) · failed UAT result → "แจ้งเป็นบั๊ก" prefill · releases = `dev_releases` (project_id, name, start_date, target_date, released_at, goal, status planned/active/released) with progress view, drag cases/bugs into a release · menu Dev Management › Bug report · bot API + dev.mjs commands for bugs.
