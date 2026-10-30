-- ฉลาก สคบ. (owner 30 Oct 2026) — stickers the factory prints for each import round
--
-- label_specs = what goes on a label, layered: '*' (all brands) → round brand → sub-brand part
--               → category (grp) → product code. Each layer only fills the fields it sets (null = inherit).
--               Kept per brand + code, not per round → filled once, reused by every later round.
-- label_rounds = per-round print settings + the public share token the factory opens.
-- Access = import_access (view) / can_edit (write), same as the import module.

create table public.label_specs (
  brand         text not null,                 -- lower-case: '*' · 'hape' · 'j''adore'
  scope         text not null check (scope in ('brand', 'group', 'product')),
  key           text not null default '',      -- '' (brand) · category name · item code
  header        text,                          -- big line on top (PolyM, Flower Monaco …)
  type_th       text,                          -- ชื่อ/ประเภทสินค้าภาษาไทย
  warning       text,
  age           text,
  usage         text,
  manufacturer  text,
  country       text,
  importer      text,
  address       text,
  contact       text,
  tis_text      text,                          -- "มอก. 685 เล่ม 1-2562"
  tis_license   text,                          -- "น34375-5969/685"
  show_license  boolean,
  qr_url        text,                          -- TISI licence page (appdb.tisi.go.th)
  size          text check (size is null or size ~ '^\d+(\.\d+)?x\d+(\.\d+)?$'),  -- "50x50" mm
  tis_type      smallint check (tis_type between 1 and 6),  -- type no. on the TIS licence
  price         numeric check (price is null or price >= 0), -- product only; null = SRP Calculator
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.users(id),
  primary key (brand, scope, key),
  check ((scope = 'brand') = (key = ''))
);

create table public.label_rounds (
  round_id      uuid primary key references public.import_rounds(id) on delete cascade,
  import_month  text,                          -- "12/2026"; null = month of import_rounds.arrive
  extra_pct     numeric not null default 2 check (extra_pct between 0 and 50),  -- spare copies
  default_size  text not null default '50x50' check (default_size ~ '^\d+(\.\d+)?x\d+(\.\d+)?$'),
  share_token   text unique,                   -- null = not shared
  shared_at     timestamptz,
  shared_by     uuid references public.users(id),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.users(id)
);

alter table public.label_specs enable row level security;
alter table public.label_rounds enable row level security;

create policy label_specs_read on public.label_specs for select using (public.import_can_view());
create policy label_specs_insert on public.label_specs for insert with check (public.import_can_edit());
create policy label_specs_update on public.label_specs for update using (public.import_can_edit()) with check (public.import_can_edit());
create policy label_specs_delete on public.label_specs for delete using (public.import_can_edit());

create policy label_rounds_read on public.label_rounds for select using (public.import_can_view());
create policy label_rounds_insert on public.label_rounds for insert with check (public.import_can_edit());
create policy label_rounds_update on public.label_rounds for update using (public.import_can_edit()) with check (public.import_can_edit());

-- defaults from the owner's sample stickers (01-AGD/สคบ/*.png) + the TISI page behind their QR
insert into public.label_specs (brand, scope, key, importer, address, contact, tis_text, tis_license, show_license, qr_url, size)
values ('*', 'brand', '', 'บริษัท เอจี ดราก้อน จำกัด', '194/63 ถนนท่าข้าม แสมดำ บางขุนเทียน กทม 10150',
        'ติดต่อ line : @abcthebaby', 'มอก. 685 เล่ม 1-2562', 'น34375-5969/685', false,
        'https://appdb.tisi.go.th/Q/i.php?d=2095240074', '50x50');
insert into public.label_specs (brand, scope, key, header, manufacturer, country)
values ('hape', 'brand', '', 'Hape', 'Hape International (Ningbo) Ltd.', 'ประเทศจีน'),
       ('j''adore', 'brand', '', 'J''adore', null, null);
insert into public.label_specs (brand, scope, key, header)
values ('hape', 'group', 'PolyM', 'PolyM');
