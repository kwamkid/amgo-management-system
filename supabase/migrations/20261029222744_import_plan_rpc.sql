-- One round trip for the order-plan page (owner 30 Oct 2026: "rpc, server load ได้เลย"):
-- the round, all its lines, the brand logos, the SRP Calculator prices of every brand in the
-- round, and the other rounds of the same container. Access = import_access (checked here,
-- security definer because SRP prices are per-brand-gated for everyone else).
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
  if not public.import_can_view() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.import_rounds where slug = p_slug;
  if r.id is null then return null; end if;

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
                        where r.container is not null and m.container = r.container and m.id <> r.id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.import_plan(text) from public, anon;
grant execute on function public.import_plan(text) to authenticated;
