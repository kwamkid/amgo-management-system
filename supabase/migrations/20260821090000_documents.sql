-- ระบบออกเอกสารบริษัท — หัวจดหมายกลาง 1 แบบ ใช้ได้ทั้ง 3 บริษัท
--
-- ── ทำไมต้องมี (เจ้าของสั่ง 21 ส.ค. 69) ──────────────────────────────
-- ของเดิมพิมพ์ใน Word ทีละไฟล์ (ตัวอย่าง: จดหมายอัดฉีดยอดขาย PC ABC THE BABY)
-- ปัญหาที่เจอจากไฟล์ตัวอย่าง:
--   · ฟอนต์ Angsana New ตัวบางและเล็ก อ่านยาก ดูไม่เป็นทางการ
--   · ช่องลงชื่อลอยตามความยาวเนื้อหา เนื้อหาสั้นลายเซ็นลอยกลางหน้า
--   · หัวจดหมายก๊อปข้ามไฟล์ ที่อยู่/เบอร์เพี้ยนกันคนละใบ
--   · ออกไปแล้วไม่มีที่เก็บ หาใบเก่าไม่เจอ ไม่รู้ว่าใครออก
-- ทำเป็นแม่แบบเดียว แล้วสลับแค่ โลโก้ + ข้อมูลบริษัท ตามที่เจ้าของสั่ง
--
-- ── ทำไมเนื้อหาเป็น text ธรรมดา ─────────────────────────────────────
-- เจ้าของสั่งให้พิมพ์เนื้อหารวดเดียวในช่องเดียว (ไม่ใช่กดเพิ่มบล็อกทีละอัน)
-- ต้นฉบับจึงเป็น "ข้อความที่พิมพ์" ตรง ๆ · โครงเอกสาร (ย่อหน้า/หัวข้อ/รายการ)
-- ได้จาก parseBody() ตอนเรนเดอร์ ไม่เก็บซ้ำลงฐานข้อมูล
--
-- ทำไมไม่เก็บทั้งข้อความและบล็อก: เอกสารถูกเรนเดอร์ 2 ที่ (แผ่น A4 สำหรับ PDF
-- และไฟล์ .docx) ถ้ามีต้นฉบับ 2 ชุด วันหนึ่งจะมีทางแก้ที่อัปเดตชุดเดียว
-- แล้วไฟล์ Word กับ PDF ของใบเดียวกันไม่ตรงกันโดยไม่มีใครรู้

alter table companies
  -- หัวจดหมายมีชื่ออังกฤษบรรทัดที่สองเสมอ (AG DRAGON CO., LTD.)
  add column if not exists name_en text,
  add column if not exists phone text,
  -- "(สำนักงานใหญ่)" ต่อท้ายชื่อไทย — สาขาอื่นเปลี่ยนคำได้ ว่างไว้ = ไม่ขึ้น
  add column if not exists branch_label text not null default 'สำนักงานใหญ่';

