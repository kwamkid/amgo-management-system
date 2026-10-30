-- Import: per-brand model rules (owner 29–30 Oct 2026) — was AGD 02-hape/2026/99-data/hape/do-not-order.json.
-- amgo is the only copy; the plan builder gets a local export via `node scripts/import-sync.mjs rules <brand> --out <json>`.
--   replaced          old code → new_code: never order the old one, put its qty (and sales history) on the new one
--   discontinued      never suggest / order
--   lastStock         discontinued but the brand still holds a few — only when the owner asks, never re-order
--   skippedThisRound  skipped for `round` only (e.g. C1) — fine to suggest later
--   waitForForm       the owner wants it: flag it as soon as a new price list / order form lists it
create table public.import_model_rules (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  code text not null,
  kind text not null check (kind in ('replaced', 'discontinued', 'lastStock', 'skippedThisRound', 'waitForForm')),
  name text,
  new_code text,
  new_name text,
  round text,
  note text,
  since date,
  set_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand, code, kind),
  check ((kind = 'replaced') = (new_code is not null))
);

alter table public.import_model_rules enable row level security;
create policy import_model_rules_read on public.import_model_rules
  for select using (public.import_can_view());
create policy import_model_rules_write on public.import_model_rules
  for all using (public.import_can_edit()) with check (public.import_can_edit());
