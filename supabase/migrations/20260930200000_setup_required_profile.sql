-- ข้อมูลที่พนักงานต้องกรอกเองก่อนใช้งาน (30 ก.ย. 69)
--
-- เจ้าของ: "ถ้าขาดข้อมูลอะไรให้เด้งที่เค้าเอง แล้วให้กรอกข้อมูลที่จำเป็นก่อนทำงาน
-- อย่างอื่น" · บังคับ: เลขบัญชี · เลขบัตรประชาชน + ที่อยู่ · เปิดแจ้งเตือน (มือถือ) ·
-- วันหยุดประจำ (กลุ่มทำงาน 6 วัน: PC · พนักงานขาย · โกดัง · ADAY FRESH)
-- หน้า /setup ถามตามรายการใน lib/todo/tasks.ts

-- ── 1) กรอกเองได้ครั้งแรก เปลี่ยนภายหลังต้องให้ HR ─────────────────────
-- เลขบัญชีรับเงินเดือนกับเลขบัตรประชาชน เปลี่ยนเองได้ตามใจ = เปิดช่องโกง
-- (ใครยืมเครื่องไปเปลี่ยนบัญชีรับเงินเดือนก็ได้) · ที่อยู่ย้ายบ้านได้ จึงไม่ล็อก
create or replace function public.trg_guard_user_self_edit()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if public.is_hr() then
    if old.role = 'admin' and public.auth_role() = 'hr'
       and old.id <> (select auth.uid()) then
      raise exception 'ฝ่ายบุคคลแก้ข้อมูลผู้ดูแลระบบไม่ได้';
    end if;
    return new;
  end if;

  if (select auth.uid()) is null then return new; end if;

  new.role                := old.role;
  new.company_id          := old.company_id;
  new.job_function_id     := old.job_function_id;
  new.employment_status   := old.employment_status;
  new.employment_type     := old.employment_type;
  new.start_date          := old.start_date;
  new.start_date_verified := old.start_date_verified;
  new.end_date            := old.end_date;
  new.probation_end_date  := old.probation_end_date;
  new.days_per_week       := old.days_per_week;
  new.payroll_cycle       := old.payroll_cycle;
  new.requires_checkin    := old.requires_checkin;
  new.wfh_eligible        := old.wfh_eligible;
  new.is_active           := old.is_active;
  new.needs_approval      := old.needs_approval;
  new.allow_checkin_outside_location := old.allow_checkin_outside_location;
  new.deleted_at          := old.deleted_at;

  new.is_system           := old.is_system;
  new.line_user_id        := old.line_user_id;
  new.home_lat            := old.home_lat;
  new.home_lng            := old.home_lng;
  new.home_radius         := old.home_radius;
  new.primary_location_id := old.primary_location_id;
  new.invite_link_id      := old.invite_link_id;
  new.invite_link_code    := old.invite_link_code;
  new.approved_at         := old.approved_at;
  new.approved_by         := old.approved_by;
  new.deleted_by          := old.deleted_by;
  new.deleted_by_name     := old.deleted_by_name;

  if length(trim(coalesce(old.bank_account_no, ''))) > 0 then
    new.bank_account_no := old.bank_account_no;
    new.bank_name       := old.bank_name;
  end if;
  if length(trim(coalesce(old.national_id, ''))) > 0 then
    new.national_id := old.national_id;
  end if;
  return new;
end;
$function$;

-- ── 2) วันหยุดประจำของกลุ่มทำงาน 6 วัน ─────────────────────────────────
create or replace function public.is_six_day_worker(p_user_id uuid)
returns boolean
language sql
stable
set search_path to ''
as $$
  select exists (
    select 1 from public.users u
    left join public.job_functions jf on jf.id = u.job_function_id
    left join public.companies c on c.id = u.company_id
    where u.id = p_user_id
      and (jf.code in ('shop', 'sales', 'warehouse', 'warehouse_lead', 'packer', 'driver', 'production')
           -- ADAY FRESH ทำ 6 วัน ยกเว้นสายออฟฟิศ (อุ้ย HR ทำ 5 วัน — เจ้าของ 30 ก.ย. 69)
           or (c.code = 'ADAY FRESH'
               and coalesce(jf.code, '') not in ('hr', 'office', 'manager', 'brand_manager')))
  );
$$;

