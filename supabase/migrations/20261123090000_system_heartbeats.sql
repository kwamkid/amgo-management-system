-- Job status lights (owner 2026-11-23, same design as aoocommerce 20261019_system_heartbeats.sql):
-- "when did each background job last succeed". One row per job (never grows), written two ways:
--   dispatch = /api/cron/[group] reached the job (row cron:<group> = the group call itself)
--   start/finish = the real work (lib/monitor/heartbeat.ts trackJob) · queue:<kind> = central queue jobs
-- Per-run history stays in cron_runs (cron) and queue_jobs (queue).
-- Service role only (admin API reads it). No policies = authenticated cannot read.

create table if not exists public.system_heartbeats (
  key text primary key,
  last_dispatch_at timestamptz,
  last_dispatch_ok_at timestamptz,
  last_dispatch_status integer,
  last_dispatch_error text,
  dispatch_failures integer not null default 0,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_ok_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  last_duration_ms integer,
  last_summary jsonb,
  work_failures integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.system_heartbeats enable row level security;
revoke all on public.system_heartbeats from public, anon, authenticated;
grant select, insert, update, delete on public.system_heartbeats to service_role;

-- p_events = [{ key, event: 'dispatch'|'start'|'finish', ok, status, error, duration_ms, summary }]
-- consecutive-failure counters are added in the DB, hence an RPC
create or replace function public.record_heartbeats(p_events jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  e jsonb;
  v_ok boolean;
  v_now timestamptz := now();
begin
  for e in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    v_ok := coalesce((e->>'ok')::boolean, true);
    if e->>'event' = 'dispatch' then
      insert into system_heartbeats as h (key, last_dispatch_at, last_dispatch_ok_at, last_dispatch_status, last_dispatch_error, dispatch_failures, updated_at)
      values (e->>'key', v_now, case when v_ok then v_now end, (e->>'status')::int,
              case when v_ok then null else e->>'error' end, case when v_ok then 0 else 1 end, v_now)
      on conflict (key) do update set
        last_dispatch_at = v_now,
        last_dispatch_ok_at = case when v_ok then v_now else h.last_dispatch_ok_at end,
        last_dispatch_status = (e->>'status')::int,
        last_dispatch_error = case when v_ok then null else e->>'error' end,
        dispatch_failures = case when v_ok then 0 else h.dispatch_failures + 1 end,
        updated_at = v_now;
    elsif e->>'event' = 'start' then
      insert into system_heartbeats as h (key, last_started_at, updated_at)
      values (e->>'key', v_now, v_now)
      on conflict (key) do update set last_started_at = v_now, updated_at = v_now;
    elsif e->>'event' = 'finish' then
      insert into system_heartbeats as h (key, last_finished_at, last_ok_at, last_error_at, last_error, last_duration_ms, last_summary, work_failures, updated_at)
      values (e->>'key', v_now, case when v_ok then v_now end, case when v_ok then null else v_now end,
              case when v_ok then null else e->>'error' end, (e->>'duration_ms')::int, e->'summary',
              case when v_ok then 0 else 1 end, v_now)
      on conflict (key) do update set
        last_finished_at = v_now,
        last_ok_at = case when v_ok then v_now else h.last_ok_at end,
        last_error_at = case when v_ok then h.last_error_at else v_now end,
        last_error = case when v_ok then h.last_error else e->>'error' end,
        last_duration_ms = (e->>'duration_ms')::int,
        last_summary = e->'summary',
        work_failures = case when v_ok then 0 else h.work_failures + 1 end,
        updated_at = v_now;
    end if;
  end loop;
end;
$$;

revoke execute on function public.record_heartbeats(jsonb) from public, anon, authenticated;
grant execute on function public.record_heartbeats(jsonb) to service_role;

comment on table public.system_heartbeats is 'Latest state per background job (cron + queue kinds) — lib/monitor/heartbeat.ts · board /settings/system';

-- ROLLBACK:
-- drop function if exists public.record_heartbeats(jsonb);
-- drop table if exists public.system_heartbeats;
