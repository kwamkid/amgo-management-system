-- API ให้บอทแชท (Hermes Agent ใน Discord) อ่าน/จัดการงานของทีม (เจ้าของขอ 28 ต.ค. 69)
--   Jarvis  = scope 'superadmin' — เจ้าของคนเดียว ทำได้เท่าแอดมิน
--   Edith  = scope 'general'    — พนักงานทุกคน บอทต้องส่ง X-Discord-User-Id ของคนที่คุยด้วย
--             แล้ว API ใช้สิทธิ์ของคนนั้นตรง ๆ (ไม่ผูก Discord / ไม่พบ = 403)
-- แบบเดียวกับ seo_api_keys: เก็บแค่ sha256 · ตัวกุญแจโชว์ครั้งเดียวตอนสร้าง · เพิกถอนด้วย revoked_at
-- เรียกด้วย header  Authorization: Bearer amgo_bot_xxx  (หรือ x-api-key) → /api/bot/...
-- สร้างกุญแจ: node scripts/mint-bot-key.mjs (พิมพ์ SQL insert ให้ ไม่แตะ DB เอง)

create table public.bot_api_keys (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,                 -- เช่น "Jarvis (Hermes VPS)"
  key_prefix   text not null,                 -- 13 ตัวแรก ไว้จำว่าใบไหน
  key_hash     text not null unique,          -- sha256 hex ของกุญแจเต็ม
  scope        text not null check (scope in ('superadmin', 'general')),
  -- superadmin: งานที่บอทสร้าง/ปิด/เลื่อนวัน ลงชื่อคนนี้ (เจ้าของ) · general ไม่ใช้ (ใช้คนที่คุยด้วย)
  acts_as      uuid references public.users(id),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  check (scope = 'general' or acts_as is not null)
);

alter table public.bot_api_keys enable row level security;
create policy bot_api_keys_owner on public.bot_api_keys
  for select to authenticated using ((select public.is_web_owner()));

comment on table public.bot_api_keys is
  'กุญแจ API ของบอทแชท (Jarvis/Edith) → /api/bot/... · เก็บแค่ sha256';

-- ── เลื่อนวันครบกำหนดในนามคนที่คุยกับบอท ─────────────────────────────
-- API ใช้ service role (auth.uid() = null) → ประวัติเลื่อนวันใน task_updates จะไม่มีชื่อคน
-- และแก้ created_by ทีหลังไม่ได้ (trigger ล็อก) — จึงตั้ง sub ใน jwt claims ชั่วคราว
-- เฉพาะใน transaction นี้ ให้ trigger tasks_log_due_change เห็น auth.uid() = คนนั้น
-- (สิทธิ์ตรวจที่ API แล้ว · tasks_before_write ไม่ล็อก due_date ของผู้รับผิดชอบอยู่แล้ว)
create or replace function public.bot_set_task_due(p_task_id uuid, p_due date, p_reason text, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  prev text := current_setting('request.jwt.claims', true);
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
  update public.tasks
     set due_date = p_due,
         due_change_reason = coalesce(p_reason, '')
   where id = p_task_id;
  perform set_config('request.jwt.claims', coalesce(prev, ''), true);
end;
$$;

revoke execute on function public.bot_set_task_due(uuid, date, text, uuid) from anon, authenticated, public;
grant execute on function public.bot_set_task_due(uuid, date, text, uuid) to service_role;
