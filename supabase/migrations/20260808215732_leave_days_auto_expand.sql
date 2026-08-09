-- ═══════════════════════════════════════════════════════════════════════
-- ใบลาอนุมัติ → แตกเป็นวัน → หักโควต้า  (ให้ Postgres ทำเอง)
--
-- ปัญหาที่เจอตอนย้าย leaveService มา Supabase:
--   leave_days เป็นตัวตั้งของ used_days (มี trigger leave_days_recalc อยู่แล้ว)
--   แต่ "ไม่มีอะไรสร้าง leave_days" เลย — ข้อมูล 386 แถวที่มีอยู่มาจาก
--   สคริปต์ย้ายข้อมูลล้วน ๆ
--   → ถ้าอนุมัติใบลาใหม่วันนี้ โควต้าจะไม่ถูกหัก และไม่มีใครรู้
--   (ยืนยันแล้ว: อนุมัติแล้ว 260 ใบ · ไม่มี leave_days 3 ใบ)
--
-- ของเดิม Firestore ให้ leaveService.ts คอยบวก used/remaining เอง
-- ซึ่งพังได้ทุกทางที่ไม่ผ่านฟังก์ชันนั้น ตรงนี้ย้ายมาไว้ใน DB แทน
-- ═══════════════════════════════════════════════════════════════════════

-- ── แนบไฟล์ใบรับรองแพทย์ ───────────────────────────────────────────────
-- ของเดิมอัปโหลดไฟล์ขึ้น Firebase Storage แล้ว "ไม่เคยเก็บ URL ลงใบลา"
-- (useLeave.ts มีคอมเมนต์ค้างไว้ว่า "You'll need to add an updateLeaveRequest")
-- แปลว่าไฟล์ที่พนักงานแนบมาหายไปเฉย ๆ ทุกใบ
alter table leave_requests
  add column if not exists attachments text[] not null default '{}';

comment on column leave_requests.attachments is
  'path ใน bucket leave-attachments (ไม่ใช่ URL — signed URL หมดอายุ)';

-- ── แตกใบลาเป็นรายวัน ──────────────────────────────────────────────────
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

  -- ไม่ใช่สถานะอนุมัติ = ไม่กินโควต้า ลบวันทิ้งให้หมด
  if r.status <> 'approved' then
    delete from public.leave_days where leave_request_id = p_request_id;
    return;
  end if;

  -- แก้ช่วงวันที่ทีหลัง → วันที่หลุดออกนอกช่วงต้องหายไปด้วย
  delete from public.leave_days
   where leave_request_id = p_request_id
     and (leave_date < r.start_date::date or leave_date > r.end_date::date);

  -- ต้องมีแถวโควต้าก่อน ไม่งั้น recalc อัปเดตไม่โดนอะไรเลย
  perform public.seed_leave_quota(r.user_id, extract(year from r.start_date)::smallint);
  perform public.seed_leave_quota(r.user_id, extract(year from r.end_date)::smallint);

  insert into public.leave_days (leave_request_id, user_id, leave_date, counts_toward_quota,
                                 refunded_at, refund_reason)
  select
    r.id,
    r.user_id,
    d::date,
    -- กติกา "มาทำงานชนะใบลา" — ถ้าวันนั้นเช็คอินไปแล้ว ไม่ต้องหักโควต้า
    -- (trigger checkins_refund_leave ดักเฉพาะตอนเช็คอินทีหลัง
    --  เคสนี้คือลาย้อนหลังหรืออนุมัติช้า ต้องดักตรงนี้ด้วย)
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
  -- ลาซ้อนวันเดียวกันสองใบ: ใบแรกชนะ ใบหลังบันทึกไว้แต่ไม่หักซ้ำ
  -- (มี unique index leave_days_one_active_per_day กันอยู่แล้ว)
  where not exists (
    select 1 from public.leave_days x
     where x.user_id = r.user_id
       and x.leave_date = d::date
       and x.counts_toward_quota
       and x.leave_request_id <> r.id
  )
  on conflict (leave_request_id, leave_date) do nothing;

  -- ใบลาคร่อมปีใหม่ต้องคิดทั้งสองปี
  perform public.recalc_leave_quota(r.user_id, extract(year from r.start_date)::smallint, r.leave_type);
  perform public.recalc_leave_quota(r.user_id, extract(year from r.end_date)::smallint, r.leave_type);
end;
$$;

comment on function expand_leave_days is
  'ทำให้ leave_days ตรงกับใบลาเสมอ — เรียกซ้ำได้ ไม่สร้างซ้ำ';

-- ── ผูกกับ leave_requests ──────────────────────────────────────────────
create or replace function trg_sync_leave_days()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.expand_leave_days(new.id);

  -- เปลี่ยนตัวคูณลาด่วนบนใบที่อนุมัติแล้ว จำนวนวันเท่าเดิมแต่โควต้าเปลี่ยน
  -- (leave_days ไม่ขยับ trigger recalc จึงไม่ทำงาน ต้องสั่งเอง)
  if tg_op = 'UPDATE'
     and new.status = 'approved'
     and new.urgent_multiplier is distinct from old.urgent_multiplier then
    perform public.recalc_leave_quota(
      new.user_id, extract(year from new.start_date)::smallint, new.leave_type);
  end if;

  return null;
end;
$$;

create trigger leave_requests_sync_days
  after insert or update of status, start_date, end_date, urgent_multiplier, leave_type
  on leave_requests
  for each row execute function trg_sync_leave_days();

-- ── ตามเก็บใบที่อนุมัติแล้วแต่ยังไม่มีวัน ────────────────────────────────
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

-- ── ที่เก็บไฟล์แนบ ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('leave-attachments', 'leave-attachments', false, 10485760,
   array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

create policy "ใบลา: แนบไฟล์ของตัวเอง" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'leave-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

/* ใบรับรองแพทย์เป็นข้อมูลสุขภาพ — เปิดให้เฉพาะเจ้าตัวกับคนอนุมัติ */
create policy "ใบลา: ดูของตัวเองหรือคนอนุมัติ" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'leave-attachments'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_hr())
  );

create policy "ใบลา: ลบได้เฉพาะ HR" on storage.objects
  for delete to authenticated
  using (bucket_id = 'leave-attachments' and public.is_hr());
