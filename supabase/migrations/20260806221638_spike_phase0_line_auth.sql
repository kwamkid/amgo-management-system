-- SPIKE Phase 0 — ของทดลอง ลบทิ้งได้ทั้งหมดหลัง spike จบ
-- พิสูจน์ว่า: LINE userId -> Supabase session -> RLS ทำงานจริง

create table if not exists spike_users (
  id            uuid primary key references auth.users(id) on delete cascade,
  line_user_id  text not null unique,
  display_name  text,
  role          text not null default 'employee',
  created_at    timestamptz not null default now()
);

alter table spike_users enable row level security;

-- ด่านที่ 1: เห็นได้เฉพาะแถวของตัวเอง (พิสูจน์ว่า auth.uid() มีค่าจริงจาก session)
create policy spike_select_own on spike_users
  for select to authenticated
  using (auth.uid() = id);

-- ตารางลับ: ไม่มี policy เลย = ต้องอ่านไม่ได้ (พิสูจน์ว่า RLS บล็อกจริง ไม่ใช่เปิดหมด)
create table if not exists spike_secrets (
  id     int primary key,
  secret text not null
);

alter table spike_secrets enable row level security;

insert into spike_secrets (id, secret)
values (1, 'ถ้าเห็นข้อความนี้จาก client แปลว่า RLS ไม่ทำงาน')
on conflict (id) do nothing;
