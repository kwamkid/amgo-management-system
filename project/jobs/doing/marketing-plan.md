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
- [ ] Commit step-1 code by pathspec (not committed): migration, types/database.ts, lib/constants/brands.ts, public/brands/jadore.webp, lib/services/{marketingService,taskService}.ts, lib/marketing/, components/marketing/, app/(admin)/marketing/, components/layout/Sidebar.tsx — Sidebar also holds another chat's uncommitted /brief entry (stage only the marketing hunk via hash-object/update-index)
- [ ] รอคุณแอม: fill J'adore KPI targets on /marketing/jadore?tab=kpi (AGD social-plan has only ROAS 6–8× and online stock ฿356k retail) · assign people to #721–#734 · set plan status "กำลังใช้"
- [ ] Regenerate types/database.ts from the DB when Supabase MCP auth works again (hand-edited now; migration not in schema_migrations)
- [ ] After deploy: add "Marketing plans" to project/features/app-features.md + write UAT cases (overview, create plan from template, tick action, KPI target + manual entry)
- [ ] Admin UI for `marketing_brand_links` (brand → aoosocial account ids, aoo brand/channel ids) — needed before steps 2–3
- [ ] Step 2: aoocommerce daily sales by brand × channel → `marketing_metric_daily` (row in lib/cron/schedule.ts + queue handler; check which aoocommerce tables hold marketplace orders and how brand resolves per line)
- [ ] Step 3: aoosocial calendar (posts/post_targets) + page_insights_cache → CalendarTab + followers/reach · รอคุณแอม: which aoosocial accounts are AGD brands / is J'adore connected
- [ ] Brand page "sync now" button for admins (after step 2)

## Resume note
Resume at: commit step-1 code (list above), then build the marketing_brand_links admin UI and start step 2 (aoocommerce sales sync).
### State
All step-1 code uncommitted; tsc + eslint clean for marketing files. Migration applied by hand. Dev :3002 uses the PROD DB — the J'adore plan + 14 tasks are real rows.
### Gotchas
Supabase MCP returns Unauthorized and `supabase db query --linked` 403 → SQL goes through the owner (SQL Editor link + pbcopy). REST with SUPABASE_SECRET_KEY works for reads. resize_window does nothing → probe with a 375px same-origin iframe.
### Read first
[plans/marketing-plan.md](../plans/marketing-plan.md) · `.claude/rules/domains/marketing.md`