create table documents (
  id uuid primary key default gen_random_uuid(),

  -- เลขที่เอกสาร — ระบบเดินเลขให้เอง ดู trigger documents_number ท้ายไฟล์
  doc_no text not null default '',

  company_id uuid not null references companies(id),

  title text not null default '',        -- เรื่อง
  period text not null default '',       -- ระยะเวลา (เว้นว่าง = ไม่ขึ้นบรรทัดนี้)
  recipient text not null default '',    -- เรียน

  -- ข้อความที่พิมพ์ทั้งก้อน — ดูกติกาการแปลใน lib/documents/types.ts (parseBody)
  --   ขึ้นต้น - * •  = หัวข้อย่อย · ขึ้นต้น # = หัวข้อตัวหนา · บรรทัดอื่น = ย่อหน้า
  body_text text not null default '',

  -- ผู้ลงนาม 1–2 คน [{ name: string, title: string }]
  -- name ว่าง = พิมพ์วงเล็บเว้นไว้ให้เขียนมือ (ปกติเซ็นแล้วค่อยเขียนชื่อ)
  signers jsonb not null default '[]'::jsonb,

  -- draft = ยังแก้ได้เรื่อย ๆ · issued = ออกไปแล้ว ล็อกไม่ให้แก้เงียบ ๆ
  status text not null default 'draft' check (status in ('draft', 'issued')),
  -- วันที่บนเอกสาร = วันที่สร้าง ("ก็ออกวันนี้นี่แหละ" — เจ้าของ 21 ส.ค.)
  issued_at date not null default current_date,

  -- auth.uid() เป็นค่าตั้งต้น — ชื่อผู้สร้างจะได้ติดมาเองแม้แถวไม่ได้เกิด
  -- จากหน้าจอ (สคริปต์/แก้มือใน Supabase) ไม่ใช่รอให้โค้ดฝั่งแอปใส่ให้
  created_by uuid references users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid references users(id) default auth.uid(),
  updated_at timestamptz not null default now(),

  -- เกิน 2 ช่องลงชื่อหน้ากระดาษวางไม่ลง — กันไว้ที่ฐานข้อมูลเลย
  constraint documents_signers_max_two
    check (jsonb_array_length(signers) between 0 and 2)
);

create index documents_company_idx on documents (company_id, created_at desc);
create index documents_created_idx on documents (created_at desc);

-- ── ประวัติการแก้ ───────────────────────────────────────────────────
-- เก็บ "ของเดิมก่อนแก้" ไม่ใช่ของใหม่ — แถวปัจจุบันอยู่ใน documents อยู่แล้ว
-- เขียนด้วย trigger ไม่ใช่โค้ดฝั่งแอป เพราะทางแก้มีหลายทาง (หน้าจอ/สคริปต์/
-- แก้มือใน Supabase) ถ้าให้โค้ดเขียนเอง วันหนึ่งจะมีทางที่ลืมเขียน
create table document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  version int not null,
  -- ทั้งแถวตอนนั้น รวมชื่อบริษัทที่เลือกไว้ด้วย — เผื่อบริษัทเปลี่ยนที่อยู่ทีหลัง
  snapshot jsonb not null,
  changed_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

create index document_versions_doc_idx
  on document_versions (document_id, version desc);

create or replace function documents_keep_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version int;
begin
  -- แตะแล้วไม่เปลี่ยนอะไร (เช่นกดบันทึกซ้ำ) ไม่ต้องเก็บรุ่นซ้ำ
  if to_jsonb(old) - 'updated_at' - 'updated_by' = to_jsonb(new) - 'updated_at' - 'updated_by' then
    return new;
  end if;

  select coalesce(max(version), 0) + 1 into next_version
    from document_versions where document_id = old.id;

  insert into document_versions (document_id, version, snapshot, changed_by)
  values (old.id, next_version, to_jsonb(old), auth.uid());

  new.updated_at := now();
  return new;
end;
$$;

create trigger documents_history
  before update on documents
  for each row execute function documents_keep_history();

alter table documents enable row level security;
alter table document_versions enable row level security;

-- เอกสารบริษัทเป็นงาน HR/แอดมิน — พนักงานทั่วไปไม่ต้องเห็นใบร่างของคนอื่น
create policy documents_manage on documents
  for all to authenticated
  using (is_hr()) with check (is_hr());
-- (แยกเป็น read/insert/update/delete ทีหลัง — ดูท้ายไฟล์ เรื่องสิทธิ์ลบ)

-- ประวัติอ่านได้อย่างเดียว ห้ามใครแก้ย้อนหลัง (trigger เขียนด้วย security definer)
create policy document_versions_read on document_versions
  for select to authenticated
  using (is_hr());

