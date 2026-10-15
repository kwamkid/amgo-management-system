-- แอปส่งตำแหน่งเข้า Supabase ตรง (RPC) ไม่ผ่าน Vercel — Hobby มี Active CPU 4 ชม./เดือน
-- 10 คัน × ทุก 15–30 วิ ผ่าน API route จะกินโควตาหมด (.claude/rules/queue.md)
--
-- record_driver_locations(points) — คนขับบันทึกได้แค่ของตัวเอง (auth.uid()) · ส่งเป็นชุด (ออฟไลน์แล้วส่งตามได้)
-- points = [{ t: epoch ms, lat, lng, acc?, spd?, hdg?, bat? }]
-- กรองทิ้ง: พิกัดเพี้ยน · เก่ากว่า 3 วัน · อนาคตเกิน 5 นาที (นาฬิกาเครื่องเพี้ยน) · แม่นยำแย่กว่า 200 ม.

create or replace function public.record_driver_locations(points jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if jsonb_typeof(points) <> 'array' or jsonb_array_length(points) > 500 then
    raise exception 'points must be an array of at most 500';
  end if;

  with p as (
    select
      to_timestamp((x->>'t')::double precision / 1000) as t,
      (x->>'lat')::double precision as lat,
      (x->>'lng')::double precision as lng,
      (x->>'acc')::real as acc,
      (x->>'spd')::real as spd,
      (x->>'hdg')::real as hdg,
      -- greatest(0, null) = 0 ใน Postgres → ต้องเช็ค null เอง ไม่งั้นไม่มีค่าแบตกลายเป็น 0%
      case when x->>'bat' is null then null else least(100, greatest(0, round((x->>'bat')::numeric)))::smallint end as bat
    from jsonb_array_elements(points) x
    where x ? 't' and x ? 'lat' and x ? 'lng'
  ), ok as (
    select * from p
    where abs(lat) <= 90 and abs(lng) <= 180 and not (lat = 0 and lng = 0)
      and t between now() - interval '3 days' and now() + interval '5 minutes'
      and (acc is null or acc <= 200)
  ), ins as (
    insert into public.driver_locations (driver_id, recorded_at, lat, lng, accuracy, speed, heading, battery)
    select uid, t, lat, lng, acc, spd, hdg, bat from ok
    returning recorded_at, lat, lng, accuracy, speed, heading, battery
  ), latest as (
    select * from ins order by recorded_at desc limit 1
  ), live as (
    -- จุดล่าสุด → driver_live (ส่งตามทีหลังแล้วเก่ากว่าที่มี = ไม่ทับ) · trigger broadcast เข้าแผนที่สด
    insert into public.driver_live (driver_id, driver_name, lat, lng, accuracy, speed, heading, battery, recorded_at, updated_at)
    select uid, coalesce(nullif(u.display_name, ''), u.full_name, ''), l.lat, l.lng, l.accuracy, l.speed, l.heading, l.battery, l.recorded_at, now()
    from latest l, public.users u where u.id = uid
    on conflict (driver_id) do update set
      driver_name = excluded.driver_name, lat = excluded.lat, lng = excluded.lng, accuracy = excluded.accuracy,
      speed = excluded.speed, heading = excluded.heading, battery = excluded.battery,
      recorded_at = excluded.recorded_at, updated_at = now()
    where public.driver_live.recorded_at < excluded.recorded_at
    returning 1
  )
  select count(*) into n from ins;
  return n;
end $$;

revoke execute on function public.record_driver_locations(jsonb) from public, anon;
grant execute on function public.record_driver_locations(jsonb) to authenticated;
