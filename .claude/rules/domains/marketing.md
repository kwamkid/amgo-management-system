---
paths:
  - "app/(admin)/marketing/**"
  - "components/marketing/**"
  - "lib/marketing/**"
  - "lib/services/marketingService.ts"
---
# Marketing plans (/marketing) — owner 2026-11-21
- Access = RLS `marketing_can(brand)`: admin or srp_brand_access of that brand (`brand_slug(srp_brands.name)`, "J'adore" → jadore); menu roles admin + srp.
- Action plan = ordinary `tasks` rows with `plan_id` + `phase` — never a separate task table; /tasks, Edith chase and reminders must keep working.
- KPI tab/cards read only `marketing_metric_daily` (sync writes source aoo/aoosocial with service role; people write only source='manual').
- Never put `showToast` from `useToast()` in effect deps (new fn each render → infinite reload); use a ref.
- aoo sales = aoo MCP `sales_summary` (AOO_MCP_KEY, `lib/aoo/mcp.ts`) — counts flows r_retail + m_marketplace + pc_counter, no legacy; drops channels matching /spons/ (influencer/hospital gifts entered as orders); source → channel map in `aooChannel()`. Sync replaces the brand's source='aoo' rows in the range (delete + insert), so cancelled orders drop out.
- Brand → aoo name: `marketing_brand_links.aoo_brand_names`, else the BRANDS label if aoo has it. `aoo_channel_ids` holds marketplace SHOP NAMES (whitelist, marketplace rows only; empty = all shops).
- Sync runs only through the queue (`marketing.aoo.sales`); client follows it ≤ every 30 s after the first 5/15 s checks (`useAooSync`).
- aoosocial = its Supabase via `lib/aoosocial/db.ts` (service key, READ ONLY — never write there from amgo). Calendar reads live; only the post count is cached (metric posts, source aoosocial). Followers/reach: aoosocial stores none (page_insights_cache = 30-min cache of live Meta calls) → daily snapshot table to be built IN aoosocial (owner 2026-11-23), amgo reads it.
- Plan: project/jobs/plans/marketing-plan.md
