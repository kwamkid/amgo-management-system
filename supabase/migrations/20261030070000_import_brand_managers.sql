-- Import: brand managers see their own brand's order plans (owner 30 Oct 2026).
-- Brand manager = has SRP access to that brand (srp_brand_access). They read rounds of that brand only, never edit,
-- never see cost/FOB (the API strips it). import_access rows (owner) keep full access as before.

create or replace function public.import_my_brands()
returns text[] language sql stable security definer set search_path to 'public'
as $$
  select coalesce(array_agg(distinct lower(b.name)), '{}')
  from public.srp_brand_access s join public.srp_brands b on b.id = s.brand_id
  where s.user_id = auth.uid();
$$;

-- a round is visible to a brand manager when its brand, sub-brand, SRP brand or any merged part is theirs
create or replace function public.import_round_visible(p_brand text, p_sub text, p_srp text, p_extra jsonb)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select public.import_can_view() or exists (
    select 1 from unnest(public.import_my_brands()) mine
    where mine in (lower(p_brand), lower(nullif(p_sub, '')), lower(p_srp))
       or mine in (select lower(p->>'srpBrand') from jsonb_array_elements(coalesce(p_extra->'parts', '[]'::jsonb)) p)
  );
$$;

drop policy import_rounds_read on public.import_rounds;
create policy import_rounds_read on public.import_rounds
  for select using (public.import_round_visible(brand, sub, srp_brand, extra));

drop policy import_items_read on public.import_round_items;
create policy import_items_read on public.import_round_items
  for select using (exists (
    select 1 from public.import_rounds r
    where r.id = round_id and public.import_round_visible(r.brand, r.sub, r.srp_brand, r.extra)));

-- the page's one-request RPC: same visibility; container mates only when visible too
create or replace function public.import_plan(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  r public.import_rounds;
  brands text[];
begin
  select * into r from public.import_rounds where slug = p_slug;
  if r.id is null then
    if not public.import_can_view() and cardinality(public.import_my_brands()) = 0 then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    return null;
  end if;
  if not public.import_round_visible(r.brand, r.sub, r.srp_brand, r.extra) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(array_agg(p->>'srpBrand'), array[coalesce(r.srp_brand, nullif(r.sub, ''), r.brand)])
    into brands
    from jsonb_array_elements(coalesce(r.extra->'parts', '[]'::jsonb)) p;

  return jsonb_build_object(
    'round', to_jsonb(r),
    'items', coalesce((select jsonb_agg(to_jsonb(i) - 'round_id' - 'updated_at' - 'qty_edited_by' order by i.sort)
                         from public.import_round_items i where i.round_id = r.id), '[]'::jsonb),
    'logos', coalesce((select jsonb_object_agg(lower(b.name), b.logo_url)
                         from public.srp_brands b where b.logo_url is not null), '{}'::jsonb),
    'srp', coalesce((select jsonb_agg(jsonb_build_object(
                         'brand', b.name, 'id', b.id, 'usdToThb', b.usd_to_thb, 'eurToThb', b.eur_to_thb,
                         'prices', coalesce((select jsonb_object_agg(trim(p.sku), jsonb_build_object(
                                    'ourPrice', coalesce(p.our_price_thb, 0), 'platformPrice', coalesce(p.platform_price_thb, 0),
                                    'edited', p.last_edited_at))
                                  from public.srp_products p
                                  where p.brand_id = b.id and p.is_active and coalesce(trim(p.sku), '') <> ''), '{}'::jsonb)))
                       from public.srp_brands b where b.name = any(brands)), '[]'::jsonb),
    'srpBrands', to_jsonb(brands),
    'mates', coalesce((select jsonb_agg(m.slug) from public.import_rounds m
                        where r.container is not null and m.container = r.container and m.id <> r.id
                          and public.import_round_visible(m.brand, m.sub, m.srp_brand, m.extra)), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.import_plan(text) from public, anon;
grant execute on function public.import_plan(text) to authenticated;

-- menu: owner rows as before; a brand manager gets a read-only, no-cost grant once a round of their brand exists
create or replace function public.my_profile()
 returns jsonb
 language sql
 stable
 set search_path to ''
as $function$
  select jsonb_build_object(
    'user', to_jsonb(u),
    'location_ids', coalesce(
      (select jsonb_agg(l.location_id) from public.user_allowed_locations l where l.user_id = u.id),
      '[]'::jsonb),
    'job_function', (
      select jsonb_build_object(
        'sees_delivery', jf.sees_delivery, 'code', jf.code, 'schedule_type', jf.schedule_type,
        'work_start_time', jf.work_start_time, 'work_end_time', jf.work_end_time)
      from public.job_functions jf where jf.id = u.job_function_id),
    'has_srp_access', u.role = 'admin'
      or exists (select 1 from public.srp_brand_access s where s.user_id = u.id),
    'has_web_access', exists (select 1 from public.web_owners w where w.user_id = u.id),
    'import_access', coalesce(
      (select jsonb_build_object('can_edit', a.can_edit, 'see_cost', a.see_cost)
       from public.import_access a where a.user_id = u.id),
      case when exists (select 1 from public.import_rounds) -- RLS: only rounds of the user's SRP brands
           then jsonb_build_object('can_edit', false, 'see_cost', false) end),
    'has_push', exists (select 1 from public.push_subscriptions p where p.user_id = u.id),
    'needs_day_off', public.is_six_day_worker(u.id) and public.weekly_off_days(u.id) <> 1
  )
  from public.users u
  where u.id = auth.uid();
$function$;
