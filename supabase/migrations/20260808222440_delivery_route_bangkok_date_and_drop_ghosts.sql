-- ═══════════════════════════════════════════════════════════════════════
-- 1) วันของเส้นทางต้องคิดตามเวลาไทย ไม่ใช่ UTC
--    ::date เฉย ๆ ใช้ timezone ของ session (UTC) → ของที่ส่งก่อน 07:00 น.
--    จะถูกนับเป็นของเมื่อวาน  ตอนนี้เจอแล้ว 1 รายการ และจะเพิ่มเรื่อย ๆ
--
-- 2) ลบเส้นทางที่ไม่มีจุดส่งรองรับ
--    ของเดิมนับ totalPoints ด้วยการอ่าน-บวก-เขียนในโค้ด ทำให้ตัวเลขเพี้ยน
--    เหลือเส้นทางค้าง 121 เส้น อ้างว่ามีจุดส่ง 966 จุดที่ไม่มีอยู่จริง
--    (ของจริง 3,479 จุด แต่ผลรวมในเส้นทางบอก 4,445)
-- ═══════════════════════════════════════════════════════════════════════

create or replace function recalc_delivery_route(p_driver_id uuid, p_date date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total int; v_done int; v_fail int;
  v_first timestamptz; v_last timestamptz;
begin
  select count(*),
         count(*) filter (where delivery_status = 'completed'),
         count(*) filter (where delivery_status = 'failed'),
         min(check_in_time),
         max(check_in_time)
    into v_total, v_done, v_fail, v_first, v_last
    from public.delivery_points
   where driver_id = p_driver_id
     and (check_in_time at time zone 'Asia/Bangkok')::date = p_date;

  if v_total = 0 then
    delete from public.delivery_routes
     where driver_id = p_driver_id and route_date = p_date;
    return;
  end if;

  insert into public.delivery_routes (
    driver_id, driver_name, route_date, status,
    start_time, end_time, total_points, completed_points, failed_points
  )
  select p_driver_id,
         coalesce((select u.full_name from public.users u where u.id = p_driver_id), ''),
         p_date,
         case when v_done + v_fail >= v_total then 'completed' else 'in-progress' end,
         v_first, v_last, v_total, v_done, v_fail
  on conflict (driver_id, route_date) do update
    set status           = excluded.status,
        start_time       = excluded.start_time,
        end_time         = excluded.end_time,
        total_points     = excluded.total_points,
        completed_points = excluded.completed_points,
        failed_points    = excluded.failed_points,
        updated_at       = now();
end;
$$;

create or replace function trg_recalc_delivery_route()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare r record;
begin
  r := coalesce(new, old);
  perform public.recalc_delivery_route(
    r.driver_id, (r.check_in_time at time zone 'Asia/Bangkok')::date);

  if tg_op = 'UPDATE'
     and (old.driver_id is distinct from new.driver_id
          or (old.check_in_time at time zone 'Asia/Bangkok')::date
             is distinct from (new.check_in_time at time zone 'Asia/Bangkok')::date) then
    perform public.recalc_delivery_route(
      old.driver_id, (old.check_in_time at time zone 'Asia/Bangkok')::date);
  end if;

  return null;
end;
$$;

delete from delivery_routes r
where not exists (
  select 1 from delivery_points p
   where p.driver_id = r.driver_id
     and (p.check_in_time at time zone 'Asia/Bangkok')::date = r.route_date
);

do $$
declare r record;
begin
  for r in
    select distinct driver_id, (check_in_time at time zone 'Asia/Bangkok')::date as d
      from public.delivery_points
  loop
    perform public.recalc_delivery_route(r.driver_id, r.d);
  end loop;
end $$;
