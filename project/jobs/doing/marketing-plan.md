# Marketing plan & action plan (amgo) — doing

<!-- toc -->
**Contents** (3)
- Step 1 — built 2026-11-22 (uncommitted · migration applied by owner · tested in Chrome desktop + 375px)
- Next
- Resume note
<!-- /toc -->

Design: [project/jobs/plans/marketing-plan.md](../plans/marketing-plan.md)

## Step 1 — built 2026-11-22 (uncommitted · migration applied by owner · tested in Chrome desktop + 375px)
- Migration `supabase/migrations/20261122090000_marketing_plans.sql` — applied by owner in SQL Editor 2026-11-22 (Supabase MCP token expired, CLI has no SQL rights; not recorded in schema_migrations).
- `types/database.ts` hand-edited (marketing_* tables, tasks.plan_id/phase, 2 RPCs) — regenerate when MCP works.
- Access: `marketing_can(brand)` = admin or srp_brand_access of that brand (`brand_slug(srp_brands.name)` → "J'adore" = jadore). Menu "แผนการตลาด" roles admin + srp.
- Pages: `/marketing` (brand cards), `/marketing/[brand]?plan=&tab=` (tiles + tabs แผน / Action plan / ปฏิทินโพสต์ placeholder / KPI).
- Templates `lib/marketing/templates.ts`: blank · launch (14 tasks, 7 targets) · campaign (8 tasks, 4 targets). Template tasks have no assignee → daily due reminders go to the creator.
- Added `jadore` to `lib/constants/brands.ts` + `public/brands/jadore.webp`.
- `createTask` takes optional planId/phase.
- Sidebar.tsx also holds another session's uncommitted /brief entry — commit together or coordinate.

## Next
- [x] Migration applied, pages tested; fixed: effect loop (useToast returns a new fn every render → keep it in a ref, never in effect deps), KPI target cell overlap, header squeeze on phone (plan picker moved under header)
- [x] J'adore launch plan created (plan 2a54bcfc…, tasks #721–#734, 7 targets at 0) · templates (step 4) built
- [x] Step-1 code committed 3f55a73 (Sidebar /brief entry + types import_distributions of other chats left unstaged: staged via hash-object/update-index + `git apply --cached`, then plain `git commit` of the index — `git commit -- <paths>` would take the whole working-tree file)
- [ ] รอคุณแอม: fill J'adore KPI targets on /marketing/jadore?tab=kpi (AGD social-plan has only ROAS 6–8× and online stock ฿356k retail) · assign people to #721–#734 · set plan status "กำลังใช้"
- [ ] Regenerate types/database.ts from the DB when Supabase MCP auth works again (hand-edited now; migration not in schema_migrations)
- [ ] After deploy: add "Marketing plans" to project/features/app-features.md + write UAT cases (overview, create plan from template, tick action, KPI target + manual entry)
- [x] Admin UI `/marketing/settings` (admin only, button ตั้งค่า on /marketing): per brand aoo brand names · marketplace shops to count · aoosocial company id + account ids (text, step 3 makes a picker) · save + backfill 90 days
- [x] Step 2 built 84f713c: aoo MCP `sales_summary` (no aoo DB access needed) → lib/marketing/aooSales.ts → queue kind `marketing.aoo.sales` · cron row `marketing-sales` 05:00 (last 7 days) · `/api/marketing/aoo` GET options / POST sync now. Backfilled 90 days for gb/hape/stokke/taftoys/tommeetippee 2026-11-22 (taftoys 15–21 Nov matched aoo per channel)
- [ ] Step 2 test in Chrome (dev server start was denied this round): /marketing/settings save + backfill · brand page "ดึงยอดขาย" · KPI tab shows aoo numbers · 375px
- [ ] Step 3: aoosocial calendar (posts/post_targets) + page_insights_cache → CalendarTab + followers/reach · รอคุณแอม: which aoosocial accounts are AGD brands / is J'adore connected
- [x] Brand page "ดึงยอดขาย" button (admin) — queues the plan period, follows the queue group 5 s / 15 s / every 30 s

## Resume note
Resume at: test step 2 in Chrome (list above), then step 3 once the owner says which aoosocial accounts belong to which AGD brand.
### State
Steps 1–2 committed; tsc + eslint clean for marketing files. Migration applied by hand. Dev :3002 uses the PROD DB — the J'adore plan + 14 tasks are real rows.
### Gotchas
Supabase MCP returns Unauthorized and `supabase db query --linked` 403 → SQL goes through the owner (SQL Editor link + pbcopy). REST with SUPABASE_SECRET_KEY works for reads. resize_window does nothing → probe with a 375px same-origin iframe.
### Read first
[plans/marketing-plan.md](../plans/marketing-plan.md) · `.claude/rules/domains/marketing.md`
