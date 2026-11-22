# Marketing plan & action plan per brand (amgo) — design draft 2026-11-21

> Owner asks: simple marketing plan + action plan for our business, per brand, KPI tracker, synced with amgo tasks, aoosocial and aoocommerce. Decisions (owner 2026-11-21): lives in **amgo** · KPI numbers **pulled automatically** (no manual entry where a source exists) · content calendar **per post** · access = **admin + brand manager of that brand** (others see only tasks assigned to them).
> First real plan to load: J'adore launch (AGD `02-hape/_notes/3-marketing/social-plan.md` → "[J'adore] Launch plan").

<!-- toc -->
**Contents** (5)
- Screens
- Data (amgo)
- Sync sources (to verify before building)
- Build order
- Open
<!-- /toc -->

## Screens
- `/marketing` — one card per brand: this period's sales vs target (aoo), followers vs target (aoosocial), posts published/planned (aoosocial), actions done/total (tasks). Red/amber/green by % of target vs % of period elapsed.
- `/marketing/[brand]` — header = 4 KPI tiles + period switch; tabs:
  1. **แผน** — goal, period, budget, channels (each with its target), key dates (campaigns: 12.12, Children's Day …). One screen, editable.
  2. **Action plan** — tasks with `plan_id`, grouped by phase (P0/P1/P2), board/list reusing `components/tasks/*` (TaskList, TaskSheet, AssigneePicker). Ticking here = ticking in /tasks (same rows). "Add from template" creates a phase's tasks in one go.
  3. **ปฏิทินโพสต์** — month grid of aoosocial posts for the brand's linked social accounts (status draft/scheduled/published/failed). Read-only; "สร้างโพสต์" opens aoosocial composer. Optional: link a post to a task.
  4. **KPI** — per metric × channel: target, actual, trend line by week; source badge (aoo / aoosocial / manual).

## Data (amgo)
- `marketing_plans` (id, brand text = same key as `tasks.brand` / AGD folder, title, start_date, end_date, status draft|active|done, goal text, budget numeric, created_by, timestamps)
- `marketing_targets` (plan_id, metric: sales_thb · sales_pcs · followers · reach · views · posts · ad_spend · roas, channel: all · store · web · shopee · lazada · tiktok_shop · facebook · instagram · tiktok · youtube · line, target numeric, source auto|manual)
- `marketing_metric_daily` (brand, metric, channel, date, value, source, synced_at) — cache filled by a daily cron; KPI tab and cards read only this table (fast, no cross-project calls on page load).
- `marketing_brand_links` (brand, aoosocial company_id + social_account ids[], aoo brand ids / sales-channel ids) — set once per brand by admin.
- `tasks` + `plan_id uuid null references marketing_plans` + `phase text null`. /tasks keeps working unchanged; filter by brand already exists.
- RLS: admin all; brand manager of `brand` (existing job_function brand manager / import brand owners) read-write; others none (tasks keep their own RLS).

## Sync sources (to verify before building)
- **aoocommerce** (Supabase `supabase-aoocommerce`): daily sales ฿ + pcs by brand × channel (store branches, web, Shopee, Lazada, TikTok Shop). Check which tables hold marketplace orders and how brand is resolved per line.
- **aoosocial**: `posts` / `post_targets` (calendar), `page_insights_cache` (followers, reach), `ad_insights_daily` (spend, ROAS — Ads module is switched OFF in aoosocial; table may be empty → Shopee/Lazada ad spend + ROAS stay manual until then).
- Access: server-side only, service-role keys of both projects in amgo env (never client). Cron (existing cron setup in `CRON_SETUP.md`) once a day + "sync now" button for admins.

## Build order
1. Tables + RLS + `/marketing/[brand]` แผน + Action plan (tasks link) — usable alone.
2. aoo sales sync → KPI tab + brand cards.
3. aoosocial calendar + insights sync.
4. Templates (launch / monthly campaign) + load J'adore plan.

## Open
- Which aoosocial company/accounts belong to AGD brands (J'adore FB/IG/TikTok connected yet?).
- Shopee/Lazada ad spend: no source yet → manual field.
