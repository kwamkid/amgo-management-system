-- ═══════════════════════════════════════════════════════════════════════
-- โควตาลาคำนวณเองจาก leave_days — เลิกให้โค้ดคอยบวกลบเอง
-- (ของเดิม leaveService.ts 849 บรรทัดคอยคุม used/remaining ให้ตรงกัน)
-- ═══════════════════════════════════════════════════════════════════════

create or replace function recalc_leave_quota(p_user_id uuid, p_year smallint, p_leave_type text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.leave_quotas q
  set used_days = coalesce((
        select sum(lr.urgent_multiplier)
        from public.leave_days ld
        join public.leave_requests lr on lr.id = ld.leave_request_id
        where ld.user_id = p_user_id
          and extract(year from ld.leave_date) = p_year
          and lr.leave_type = p_leave_type
          and lr.status = 'approved'
          and ld.counts_toward_quota
      ), 0),
      updated_at = now()
  where q.user_id = p_user_id and q.year = p_year and q.leave_type = p_leave_type;
end;
$$;

-- leave_days เปลี่ยนเมื่อไหร่ recalc ทันที
create or replace function trg_recalc_quota()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row record;
  v_type text;
begin
  v_row := coalesce(new, old);
  select lr.leave_type into v_type
    from public.leave_requests lr where lr.id = v_row.leave_request_id;
  perform public.recalc_leave_quota(
    v_row.user_id,
    extract(year from v_row.leave_date)::smallint,
    v_type
  );
  return null;
end;
$$;

create trigger leave_days_recalc
  after insert or update or delete on leave_days
  for each row execute function trg_recalc_quota();

-- ── กติกา "มาทำงานชนะใบลา คืนโควต้าให้" — ทำอัตโนมัติตอนเช็คอิน ─────────
create or replace function trg_refund_leave_on_checkin()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.leave_days ld
  set counts_toward_quota = false,
      refunded_at   = now(),
      refund_reason = 'เช็คอินมาทำงานจริงในวันที่ลา — คืนโควต้าอัตโนมัติ'
  where ld.user_id = new.user_id
    and ld.leave_date = new.work_date
    and ld.counts_toward_quota;
  return null;
end;
$$;

create trigger checkins_refund_leave
  after insert on checkins
  for each row execute function trg_refund_leave_on_checkin();

comment on function trg_refund_leave_on_checkin is
  'ข้อมูลจริง 56% ของวันลาอนุมัติมี checkin ด้วย — กติกาคือมาทำงานชนะ แล้วคืนวันลาให้';
