-- One round per order form (owner 30 Oct 2026: Hape + J'adore are one file = one round).
-- `source` = which plan file / sub-brand a line came from ('' = the main brand), so each
-- builder file only replaces its own lines. J'adore's lines move into the Hape round.
alter table public.import_round_items add column source text not null default '';

do $$
declare h uuid; j uuid; jx jsonb;
begin
  select id into h from public.import_rounds where slug = 'C1-hape';
  select id, extra into j, jx from public.import_rounds where slug = 'C1-jadore';
  if h is null or j is null then return; end if;
  update public.import_round_items
     set round_id = h, source = 'J''adore', sub = grp, grp = 'J''adore'
   where round_id = j;
  update public.import_rounds
     set extra = extra || jsonb_build_object('parts', jsonb_build_array(
           jsonb_build_object('source', '', 'name', 'Hape', 'srpBrand', 'Hape'),
           jsonb_build_object('source', 'J''adore', 'name', 'J''adore', 'srpBrand', 'J''adore',
                              'sentFile', jx->>'sentFile')))
   where id = h;
  delete from public.import_rounds where id = j;
end $$;
