-- ฉลาก สคบ. — owner 30 Oct 2026: every manager (and admin) may view, edit and add label data.
-- Labels carry no cost/FOB, so this is wider than import_access. The API (lib/labels/server.ts
-- labelGuard) checks the same rule and then uses the service role, because the import tables
-- themselves stay import_access-only.
create or replace function public.label_can_edit()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select public.import_can_edit() or exists (
  select 1 from public.users where id = auth.uid() and is_active and role in ('admin', 'manager')
); $$;

create or replace function public.label_can_view()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select public.import_can_view() or public.label_can_edit(); $$;

drop policy label_specs_read on public.label_specs;
drop policy label_specs_insert on public.label_specs;
drop policy label_specs_update on public.label_specs;
drop policy label_specs_delete on public.label_specs;
drop policy label_rounds_read on public.label_rounds;
drop policy label_rounds_insert on public.label_rounds;
drop policy label_rounds_update on public.label_rounds;

create policy label_specs_read on public.label_specs for select using (public.label_can_view());
create policy label_specs_insert on public.label_specs for insert with check (public.label_can_edit());
create policy label_specs_update on public.label_specs for update using (public.label_can_edit()) with check (public.label_can_edit());
create policy label_specs_delete on public.label_specs for delete using (public.label_can_edit());
create policy label_rounds_read on public.label_rounds for select using (public.label_can_view());
create policy label_rounds_insert on public.label_rounds for insert with check (public.label_can_edit());
create policy label_rounds_update on public.label_rounds for update using (public.label_can_edit()) with check (public.label_can_edit());
