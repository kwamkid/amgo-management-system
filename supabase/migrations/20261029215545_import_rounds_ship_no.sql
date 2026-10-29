-- Container number per brand per year, same numbering AGD uses for invoice folders
-- ("Hape #5_ INV. …"). Owner 30 Oct 2026: 2026-C1 = Hape 2026 #5, next = #6.
-- Rounds sharing a container share the number. New rounds get it from the sync script.
alter table public.import_rounds add column ship_no integer;
update public.import_rounds set ship_no = 5 where container = '2026-C1';
