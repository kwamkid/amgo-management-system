-- ═══════════════════════════════════════════════════════════════════════
-- 🔴 วันลาบันทึกผิดไป 1 วัน ทั้ง 260 ใบ
--
-- leave_requests.start_date เป็น timestamptz ที่เก็บเที่ยงคืนตามเวลาไทย
--   2026-07-31 00:00 +07  →  เก็บเป็น  2026-07-30 17:00 UTC
--
-- expand_leave_days ใช้ start_date::date ซึ่งแปลงด้วย timezone ของ session
-- (UTC) จึงได้ 2026-07-30 — เร็วไป 1 วันทุกใบ
--
-- ผลที่ตามมา:
--   · กติกา "มาทำงานชนะใบลา" เทียบ leave_date กับ work_date คนละวัน
--   · รายงานการมาทำงานแสดงวันลาผิดวัน
--
-- เจอตอนเขียน scripts/test-leave-flow.mjs ทดสอบใบลาคร่อมปี
-- (ควรได้ 2/2 วัน แต่ได้ 3/1) เป็นบั๊กชนิดเดียวกับที่เจอในเส้นทางส่งของ
-- ═══════════════════════════════════════════════════════════════════════

create or replace function expand_leave_days(p_request_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r record;
  v_from date;
  v_to   date;
begin
  select id, user_id, start_date, end_date, status, leave_type
    into r from public.leave_requests where id = p_request_id;
  if not found then return; end if;

  if r.status <> 'approved' then
    delete from public.leave_days where leave_request_id = p_request_id;
    return;
  end if;

  -- ⚠️ ต้องแปลงเป็นเวลาไทยก่อนตัดเวลาทิ้ง ห้ามใช้ ::date เฉย ๆ
  v_from := (r.start_date at time zone 'Asia/Bangkok')::date;
  v_to   := (r.end_date   at time zone 'Asia/Bangkok')::date;

  delete from public.leave_days
   where leave_request_id = p_request_id
     and (leave_date < v_from or leave_date > v_to);

  perform public.seed_leave_quota(r.user_id, extract(year from v_from)::smallint);
  perform public.seed_leave_quota(r.user_id, extract(year from v_to)::smallint);

  insert into public.leave_days (leave_request_id, user_id, leave_date, counts_toward_quota,
                                 refunded_at, refund_reason)
  select r.id, r.user_id, d::date,
    not exists (select 1 from public.checkins c
                 where c.user_id = r.user_id and c.work_date = d::date),
    case when exists (select 1 from public.checkins c
                       where c.user_id = r.user_id and c.work_date = d::date)
         then now() end,
    case when exists (select 1 from public.checkins c
                       where c.user_id = r.user_id and c.work_date = d::date)
         then 'เช็คอินมาทำงานจริงในวันที่ลา — คืนโควต้าอัตโนมัติ' end
  from generate_series(v_from, v_to, interval '1 day') d
  where not exists (
    select 1 from public.leave_days x
      join public.leave_requests o on o.id = x.leave_request_id
     where x.user_id = r.user_id and x.leave_date = d::date
       and x.counts_toward_quota and x.leave_request_id <> r.id
       and o.status = 'approved')
  on conflict (leave_request_id, leave_date) do nothing;

  perform public.recalc_leave_quota(r.user_id, extract(year from v_from)::smallint, r.leave_type);
  perform public.recalc_leave_quota(r.user_id, extract(year from v_to)::smallint, r.leave_type);
end;
$$;

delete from leave_days;

do $$
declare v_id uuid;
begin
  for v_id in select id from public.leave_requests where status = 'approved' order by start_date
  loop perform public.expand_leave_days(v_id); end loop;
end $$;

do $$
declare r record;
begin
  for r in select user_id, year, leave_type from public.leave_quotas
  loop perform public.recalc_leave_quota(r.user_id, r.year, r.leave_type); end loop;
end $$;
