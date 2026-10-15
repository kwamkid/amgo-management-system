-- ตำแหน่งคนขับแบบ realtime (เจ้าของเลือกทาง A 15 ต.ค. 69: เครื่อง Android ประจำรถเครื่องเดียว
-- รันแอป amgo ที่ห่อด้วย Capacitor — ถ่ายรูปส่งของ + ส่งตำแหน่งตลอดกะแม้จอดับ)
--
-- แอปส่งตำแหน่งเป็นชุด → POST /api/delivery/track (service role เขียน · ไม่เปิดให้เบราว์เซอร์เขียนตรง)
--   driver_locations  ทุกจุด (ไว้ย้อนดูเส้นทาง) · เก็บ 30 วัน
--   driver_live       จุดล่าสุดต่อคน (แผนที่สด) · เปลี่ยนเมื่อไหร่ broadcast เข้า channel 'delivery:live'
-- realtime ใช้ Broadcast จาก trigger ตาม aoo-techstack/realtime (ห้าม postgres_changes)
--
-- ขนาด: 10 คัน × 8 ชม. × ~240 จุด/ชม. (15 วิ ตอนวิ่ง) ≈ 20k แถว/วัน ≈ 600k แถว/30 วัน (~60–80 MB)

create table public.driver_locations (
  id          bigint generated always as identity primary key,
  driver_id   uuid not null references public.users(id) on delete cascade,
  recorded_at timestamptz not null,           -- เวลาที่เครื่องจับได้ (ไม่ใช่เวลาที่ส่งถึง — ไม่มีสัญญาณแล้วส่งตามทีหลังได้)
  lat         double precision not null,
  lng         double precision not null,
  accuracy    real,                           -- เมตร
  speed       real,                           -- เมตร/วินาที
  heading     real,                           -- องศา
  battery     smallint,                       -- %
  received_at timestamptz not null default now()
);
create index driver_locations_driver_time on public.driver_locations (driver_id, recorded_at desc);
create index driver_locations_time on public.driver_locations (recorded_at);

create table public.driver_live (
  driver_id   uuid primary key references public.users(id) on delete cascade,
  driver_name text not null default '',
  lat         double precision not null,
  lng         double precision not null,
  accuracy    real,
  speed       real,
  heading     real,
  battery     smallint,
  recorded_at timestamptz not null,
  updated_at  timestamptz not null default now()
);

-- ตำแหน่งคน = ข้อมูลส่วนตัว: HR/แอดมินดูได้ทุกคน · คนขับดูของตัวเอง · เขียนผ่าน API เท่านั้น
alter table public.driver_locations enable row level security;
alter table public.driver_live enable row level security;
create policy driver_locations_read on public.driver_locations
  for select to authenticated using ((select public.is_hr()) or driver_id = (select auth.uid()));
create policy driver_live_read on public.driver_live
  for select to authenticated using ((select public.is_hr()) or driver_id = (select auth.uid()));

-- Broadcast จุดล่าสุด → 'delivery:live' (private) · payload เล็ก ไม่ต้อง query ซ้ำ
create or replace function public.broadcast_driver_live()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object(
        'driver_id', new.driver_id, 'driver_name', new.driver_name,
        'lat', new.lat, 'lng', new.lng, 'accuracy', new.accuracy,
        'speed', new.speed, 'heading', new.heading, 'battery', new.battery,
        'recorded_at', new.recorded_at),
      'location',
      'delivery:live',
      true);
  exception when others then
    raise warning 'broadcast_driver_live failed: %', sqlerrm; -- realtime พังห้ามทำให้การบันทึกตำแหน่งล้ม
  end;
  return null;
end $$;

create trigger driver_live_broadcast after insert or update on public.driver_live
  for each row execute function public.broadcast_driver_live();

-- ใครฟัง channel ได้: HR/แอดมินเท่านั้น
create policy delivery_live_listen on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'delivery:live' and (select public.is_hr()));

-- ล้างจุดเก่ากว่า 30 วัน (เรียกจากงาน queue.prune รายวัน) · ทีละก้อนกันค้าง
create or replace function public.prune_driver_locations(keep_days int default 30)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.driver_locations
  where id in (
    select id from public.driver_locations
    where recorded_at < now() - make_interval(days => keep_days)
    limit 50000);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.prune_driver_locations(int) from public, anon, authenticated;
