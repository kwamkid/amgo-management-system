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
- [x] 9ad7a72 (2026-11-23, supabase CLI gen types; other chat's import_distributions hunk left unstaged) Regenerate types/database.ts from the DB when Supabase MCP auth works again (hand-edited now; migration not in schema_migrations)
- [x] app-features.md entry written 2026-11-23
- [x] UAT cases written 2026-11-23: UAT-0333…0337 (overview · settings picker+save · KPI target · calendar · 375px). Not yet: create plan from template, tick action
- [x] Admin UI `/marketing/settings` (admin only, button ตั้งค่า on /marketing): per brand aoo brand names · marketplace shops to count · aoosocial company id + account ids (text, step 3 makes a picker) · save + backfill 90 days
- [x] Step 2 built 84f713c: aoo MCP `sales_summary` (no aoo DB access needed) → lib/marketing/aooSales.ts → queue kind `marketing.aoo.sales` · cron row `marketing-sales` 05:00 (last 7 days) · `/api/marketing/aoo` GET options / POST sync now. Backfilled 90 days for gb/hape/stokke/taftoys/tommeetippee 2026-11-22 (taftoys 15–21 Nov matched aoo per channel)
- [x] Step 2/3a Chrome test on prod 2026-11-23: settings loads all 7 brands with saved links, picker search ok, save toast ok, J'adore KPI + calendar tabs ok, 375px no overflow (title truncates, tab row scrolls). Backfill button NOT pressed (auto-mode blocked prod write; was backfilled 2026-11-22)
- [ ] รอคุณแอม: J'adore connected in aoosocial 2026-11-23 (FB J'adore Thailand 55667560… · IG jadorethailand 2500872c…) but amgo marketing_brand_links has no jadore row → pick both on /marketing/settings + save (auto-mode blocked my REST upsert). J'adore has no TikTok → KPI row "ผู้ติดตาม · TikTok" will stay empty (delete it or swap to IG)
- [ ] J'adore sales KPI shows no number yet — check aoo has J'adore sales since 22 Nov after next 05:00/06:30 cron
- [x] aoosocial accounts linked 2026-11-23 (owner confirmed; REST upsert into marketing_brand_links): company ABC the Baby ef10249d… · hape FB+IG · gb FB+IG+TT · stokke FB+IG+TT + Babyzen FB (Stokke bought Babyzen; Babyzen has no IG) · taftoys FB+IG · tommeetippee FB+IG+TT · abcthebaby FB+IG+TT+YT · Crane dropped (owner quit the brand) · J'adore not connected → manual KPI
- [x] Step 3a built 0998ebb: env AOOSOCIAL_SUPABASE_URL + AOOSOCIAL_SECRET_KEY in amgo .env.local (lib/aoosocial/db.ts) · CalendarTab = live GET /api/marketing/calendar (marketing_can) · queue kind `marketing.social.posts` counts published targets → metric posts per platform (cron + "ดึงตัวเลข" button enqueue it with the aoo sales job) · settings picker for aoosocial accounts · StatusBadge kind socialPost. Backfilled 90 days: gb 95 · abcthebaby 56 · hape 4 · others 0
- [x] (2026-11-23 verified on prod: /marketing/settings loads aoosocial accounts) add AOOSOCIAL_SUPABASE_URL + AOOSOCIAL_SECRET_KEY to Vercel env (Production) before deploy — else calendar shows an error and the posts job fails
- [x] Step 3b followers/reach — aoosocial cf2dd90 (account_insights_daily + cron sync-account-insights 06:00 via its tick; FB followers/reach/views live-tested, IG followers only (#10 no insights permission), TikTok followers, YouTube subs+views) · amgo: queue kind marketing.social.insights, cron moved to 06:30
- [x] aoosocial SQL run on gyuqrqrtyhjmfyguvczy (the real ref — aoosocial/supabase/.temp/project-ref is stale) · pushed amgo f1cc105 + aoosocial cf2dd90
- [x] snapshot check → followups 2026-11-24
- [ ] รอคุณแอม (optional): ask for instagram_manage_insights on the aoosocial Meta app → IG reach/views
- [x] Brand page "ดึงยอดขาย" button (admin) — queues the plan period, follows the queue group 5 s / 15 s / every 30 s

## Resume note
Resume at: 2026-11-24 after 06:30 — check aoosocial account_insights_daily rows + followers/reach in KPI tab (followups). Then the J'adore label nit.
### State
All code pushed (amgo f1cc105, aoosocial cf2dd90). Snapshot table live; first rows expected 2026-11-24 06:00, amgo cron 06:30.
### Gotchas
aoosocial is READ ONLY from amgo; its supabase/.temp/project-ref points to the wrong project (live = gyuqrqrtyhjmfyguvczy, same as AOOSOCIAL_SUPABASE_URL). IG has followers only (Meta #10).
### Read first
.claude/rules/domains/marketing.md · lib/marketing/socialInsights.ts
