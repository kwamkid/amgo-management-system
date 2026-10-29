-- Any plan.json item key without its own column (supply, replaces, ourPriceStatus …)
-- so the order-plan page gets back exactly what the builder wrote.
alter table public.import_round_items add column extra jsonb not null default '{}';
