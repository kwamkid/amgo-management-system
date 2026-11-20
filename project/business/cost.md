# Cost & usage

> Infra cost / usage / billing: current state on top (update in place), dated log below.

<!-- toc -->
**Contents** (2)
- Current state
- Log
<!-- /toc -->

---

## Current state
- Vercel Hobby: Active CPU 4 h/month is the tight limit (hit in Oct 2026 by a 2-min cron). Invocations 1M/month — far away.
- Cron: one cron-job.org job `/api/cron/tick` every 10 min (free). Estimate ~155–165 invocations/day, ~45–60 min Active CPU/month (~20–25%); was ~207/day, ~25–30% with 10 separate jobs.
- Supabase Free: cron_runs adds ~300 small queries/day, 30-day retention.

## Log
- 2026-11-20 — Central cron tick replaces 10 cron-job.org jobs; light jobs run inside the tick (no extra invocation), web-jobs runner only when a queue has work. Estimate from the Oct data point (~0.5–0.7 s Active CPU per invocation), not measured on the Vercel dashboard.
