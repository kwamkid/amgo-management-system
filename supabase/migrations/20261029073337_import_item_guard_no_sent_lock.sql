-- The order-plan page has its own "unlock to edit" for sent rounds (status stays sent),
-- so the DB no longer blocks edits on sent rounds; it only stamps who changed qty.
create or replace function public.trg_import_item_guard()
returns trigger language plpgsql set search_path to ''
as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if new.qty is distinct from old.qty then
    new.qty_edited_at := now();
    new.qty_edited_by := (select auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;
