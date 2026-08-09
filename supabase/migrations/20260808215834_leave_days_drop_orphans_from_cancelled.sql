-- ═══════════════════════════════════════════════════════════════════════
-- ล้าง leave_days ที่ค้างจากใบลาที่ไม่ได้อนุมัติ
--
-- สคริปต์ย้ายข้อมูลสร้าง leave_days ให้ใบลาทุกใบ รวมใบที่ถูกยกเลิก/ปฏิเสธด้วย
-- ผลคือวันนั้นถูกจองค้างไว้ ใบใหม่ของวันเดียวกันเข้าไม่ได้
-- (เคสจริง: winko ยกเลิกลาป่วย 1 พ.ค. แล้วยื่นลากิจวันเดียวกันหลังจากนั้น
--  44 วินาที → ใบลากิจอนุมัติแล้วแต่ไม่เคยถูกหักโควต้า)
--
-- ลบไป 40 แถว จาก 386 → 346
-- ═══════════════════════════════════════════════════════════════════════

delete from leave_days ld
using leave_requests lr
where lr.id = ld.leave_request_id
  and lr.status <> 'approved';

-- กันไม่ให้ตีความผิดอีก: "วันนี้มีคนจองแล้ว" ต้องหมายถึงใบที่อนุมัติเท่านั้น
create or replace function expand_leave_days(p_request_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r record;
begin
  select id, user_id, start_date, end_date, status, leave_type
    into r
    from public.leave_requests
   where id = p_request_id;

  if not found then return; end if;

  if r.status <> 'approved' then
    delete from public.leave_days where leave_request_id = p_request_id;
    return;
  end if;

  delete from public.leave_days
   where leave_request_id = p_request_id
     and (leave_date < r.start_date::date or leave_date > r.end_date::date);

  perform public.seed_leave_quota(r.user_id, extract(year from r.start_date)::smallint);
  perform public.seed_leave_quota(r.user_id, extract(year from r.end_date)::smallint);

  insert into public.leave_days (leave_request_id, user_id, leave_date, counts_toward_quota,
                                 refunded_at, refund_reason)
  select
    r.id,
    r.user_id,
    d::date,
    not exists (
      select 1 from public.checkins c
       where c.user_id = r.user_id and c.work_date = d::date
    ),
    case when exists (
      select 1 from public.checkins c
       where c.user_id = r.user_id and c.work_date = d::date
    ) then now() end,
    case when exists (
      select 1 from public.checkins c
       where c.user_id = r.user_id and c.work_date = d::date
    ) then 'เช็คอินมาทำงานจริงในวันที่ลา — คืนโควต้าอัตโนมัติ' end
  from generate_series(r.start_date::date, r.end_date::date, interval '1 day') d
  where not exists (
    select 1
      from public.leave_days x
      join public.leave_requests o on o.id = x.leave_request_id
     where x.user_id = r.user_id
       and x.leave_date = d::date
       and x.counts_toward_quota
       and x.leave_request_id <> r.id
       and o.status = 'approved'
  )
  on conflict (leave_request_id, leave_date) do nothing;

  perform public.recalc_leave_quota(r.user_id, extract(year from r.start_date)::smallint, r.leave_type);
  perform public.recalc_leave_quota(r.user_id, extract(year from r.end_date)::smallint, r.leave_type);
end;
$$;

do $$
declare v_id uuid;
begin
  for v_id in
    select lr.id from public.leave_requests lr
     where lr.status = 'approved'
       and not exists (select 1 from public.leave_days ld where ld.leave_request_id = lr.id)
  loop
    perform public.expand_leave_days(v_id);
  end loop;
end $$;
