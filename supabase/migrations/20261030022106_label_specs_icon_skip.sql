-- ฉลาก สคบ. (owner 30 Oct 2026): red "not for 0-3 years" pictogram as on sample 760020,
-- and lines that get no label at all (displays, POP stands).
alter table public.label_specs add column icon_03 boolean, add column skip boolean;
comment on column public.label_specs.icon_03 is 'print the red "not for 0-3 years" pictogram';
comment on column public.label_specs.skip is 'no label for this line (displays, POP, packaging)';
