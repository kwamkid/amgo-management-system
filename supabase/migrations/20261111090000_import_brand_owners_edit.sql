-- Import: brand owners edit their own brand's order plans and see its cost (owner 11 Nov 2026).
-- Brand owner = SRP Calculator access with role 'editor' for that brand (srp_brand_access). They may change qty /
-- status / fx and see FOB on rounds of that brand only. SRP 'viewer' stays read-only without cost (30 Oct rule).

create or replace function public.import_my_edit_brands()
returns text[] language sql stable security definer set search_path to 'public'
as $$
  select coalesce(array_agg(distinct lower(b.name)), '{}')
  from public.srp_brand_access s join public.srp_brands b on b.id = s.brand_id
  where s.user_id = auth.uid() and s.role = 'editor';
$$;
revoke all on function public.import_my_edit_brands() from public, anon;
grant execute on function public.import_my_edit_brands() to authenticated;

-- a round is editable by its brand owner: the round's own brand / SRP brand must be theirs
-- (a merged round like Hape + J'adore belongs to the main brand's owner)
create or replace function public.import_round_editable(p_brand text, p_srp text)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select public.import_can_edit() or exists (
    select 1 from unnest(public.import_my_edit_brands()) mine
    where mine in (lower(p_brand), lower(p_srp))
  );
$$;
revoke all on function public.import_round_editable(text, text) from public, anon;
grant execute on function public.import_round_editable(text, text) to authenticated;

drop policy import_rounds_write on public.import_rounds;
create policy import_rounds_write on public.import_rounds
  for update using (public.import_round_editable(brand, srp_brand))
  with check (public.import_round_editable(brand, srp_brand));

drop policy import_items_write on public.import_round_items;
create policy import_items_write on public.import_round_items
  for update using (exists (
    select 1 from public.import_rounds r
    where r.id = round_id and public.import_round_editable(r.brand, r.srp_brand)))
  with check (exists (
    select 1 from public.import_rounds r
    where r.id = round_id and public.import_round_editable(r.brand, r.srp_brand)));
