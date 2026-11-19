-- Central cron (owner 2026-11-20): cron-job.org calls /api/cron/tick every 10 min;
-- the schedule lives in lib/cron/schedule.ts. One row per job per slot (daily = date,
-- every-N = date + slot start) — the primary key is the "already ran" lock, so a retried
-- or overlapping tick never runs a job twice. Also the run history (replaces looking at
-- cron-job.org's execution history). Rows older than 30 days are deleted by the tick.

create table if not exists public.cron_runs (
  job         text        not null,
  slot        text        not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  result      jsonb,
  primary key (job, slot)
);

create index if not exists cron_runs_started_at_idx on public.cron_runs (started_at desc);

-- Service role only (tick uses the admin client). No policies = no access for anon/authenticated.
alter table public.cron_runs enable row level security;

comment on table public.cron_runs is 'Central cron run log + per-slot lock — written by /api/cron/tick (lib/cron/*)';
