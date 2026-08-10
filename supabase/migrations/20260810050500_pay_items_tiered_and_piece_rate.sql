-- รายได้พิเศษแบบ "สูตร" — ค่าคอมขั้นบันได กับ ค่าชิ้นงาน
--
-- ── ต่างจากของเดิมยังไง ───────────────────────────────────────────────
-- ของเดิมทุกรายการเป็นยอดคงที่ (ค่าตำแหน่ง 2,000 ทุกเดือน)
-- แต่ค่าคอมกับค่าชิ้นงานตัวเลขจริงขึ้นกับยอดขาย/จำนวนชิ้นของเดือนนั้น
-- สิ่งที่เก็บได้ตอนนี้คือ "กติกา" — ยอดจ่ายจริงคำนวณตอนทำเงินเดือนแต่ละเดือน
--
--   fixed          amount = ยอดต่อเดือน                    (แบบเดิม)
--   tiered_percent config = {tiers:[{upTo,percent},...]}   ขั้นสุดท้าย upTo = null = เกินจากนั้น
--   per_piece      amount = บาทต่อชิ้น

alter table public.user_pay_items
  add column if not exists calc text not null default 'fixed'
    check (calc in ('fixed','tiered_percent','per_piece')),
  add column if not exists config jsonb;

comment on column public.user_pay_items.calc is
  'fixed = ยอดคงที่ · tiered_percent = ค่าคอมขั้นบันได (กติกาใน config) · per_piece = บาทต่อชิ้น (amount = เรต)';
comment on column public.user_pay_items.config is
  'กติกาของแบบที่ไม่คงที่ เช่น {"tiers":[{"upTo":100000,"percent":2},{"upTo":null,"percent":3}]}';

-- เพิ่มประเภท "ค่าชิ้นงาน"
alter table public.user_pay_items drop constraint if exists user_pay_items_kind_check;
alter table public.user_pay_items add constraint user_pay_items_kind_check
  check (kind in ('commission','position','travel','diligence','phone','housing','piece','other'));

-- ยอดรวมต่อเดือนนับได้เฉพาะรายการคงที่ — ค่าคอม/ค่าชิ้นงานต้องรอยอดจริง
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
    and i.calc = 'fixed'
    and i.effective_from <= p_date
    and (i.effective_to is null or i.effective_to >= p_date);
$function$;

comment on function public.pay_items_total is
  'รวมรายได้พิเศษคงที่รายเดือน ณ วันนั้น — ไม่รวมค่าคอม/ค่าชิ้นงานที่ต้องรอยอดจริง';
