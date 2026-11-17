-- Voice → Tasks, Phase 1 (plan: project/jobs/plans/voice-tasks.md, owner decisions 2026-11-17)
-- A meeting recording (Plaud share link / upload) → ElevenLabs Scribe transcript → Claude task drafts
-- → owner reviews → accepted drafts become normal rows in public.tasks.
-- Phase 1: uploader and reviewer = admin only. Staff see only the tasks they are assigned (existing tasks RLS).
-- Audio lives in the private bucket voice-audio and is deleted after 90 days (transcripts stay).

create table public.voice_recordings (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references public.companies(id),
  title            text not null default '',
  recorded_at      timestamptz,
  duration_sec     integer,
  source           text not null check (source in ('plaud','upload','share','app')),
  external_id      text,                         -- Plaud data_file.id (dedupe)
  storage_path     text,                         -- object path in bucket voice-audio
  status           text not null default 'uploaded'
                   check (status in ('uploaded','transcribing','extracting','review','done','failed')),
  error            text,
  provider         text,                         -- 'elevenlabs'
  provider_job_id  text,                         -- Scribe transcription / request id
  uploaded_by      uuid references public.users(id) default auth.uid(),
  audio_deleted_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index voice_recordings_external on public.voice_recordings (source, external_id) where external_id is not null;
create index on public.voice_recordings (status, created_at desc);

create table public.voice_transcripts (
  recording_id uuid primary key references public.voice_recordings(id) on delete cascade,
  language     text,
  text         text not null default '',
  segments     jsonb not null default '[]'::jsonb,  -- [{speaker,start,end,text}]
  speaker_map  jsonb not null default '{}'::jsonb,  -- {"speaker_0": "<users.id>"}
  speaker_guesses jsonb not null default '{}'::jsonb, -- Claude: {"speaker_0": {"user_id": …, "reason": …}}
  raw          jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.voice_task_drafts (
  id                 uuid primary key default gen_random_uuid(),
  recording_id       uuid not null references public.voice_recordings(id) on delete cascade,
  sort_order         integer not null default 0,
  title              text not null check (length(trim(title)) > 0),
  notes              text not null default '',
  assignee_ids       uuid[] not null default '{}',
  assignee_raw       text,                       -- the words used in the meeting ("น้องแป้ง")
  due_date           date,
  brand              text,
  evidence_quote     text,
  evidence_start_sec numeric,
  confidence         numeric check (confidence between 0 and 1),
  status             text not null default 'pending' check (status in ('pending','accepted','rejected')),
  task_id            uuid references public.tasks(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index on public.voice_task_drafts (recording_id, sort_order);

-- tasks made from a recording keep a link back to it
alter table public.tasks
  add column if not exists source_kind text not null default 'manual'
    check (source_kind in ('manual','agd_sync','voice')),
  add column if not exists source_recording_id uuid references public.voice_recordings(id) on delete set null;

create trigger voice_recordings_updated_at before update on public.voice_recordings
  for each row execute function set_updated_at();
create trigger voice_transcripts_updated_at before update on public.voice_transcripts
  for each row execute function set_updated_at();
create trigger voice_task_drafts_updated_at before update on public.voice_task_drafts
  for each row execute function set_updated_at();

-- ── RLS: admin only (Phase 1). Server routes with the service role (webhook, cron) bypass RLS. ──
alter table public.voice_recordings  enable row level security;
alter table public.voice_transcripts enable row level security;
alter table public.voice_task_drafts enable row level security;

create policy voice_recordings_admin on public.voice_recordings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy voice_transcripts_admin on public.voice_transcripts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy voice_task_drafts_admin on public.voice_task_drafts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── Storage: private bucket, 50 MB per file (≈ 3 h of Plaud Ogg Opus), audio types only ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-audio', 'voice-audio', false, 52428800,
        array['audio/ogg','audio/opus','audio/mp4','audio/x-m4a','audio/m4a','audio/mpeg','audio/wav','audio/x-wav','audio/webm'])
on conflict (id) do update set public = false;

create policy "voice-audio admin read" on storage.objects for select to authenticated
  using (bucket_id = 'voice-audio' and public.is_admin());
create policy "voice-audio admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'voice-audio' and public.is_admin());
create policy "voice-audio admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'voice-audio' and public.is_admin());

comment on table public.voice_recordings is
  'Meeting recordings for Voice → Tasks (Plaud link / upload) · admin only · audio deleted after 90 days';
comment on table public.voice_task_drafts is
  'Claude-drafted tasks from a recording, waiting for the owner to accept (→ tasks) or reject';
