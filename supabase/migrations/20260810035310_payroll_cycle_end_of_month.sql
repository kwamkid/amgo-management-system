-- เปลี่ยน "รอบวันที่ 30" เป็น "สิ้นเดือน" — ทำงานทั้งเดือน จ่ายวันสุดท้ายของเดือน
--
-- ── ทำไมแค่เปลี่ยนชื่อไม่พอ ────────────────────────────────────────────
-- ตัวคำนวณเดิมตั้งอยู่บนกติกาเดียว: "จ่ายวันที่ D แล้วรอบคือ D เดือนก่อน ถึง
-- D-1 เดือนนี้"  ซึ่งใช้ได้กับรอบ 28 กับรอบ 4 (จ่ายวันแรกของรอบถัดไป)
--
-- แต่ "สิ้นเดือน" เป็นกติกาคนละแบบ — จ่าย "วันสุดท้ายของรอบ" ไม่ใช่วันแรก
-- ของรอบถัดไป  ถ้ายัดเข้ากติกาเดิมจะได้ 31 ธ.ค. – 30 ม.ค. จ่าย 31 ม.ค.
-- ซึ่งไม่ใช่ "ทำงานเดือนมกรา รับเงินสิ้นเดือนมกรา" ที่ตั้งใจ
--
-- เลยเพิ่มธงบอกว่ารอบนี้จ่ายตอนไหน แทนที่จะเดาจากตัวเลข

alter table public.payroll_cycles
  add column if not exists pays_at_period_end boolean not null default false;

comment on column public.payroll_cycles.pays_at_period_end is
  'true = จ่ายวันสุดท้ายของรอบ (สิ้นเดือน) · false = จ่ายวันแรกของรอบถัดไป (รอบ 28 กับ 4)';

-- c30 เพิ่งสร้างเมื่อครู่ ยังไม่มีใครใช้ — เปลี่ยนรหัสให้ตรงความหมายไปเลย
update public.payroll_cycles
set code = 'eom'
where code = 'c30';

update public.payroll_cycles
set name_th            = 'สิ้นเดือน',
    pay_day            = 31,   -- clamp_day ตัดมาที่วันสุดท้ายจริงของแต่ละเดือนให้เอง
    period_start_day   = 1,
    pays_at_period_end = true,
    is_active          = true,
    note               = 'ทำงานทั้งเดือน จ่ายวันสุดท้ายของเดือน (ก.พ. = 28 หรือ 29)'
where code = 'eom';

create or replace function public.payroll_period(p_cycle text, p_pay_month date)
 returns table(period_start date, period_end date, pay_date date)
 language sql
 stable
 set search_path to ''
as $function$
  with c as (select * from public.payroll_cycles where code = p_cycle),
       m as (select date_trunc('month', p_pay_month)::date as this_month)
  select
    case when c.pays_at_period_end
         -- จ่ายท้ายรอบ: รอบอยู่ในเดือนที่จ่ายทั้งก้อน
         then public.clamp_day(m.this_month, c.period_start_day)
         -- จ่ายต้นรอบถัดไป: รอบเริ่มเดือนก่อน
         else public.clamp_day((m.this_month - interval '1 month')::date, c.period_start_day)
    end,
    case when c.pays_at_period_end
         then public.clamp_day(m.this_month, c.pay_day)
         else public.clamp_day(m.this_month, c.period_start_day) - 1
    end,
    public.clamp_day(m.this_month, c.pay_day)
  from c, m;
$function$;

comment on function public.payroll_period is
  'ช่วงเงินเดือนของรอบนั้นในเดือนที่ระบุ — วันที่เกินสิ้นเดือนถูกตัดมาที่วันสุดท้ายของเดือน';;