-- ── ชื่ออังกฤษ + เบอร์ ที่เจ้าของให้มา 21 ส.ค. ──────────────────────
-- เบอร์ทั้งหมดเจ้าของให้มาเอง 21 ส.ค. — ของ AGD เปลี่ยนจากเบอร์ออฟฟิศ
-- ที่อยู่บนจดหมายตัวอย่างเดิม (02-102-6963) มาเป็นเบอร์มือถือ
-- ใส่ขีดคั่นให้อ่านง่ายบนหัวจดหมาย (เจ้าของพิมพ์มาติดกัน)
update companies set name_en = 'AG DRAGON CO., LTD.', phone = '089-153-0539'
  where code = 'AGD';
update companies set name_en = 'A DAY FRESH CO., LTD.', phone = '089-894-9491'
  where code = 'ADAY FRESH';
update companies set name_en = 'ALPHA FRESH CO., LTD.', phone = '089-894-9491'
  where code = 'ALPHA FRESH';

-- ── เปิดให้ระดับผู้จัดการด้วย (เจ้าของสั่ง 21 ส.ค. หลังเห็นหน้าจอ) ────
-- can_view_all() = manager + hr + admin · ต่างจาก is_hr() ที่มีแค่ hr + admin
-- ผู้จัดการออกเอกสารเองได้ แต่ยัง "แก้ข้อมูลบริษัท" ไม่ได้ (companies_manage
-- ยังเป็น is_hr() อยู่) — ที่อยู่/เลขผู้เสียภาษีบนหัวจดหมายจึงยังคุมโดย HR
drop policy documents_manage on documents;
drop policy document_versions_read on document_versions;

create policy documents_manage on documents
  for all to authenticated
  using (can_view_all()) with check (can_view_all());

create policy document_versions_read on document_versions
  for select to authenticated
  using (can_view_all());

-- ── เลขที่เอกสารเดินเอง ─────────────────────────────────────────────
-- เจ้าของสั่ง 21 ส.ค.: "วันที่ออกกับเลขที่เอกสาร มันไม่ขึ้นแล้วจะกรอกทำไม
-- ให้มันเจนให้เราเองเลย ออก running ไปเลย"
--
-- รูปแบบ  <รหัสบริษัท>-<ปีพ.ศ.>/<ลำดับ 3 หลัก>   เช่น AGD-2569/001
-- เดินแยกตาม บริษัท + ปี — ขึ้นปีใหม่เริ่ม 001 ใหม่ตามธรรมเนียมเอกสารไทย
--
-- ทำใน trigger ไม่ใช่ฝั่งแอป เพราะการหา "เลขถัดไป" ต้องอ่านแล้วเขียนติดกัน
-- ถ้าให้แอปทำ สองคนกดสร้างพร้อมกันจะอ่านเลขเดิมทั้งคู่แล้วได้เลขซ้ำ
create unique index documents_doc_no_uniq on documents (doc_no)
  where doc_no <> '';

create or replace function documents_assign_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prefix text;
  next_no int;
begin
  -- แก้เลขเองไว้แล้วไม่ต้องยุ่ง (เผื่อต้องอ้างเลขตามระเบียบเดิมของบริษัท)
  if tg_op = 'UPDATE' and new.doc_no is distinct from old.doc_no then
    return new;
  end if;

  -- ตอนแก้: ออกเลขใหม่เฉพาะตอนย้ายบริษัท ไม่งั้นเลขจะขึ้นต้นด้วยรหัสบริษัทเก่า
  if tg_op = 'UPDATE'
     and new.company_id is not distinct from old.company_id
     and new.doc_no <> '' then
    return new;
  end if;

  select upper(regexp_replace(c.code, '[^A-Za-z0-9]', '', 'g'))
         || '-'
         || (extract(year from coalesce(new.issued_at, current_date))::int + 543)
         || '/'
    into prefix
    from companies c where c.id = new.company_id;

  if prefix is null then
    return new;
  end if;

  select coalesce(max((regexp_replace(doc_no, '^.*/', ''))::int), 0) + 1
    into next_no
    from documents
   where doc_no like prefix || '%'
     and doc_no ~ ('^' || prefix || '[0-9]+$')
     and (tg_op = 'INSERT' or id <> new.id);

  new.doc_no := prefix || lpad(next_no::text, 3, '0');
  return new;
