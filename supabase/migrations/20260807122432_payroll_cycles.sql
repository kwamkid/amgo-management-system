-- ═══════════════════════════════════════════════════════════════════════
-- รอบตัดเงินเดือน (ตัดสินใจ 2026-08-07)
--   รอบ 28 — จ่ายวันที่ 28 · นับงาน 28 ถึง 27 เดือนถัดไป · employee ทั่วไป
--   รอบ 4  — จ่ายวันที่ 4  · นับงาน 4 ถึง 3 เดือนถัดไป  · พนักงานขายห้าง/ABC
-- (เดิมมีรอบวันที่ 1 ด้วย — ตัดทิ้งตามที่เจ้าของระบบตัดสินใจ)
-- ═══════════════════════════════════════════════════════════════════════

create table payroll_cycles (
  code            text primary key,
  name_th         text not null,
  pay_day         smallint not null check (pay_day between 1 and 28),
  period_start_day smallint not null check (period_start_day between 1 and 28),
  is_active       boolean not null default true,
  note            text not null default ''
);

insert into payroll_cycles (code, name_th, pay_day, period_start_day, note) values
  ('c28', 'รอบวันที่ 28', 28, 28, 'employee ทั่วไป · ออฟฟิศ · คลังสินค้า'),
  ('c4',  'รอบวันที่ 4',   4,  4, 'พนักงานขายตามห้าง / ABC');

alter table payroll_cycles enable row level security;

comment on table payroll_cycles is
  'ช่วงนับงาน = period_start_day ของเดือนนี้ ถึง (period_start_day - 1) ของเดือนถัดไป';

alter table business_units add column payroll_cycle text references payroll_cycles(code);
alter table users add column payroll_cycle text references payroll_cycles(code);

comment on column users.payroll_cycle is 'null = ใช้ของหน่วยงาน · ใส่ค่าเพื่อ override เฉพาะคนนี้';

create or replace function payroll_period(p_cycle text, p_pay_month date)
returns table (period_start date, period_end date, pay_date date)
language sql stable security invoker set search_path = ''
as $$
  select
    (date_trunc('month', p_pay_month) - interval '1 month' + (c.period_start_day - 1) * interval '1 day')::date,
    (date_trunc('month', p_pay_month) + (c.period_start_day - 2) * interval '1 day')::date,
    (date_trunc('month', p_pay_month) + (c.pay_day - 1) * interval '1 day')::date
  from public.payroll_cycles c where c.code = p_cycle;
$$;

comment on function payroll_period is
  'เช่น c28 จ่ายเดือน ก.ย. → นับงาน 28 ส.ค. ถึง 27 ก.ย. จ่าย 28 ก.ย.';
