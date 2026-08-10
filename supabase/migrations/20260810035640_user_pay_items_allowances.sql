-- รายได้พิเศษรายคน — ค่าคอม · ค่าตำแหน่ง · ค่าเดินทาง · เบี้ยขยัน ฯลฯ
--
-- ── ทำไมต้องแยกจาก user_compensation ──────────────────────────────────
-- user_compensation เก็บ "เงินเดือนพื้นฐาน" ซึ่งมีค่าเดียวต่อคนต่อช่วงเวลา
-- แต่รายได้พิเศษมีได้หลายรายการพร้อมกัน (ค่าตำแหน่ง + ค่าเดินทาง + ค่าคอม)
-- และแต่ละรายการเริ่ม/จบคนละเวลา  ยัดลงตารางเดิมต้องเพิ่มคอลัมน์ไม่รู้จบ
--
-- ── กรอกที่ไหน ────────────────────────────────────────────────────────
-- เงินเดือนพื้นฐาน  → หน้าแก้หลายคนพร้อมกัน (กรอกทีเดียว 41 คน)
-- รายได้พิเศษ       → หน้าของพนักงานแต่ละคน (ไม่เหมือนกันสักคน กรอกรวมไม่ได้)
--
-- ── ใครเห็นอะไร ───────────────────────────────────────────────────────
-- เหมือนเงินเดือนเป๊ะ: เจ้าตัวเห็นของตัวเอง · HR เห็นทุกคน · คนอื่นไม่เห็นเลย
-- เป็น RLS ที่ฐานข้อมูล ไม่ใช่แค่ซ่อนหน้าจอ

create table if not exists public.user_pay_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  kind           text not null default 'other'
                   check (kind in ('commission','position','travel','diligence','phone','housing','other')),
  /** ชื่อที่ HR พิมพ์เอง เช่น "ค่าคอมยอดขาย" — kind ไว้จัดกลุ่มตอนทำรายงาน */
  label          text not null check (btrim(label) <> ''),
  amount         numeric(12,2) not null check (amount >= 0),
  -- monthly = ได้ทุกเดือน · once = ได้ครั้งเดียวในรอบนั้น
  frequency      text not null default 'monthly' check (frequency in ('monthly','once')),
  effective_from date not null,
  effective_to   date,
  note           text,
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint user_pay_items_period_check check (effective_to is null or effective_to >= effective_from)
);

comment on table public.user_pay_items is
  'รายได้พิเศษรายคน — แยกจากเงินเดือนพื้นฐานเพราะมีได้หลายรายการพร้อมกัน';
comment on column public.user_pay_items.effective_to is
  'null = ยังได้อยู่ · ใส่วันที่ = หยุดจ่ายหลังวันนั้น (ไม่ลบทิ้ง ประวัติต้องอยู่ครบ)';

create index if not exists user_pay_items_user_idx on public.user_pay_items(user_id, effective_from desc);

alter table public.user_pay_items enable row level security;

-- เหมือน user_compensation: เจ้าตัวอ่านของตัวเอง · HR ทำได้ทุกอย่าง
create policy user_pay_items_select_own on public.user_pay_items
  for select using (user_id = (select auth.uid()) or public.is_hr());
create policy user_pay_items_manage on public.user_pay_items
  for all using (public.is_hr()) with check (public.is_hr());

create trigger user_pay_items_updated_at before update on public.user_pay_items
  for each row execute function public.set_updated_at();

/* รายได้พิเศษที่ยังมีผล ณ วันที่กำหนด — รวมยอดให้เลย */
create or replace function public.pay_items_total(p_user_id uuid, p_date date)
returns numeric
language sql
stable
set search_path to ''
as $function$
  select coalesce(sum(i.amount), 0)
  from public.user_pay_items i
  where i.user_id = p_user_id
    and i.frequency = 'monthly'
    and i.effective_from <= p_date
    and (i.effective_to is null or i.effective_to >= p_date);
$function$;

comment on function public.pay_items_total is
  'รวมรายได้พิเศษรายเดือนที่ยังมีผลในวันนั้น — ไม่รวมรายการครั้งเดียว';;