-- วันหยุดของตารางประจำสัปดาห์ (ไม่นับสลับรายวัน) — ลำดับเดียวกับ expected_work_mode
create or replace function public.weekly_off_days(p_user_id uuid)
returns int
language sql
stable
set search_path to ''
as $$
  select count(*)::int
  from generate_series(0, 6) d(dow)
  join public.users u on u.id = p_user_id
  left join public.job_functions jf on jf.id = u.job_function_id
  where coalesce(
    (select uw.work_mode from public.user_work_schedules uw
      where uw.user_id = u.id and uw.day_of_week = d.dow),
    case when jf.schedule_type = 'fixed' then
      (select fd.work_mode from public.job_function_work_days fd
        where fd.job_function_id = jf.id and fd.day_of_week = d.dow) end,
    case when jf.schedule_type = 'rotating' then 'rotating' end,
    case when d.dow between 1 and 5 then 'onsite' else 'off' end
  ) = 'off';
$$;

-- พนักงานเลือกวันหยุดเองได้ครั้งเดียว (ตอนที่ยังไม่ชัด) — ตั้งแล้วเปลี่ยนต้องให้ HR
-- เขียนแบบเดียวกับหน้าตั้งตาราง (WorkScheduleCard): ตำแหน่งวันตายตัวบันทึกครบ 7 วัน ·
-- กะหมุนเวียน (PC) เก็บเฉพาะวันหยุด วันที่เหลือต้องเป็น 'rotating'
create or replace function public.set_my_day_off(p_dow int)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  st text;
  jf_id uuid;
begin
  if me is null then raise exception 'ยังไม่ได้เข้าสู่ระบบ'; end if;
  if p_dow not between 0 and 6 then raise exception 'วันไม่ถูกต้อง'; end if;
  if not public.is_six_day_worker(me) then raise exception 'ตำแหน่งนี้ไม่ต้องเลือกวันหยุดเอง'; end if;
  if public.weekly_off_days(me) = 1 then
    raise exception 'ตั้งวันหยุดประจำไว้แล้ว — ถ้าจะเปลี่ยนให้แจ้ง HR';
  end if;

  select jf.schedule_type, jf.id into st, jf_id
  from public.users u left join public.job_functions jf on jf.id = u.job_function_id
  where u.id = me;

  delete from public.user_work_schedules where user_id = me;

  if st = 'rotating' then
    insert into public.user_work_schedules (user_id, day_of_week, work_mode, note)
    values (me, p_dow, 'off', 'พนักงานเลือกวันหยุดเอง');
  else
    insert into public.user_work_schedules (user_id, day_of_week, work_mode, note)
    select me, d.dow,
      case when d.dow = p_dow then 'off'
           else coalesce(
             (select case when fd.work_mode in ('onsite', 'wfh') then fd.work_mode end
                from public.job_function_work_days fd
               where fd.job_function_id = jf_id and fd.day_of_week = d.dow),
             'onsite') end,
      case when d.dow = p_dow then 'พนักงานเลือกวันหยุดเอง' else 'วันทำงาน' end
    from generate_series(0, 6) d(dow);
  end if;
end;
$$;

revoke all on function public.set_my_day_off(int) from public, anon;
grant execute on function public.set_my_day_off(int) to authenticated;

-- ── 3) my_profile บอกสถานะที่หน้า /setup ต้องใช้ ─────────────────────────
create or replace function public.my_profile()
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $$
  select jsonb_build_object(
    'user', to_jsonb(u),
    'location_ids', coalesce(
      (select jsonb_agg(l.location_id) from public.user_allowed_locations l where l.user_id = u.id),
      '[]'::jsonb),
    'job_function', (
      select jsonb_build_object(
        'sees_delivery', jf.sees_delivery, 'code', jf.code, 'schedule_type', jf.schedule_type,
        'work_start_time', jf.work_start_time, 'work_end_time', jf.work_end_time)
      from public.job_functions jf where jf.id = u.job_function_id),
    'has_srp_access', u.role = 'admin'
      or exists (select 1 from public.srp_brand_access s where s.user_id = u.id),
    'has_web_access', exists (select 1 from public.web_owners w where w.user_id = u.id),
    -- /setup: เปิดแจ้งเตือนแล้วอย่างน้อย 1 เครื่อง · กลุ่มทำงาน 6 วันต้องมีวันหยุด 1 วัน
    'has_push', exists (select 1 from public.push_subscriptions p where p.user_id = u.id),
    'needs_day_off', public.is_six_day_worker(u.id) and public.weekly_off_days(u.id) <> 1
  )
  from public.users u
  where u.id = auth.uid();
$$;
