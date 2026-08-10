-- รอบจ่ายเงินเดือนมี 3 รอบ: 28 · 30 · 4  (ตอนย้ายระบบมาแค่ 28 กับ 4)
--
-- ── ทำไมของเดิมล็อกไว้แค่ 28 ───────────────────────────────────────────
-- เพราะวันที่ 29-31 ไม่มีในทุกเดือน กุมภามี 28 วัน (ปีอธิกสุรทิน 29)
-- ถ้าปล่อยให้ตั้ง 30 แล้วคำนวณตรง ๆ จะได้ "2 มีนาคม" แทนที่จะเป็นสิ้นเดือนกุมภา
-- คือจ่ายช้าไป 2 วันทุกเดือนกุมภา และรอบเงินเดือนเหลื่อมกันทั้งปี
--
-- เปิดให้ตั้งได้ถึง 31 แต่ต้องแก้วิธีคำนวณให้ "ตกสิ้นเดือน" เมื่อเดือนนั้นไม่มีวันนั้น

/* วันที่ N ของเดือน — ถ้าเดือนนั้นไม่มี ให้เป็นวันสุดท้ายของเดือนแทน */
create or replace function public.clamp_day(p_month_start date, p_day integer)
returns date
language sql
immutable
set search_path to ''
as $function$
  select least(
    p_month_start + (p_day - 1),
    (p_month_start + interval '1 month' - interval '1 day')::date
  );
$function$;

comment on function public.clamp_day is
  'วันที่ N ของเดือน โดยไม่ล้นไปเดือนถัดไป — 30 ก.พ. = 28 ก.พ. (หรือ 29 ในปีอธิกสุรทิน)';

alter table public.payroll_cycles
  drop constraint if exists payroll_cycles_pay_day_check,
  drop constraint if exists payroll_cycles_period_start_day_check;

alter table public.payroll_cycles
  add constraint payroll_cycles_pay_day_check
    check (pay_day between 1 and 31),
  add constraint payroll_cycles_period_start_day_check
    check (period_start_day between 1 and 31);

alter table public.payroll_cycles alter column note drop not null;

insert into public.payroll_cycles (code, name_th, pay_day, period_start_day, is_active, note)
values ('c30', 'รอบวันที่ 30', 30, 30, true, 'เดือนที่ไม่มีวันที่ 30 จะจ่ายวันสุดท้ายของเดือนแทน')
on conflict (code) do update
  set name_th          = excluded.name_th,
      pay_day          = excluded.pay_day,
      period_start_day = excluded.period_start_day,
      is_active        = true;

/* คำนวณรอบ — เดิมบวกวันตรง ๆ จึงล้นเดือน ตอนนี้ตัดที่สิ้นเดือน */
create or replace function public.payroll_period(p_cycle text, p_pay_month date)
 returns table(period_start date, period_end date, pay_date date)
 language sql
 stable
 set search_path to ''
as $function$
  with c as (select * from public.payroll_cycles where code = p_cycle),
       m as (select date_trunc('month', p_pay_month)::date as this_month)
  select
    public.clamp_day((m.this_month - interval '1 month')::date, c.period_start_day),
    public.clamp_day(m.this_month, c.period_start_day) - 1,
    public.clamp_day(m.this_month, c.pay_day)
  from c, m;
$function$;

comment on function public.payroll_period is
  'ช่วงเงินเดือนของรอบนั้นในเดือนที่ระบุ — วันที่เกินสิ้นเดือนจะถูกตัดมาที่วันสุดท้ายของเดือน';

/* กันพิมพ์รหัสรอบผิดในตารางหน้าที่ — ผิดแล้ว payroll_period คืนค่าว่างเงียบ ๆ */
alter table public.job_functions
  add constraint job_functions_payroll_cycle_fkey
  foreign key (payroll_cycle) references public.payroll_cycles(code);;
