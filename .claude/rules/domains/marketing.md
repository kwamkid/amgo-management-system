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
- Plan: project/jobs/plans/marketing-plan.md
