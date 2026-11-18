-- Meeting summary lives on the meeting (voice recording), never as a task on the board
-- (owner 2026-11-18: "สรุปประชุมหลังแฟร์" sat on the board as a doing task instead of being handed out).
-- Written by the extraction step (Claude) for new meetings; editable on /tasks/voice/[id].
alter table public.voice_recordings add column summary text;

comment on column public.voice_recordings.summary is
  'Thai meeting summary (plain text, one topic per paragraph) — from the extraction step or typed by an admin';