end;
$$;

create trigger documents_number
  before insert or update of company_id on documents
  for each row execute function documents_assign_no();

-- ── สิทธิ์ลบเอกสาร (เจ้าของสั่ง 21 ส.ค.) ────────────────────────────
-- แอดมิน = ลบได้ทุกใบ · คนอื่น (HR/ผู้จัดการ) = ลบได้เฉพาะใบที่ยังเป็นร่าง
--
-- ของเดิมเป็น `for all` policy เดียว ซึ่งแปลว่าทุกคนที่เข้าถึงได้ลบใบที่
-- ออกไปแล้วได้ด้วย — ต้องแยก policy ไม่งั้นกติกาอยู่แค่บนหน้าจอ
-- (ซ่อนปุ่มไม่ใช่การกันสิทธิ์ ใครยิง API ตรงก็ลบได้อยู่ดี)
--
-- ประวัติการแก้ (document_versions) มี on delete cascade อยู่แล้ว จึงหายตาม
drop policy documents_manage on documents;

create policy documents_read on documents
  for select to authenticated using (can_view_all());

create policy documents_insert on documents
  for insert to authenticated with check (can_view_all());

create policy documents_update on documents
  for update to authenticated
  using (can_view_all()) with check (can_view_all());

create policy documents_delete on documents
  for delete to authenticated
  using (can_view_all() and (is_admin() or status = 'draft'));

-- ── ลิงก์แชร์เอกสาร (เจ้าของสั่ง 21 ส.ค.) ────────────────────────────
-- "ส่งลิงก์ให้ดูเพื่อ approve ง่าย ๆ แต่ต้อง login ก่อนถึงจะดูได้"
--
-- ทำเป็น token ในลิงก์ ไม่ใช่เปิด policy ให้พนักงานอ่าน documents ได้ทุกใบ —
-- ถ้าเปิด policy ใครที่ล็อกอินก็ดึงจดหมายทุกฉบับออกไปได้ ทั้งที่ไม่เคยได้ลิงก์
-- (จดหมายมีอัตราค่าคอม/เงื่อนไขภายในอยู่ด้วย)
--
-- token อยู่คู่กับเอกสาร ไม่ใช่คู่กับคน — ใครส่งลิงก์ต่อก็เปิดได้ ตรงตามที่สั่ง
-- ถ้าวันหนึ่งอยากตัดลิงก์เก่าทิ้ง แค่ออก token ใหม่ให้ใบนั้น
alter table documents
  add column share_token uuid not null default gen_random_uuid();

-- อ่านผ่าน token — คืนเฉพาะช่องที่ต้องใช้วาดเอกสาร ไม่คืนทั้งแถว
-- (created_by / updated_by / share_token ไม่หลุดออกไปกับผลลัพธ์)
create or replace function document_by_share(p_id uuid, p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'doc_no',    d.doc_no,
           'title',     d.title,
           'period',    d.period,
           'recipient', d.recipient,
           'body_text', d.body_text,
           'signers',   d.signers,
           'status',    d.status,
           'issued_at', d.issued_at,
           'company', jsonb_build_object(
             'id', c.id, 'code', c.code, 'name_th', c.name_th,
             'name_en', c.name_en, 'address', c.address, 'phone', c.phone,
             'registration_no', c.registration_no,
             'branch_label', c.branch_label, 'logo_url', c.logo_url
           )
         )
    from documents d
    join companies c on c.id = d.company_id
   where d.id = p_id
     and d.share_token = p_token
     -- ต้องล็อกอินก่อน ตามที่เจ้าของกำหนด — ลิงก์อย่างเดียวไม่พอ
     and auth.uid() is not null;
$$;

-- security definer มองข้าม RLS ได้ จึงต้องปิดไม่ให้คนที่ยังไม่ล็อกอินเรียก
revoke execute on function document_by_share(uuid, uuid) from public, anon;
grant execute on function document_by_share(uuid, uuid) to authenticated;
