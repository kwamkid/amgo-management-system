-- ═══════════════════════════════════════════════════════════════════════
-- ส่งของ — เติมคอลัมน์ที่ตกไปตอนย้าย + ทำสรุปเส้นทางให้ฐานข้อมูลคิดเอง
--
-- ⚠️ ฟังก์ชันในไฟล์นี้ถูกเขียนทับในไฟล์ถัดไป (แก้เรื่อง timezone)
--    เก็บไว้ตามลำดับจริงที่รันไป
-- ═══════════════════════════════════════════════════════════════════════

alter table delivery_points
  add column if not exists failure_reason text,
  add column if not exists customer_signature text;

alter table delivery_routes
  add column if not exists end_time timestamptz,
  add column if not exists total_distance numeric(8,2),
  add column if not exists total_duration integer;

-- คนขับ 1 คนมีเส้นทางได้วันละเส้นเดียว
create unique index if not exists delivery_routes_one_per_driver_per_day
  on delivery_routes (driver_id, route_date);

-- ── ตัวเลขสรุปในเส้นทางคิดจากจุดส่งจริง ────────────────────────────────
-- ของเดิมโค้ดคอยบวก totalPoints เอง (อ่าน-บวก-เขียน) สองจุดที่สร้างพร้อมกัน
-- นับหายไปหนึ่ง และ completedPoints/failedPoints ไม่เคยถูกอัปเดตเลยสักครั้ง
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
     and check_in_time::date = p_date;

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
  perform public.recalc_delivery_route(r.driver_id, r.check_in_time::date);

  if tg_op = 'UPDATE'
     and (old.driver_id is distinct from new.driver_id
          or old.check_in_time::date is distinct from new.check_in_time::date) then
    perform public.recalc_delivery_route(old.driver_id, old.check_in_time::date);
  end if;

  return null;
end;
$$;

drop trigger if exists delivery_points_recalc_route on delivery_points;
create trigger delivery_points_recalc_route
  after insert or update or delete on delivery_points
  for each row execute function trg_recalc_delivery_route();

do $$
declare r record;
begin
  for r in select distinct driver_id, check_in_time::date as d from public.delivery_points
  loop
    perform public.recalc_delivery_route(r.driver_id, r.d);
  end loop;
end $$;
