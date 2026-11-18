# Plan — Voice → Tasks (meeting recorder that fills the amgo task board)

> Drafted 2026-11-17 from an owner chat (design first, build later in Claude Code).
> Status: **plan only, nothing built.** Third-party prices marked (verify) are from mid-2026 — recheck before building.

<!-- toc -->
**Contents** (14)
- Goal
- Key decisions (and why they differ from the first chat draft)
- Models / APIs
- Cost at owner's estimate — 5 meeting-hours / month (measured 2026-11-17)
- Cost estimate (20 meeting-hours / month)
- Architecture
- Database (new migration, RLS like `tasks`: admin sees all, member sees own)
- Extraction prompt contract
- Phases
- Owner decisions (2026-11-17)
- Plaud share link — verified 2026-11-17 (unofficial API, read from web.plaud.ai JS; may change)
- Blockers before coding
- STT bake-off — 2026-11-17 (file "AGD-ประชุมหลังแฟร์", 88 min, Plaud Ogg Opus)
- Resume point — 2026-11-17 (start Phase 1 in a fresh chat)
<!-- /toc -->

## Goal
Replace the Plaud subscription: record meetings / voice notes on iPhone → transcript (Thai+EN) → who said what →
AI drafts tasks (who · what · by when) → a human confirms → tasks land on the existing `/tasks` board →
timeline / Gantt / milestones per person and brand. Later: recognise voices by name (แป้ง, หมี่, ยิว …).

## Key decisions (and why they differ from the first chat draft)
1. **Build inside amgo-management-system, not a new app.** It already has `tasks` + `task_assignees` (multi-assignee),
   `users` (with `nickname`), `companies`, LINE/Discord login + push, Supabase, Next 16. Every staff member already uses it.
   The first draft said Next 14 + a fresh schema — drop that.
2. **Do not rely on a PWA for long recordings.** iOS Safari stops `MediaRecorder` when the screen locks or the app goes
   to background, so a 1-hour meeting recorded in a web page is lost. Inputs instead:
   - **Meetings:** iPhone Voice Memos (or the Plaud device the owner already has — recording on it is free) → iOS
     Share Sheet → an iOS Shortcut "ส่งเข้า amgo" that uploads the file to amgo. No app store, no new hardware.
   - **Short voice notes** (≤ 5 min, screen on, e.g. "มอบงานให้แป้ง…"): record button in `/tasks` (MediaRecorder is fine here).
   - **Upload** button on the web for any .m4a/.mp3/.wav.
   - Native app (Expo, reusing amgo-driver-app know-how) only if background recording becomes a must.
3. **Diarization ≠ voice recognition.** Providers return "speaker_0 / speaker_1", not names. Names come in stages:
   Phase 1 the reviewer taps a name per speaker (one tap each per meeting) + the LLM proposes names from context
   ("แป้งช่วย…", self-introductions); Phase 3 voiceprints auto-suggest.
4. **Voiceprints are sensitive personal data (biometric) under Thai PDPA s.26** → explicit written consent per person,
   revocable, stored separately, deletable. Use the `thai-pdpa` skill before Phase 3.
5. **Async pipeline, never a long Vercel request.** Audio goes straight to Supabase Storage via signed upload URL
   (avoids the ~4.5 MB Vercel body limit); transcription is an async provider job with a webhook.

## Models / APIs
| Step | Recommended | Alternative | Price (approx.) |
|---|---|---|---|
| Speech-to-text + diarization (Thai) | ElevenLabs Scribe (async + webhook, diarization, Thai) | OpenAI `gpt-4o-transcribe-diarize` (supports a few known-speaker reference clips) | ~$0.25–0.40 / audio hour (verify) |
| Task extraction | Claude `claude-opus-5-5`, effort `medium`, structured outputs (`output_config.format`) | `claude-sonnet-5-5` ($2/$10 per MTok) if cost matters | Opus 5.5 $4 in / $20 out per MTok → ~$0.25 per meeting hour |
| Speaker naming (Phase 3) | Speaker embeddings (pyannote/wespeaker on the Hermes VPS, or pyannoteAI API) + `pgvector` cosine match | — | VPS already paid / API (verify) |
| Gantt / timeline | SVAR React Gantt (MIT) or a hand-built CSS-grid timeline | frappe-gantt (MIT) — avoid dhtmlx (GPL/commercial) | free |

Rule: test Thai accuracy of both STT providers on 3 real meeting files before committing (names, brand names, numbers).

## Cost at owner's estimate — 5 meeting-hours / month (measured 2026-11-17)
- STT ElevenLabs: 80 credits/min measured → 24,000 credits/mo. Free 10k is not enough; **Starter $6/mo (30k credits ≈ 6.2 h)** fits.
- Claude extraction: 88-min transcript = 63,424 input tokens (count_tokens, Opus 5.5) → ~43k tokens/h → 5 h ≈ 230k in + ~25k out
  = **Opus ≈ $1.4/mo** · Sonnet ≈ $0.7/mo.
- Storage: ~15 MB/h × 5 h × 3 months kept ≈ 225 MB — inside the Supabase plan.
- **Total ≈ $7.5/mo (~260 THB)**. Owner's Ultra plan includes $200 API credits → Claude part is covered (check credit expiry
  in Console → Billing); real cash cost ≈ ElevenLabs Starter $6 only. Use Opus 5.5 (no need to save with Sonnet). Above ~6 h/mo → ElevenLabs Creator $22 (121k credits ≈ 25 h).

## Cost estimate (20 meeting-hours / month)
- STT ≈ $5–8 · Claude ≈ $5 (Opus 5.5) or ≈ $2.5 (Sonnet 5.5) · Storage: inside Supabase plan if audio is deleted after 90 days.
- **Total ≈ $8–13 / month (~300–450 THB)** vs Plaud Unlimited ~$20/month. The money saved is modest; the real gain is
  tasks flowing into amgo automatically with assignees and due dates.

## Architecture
```
iPhone Voice Memos / Plaud ──Share Sheet Shortcut──┐
/tasks record button (short notes) ────────────────┼─► POST /api/voice/upload-url  (signed URL, auth: user or Shortcut token)
Web upload ────────────────────────────────────────┘        │ file → Supabase Storage  bucket voice-audio (private)
                                                            ▼
                                POST /api/voice/recordings  (insert row, status=uploaded) → start STT job (cloud_storage_url = signed URL)
                                                            ▼
                         STT provider ──webhook──► POST /api/voice/webhook  (verify signature)
                                                            │ save transcript + segments, status=extracting
                                                            ▼
                         Claude extraction (meeting date, people roster w/ nicknames, brands, segments) → voice_task_drafts
                                                            │ status=review · push to the uploader (LINE/Discord)
                                                            ▼
                         /tasks/voice/[id]  review screen: map speakers → people, edit/accept/reject drafts
                                                            │ accept → insert tasks + task_assignees (source_kind='voice')
                                                            ▼
                         /tasks board · timeline/Gantt · per-person view · brief (daily_briefs picks up due tasks)
```

## Database (new migration, RLS like `tasks`: admin sees all, member sees own)
- `voice_recordings` — id, company_id, title, recorded_at, duration_sec, source ('share'|'app'|'upload'|'plaud'),
  storage_path, uploaded_by, status ('uploaded'|'transcribing'|'extracting'|'review'|'done'|'failed'), error,
  provider, provider_job_id, created_at, audio_deleted_at.
- `voice_transcripts` — recording_id (pk), language, text, segments jsonb `[{speaker,start,end,text}]`,
  speaker_map jsonb `{"speaker_0": "<user_id>"}`, raw jsonb.
- `voice_task_drafts` — id, recording_id, title, notes, assignee_ids uuid[], assignee_raw text (what was said),
  start_date, due_date, brand, priority, evidence_quote, evidence_start_sec, confidence, status ('pending'|'accepted'|'rejected'), task_id → tasks.
- Extend `tasks`: start_date date, priority text, milestone boolean default false, source_kind text default 'manual'
  ('manual'|'agd_sync'|'voice'), source_recording_id uuid. New `task_dependencies(task_id, depends_on_id)` for Gantt.
- Phase 3: `voice_profiles` — user_id, embedding vector(N), sample_path, consent_at, consent_version, revoked_at.
- Storage bucket `voice-audio` private; cron deletes audio older than 90 days (transcripts stay).

## Extraction prompt contract
Input: meeting date (Thai time, B.E. aware), roster `[{user_id, nickname, display_name, aliases}]`, brand list
(AGD folder names), segments with speaker labels. Output schema per task: title, assignee_user_ids, assignee_raw,
due_date (resolve "ศุกร์นี้", "สิ้นเดือน" against the meeting date; null if not said — never invent), brand, priority,
evidence_quote + start_sec, confidence. Also return `speaker_guesses: {speaker_0: user_id|null, reason}`.

## Phases
- **Phase 1 (MVP):** migration + bucket · upload URL + recordings API · Shortcut setup page · STT webhook ·
  transcript viewer with speaker→person mapping · Claude drafts · review/accept → tasks. Test with 3 real meetings.
- **Phase 2:** start_date/priority/milestone/dependencies · timeline + Gantt view filtered by person/brand/company ·
  in-app short voice note · push reminders before due date.
- **Phase 3:** PDPA consent flow → voice enrollment (30 s sample) → embeddings → auto speaker suggestion.

## Owner decisions (2026-11-17)
- Uploader and reviewer = the owner only (admin). No staff upload in Phase 1 → RLS: admin write; assignees see only their accepted tasks as today.
- Company: **AGD first** (roster = AGD staff, brands = AGD folder names).
- Input: both Plaud and iPhone; **Plaud is the main recorder** — owner wants to paste a **Plaud share link** into amgo.
  → Phase 1 adds "paste Plaud link" input: server fetches the share page and pulls the audio file. Must verify with one
  real share link first (format, whether audio is downloadable without login, link expiry). Fallback if not fetchable:
  export audio from the Plaud app → Share Sheet → Shortcut/upload.
- Audio retention: delete after 90 days is fine.

## Plaud share link — verified 2026-11-17 (unofficial API, read from web.plaud.ai JS; may change)
- Link form: `https://web.plaud.ai/s/<key>` (iframe → `/nshare3/<key>`), key = `pub_<uuid>::<token>`.
- `GET https://api.plaud.ai/share/access/<key>` → if `status:-302 "user region mismatch"`, retry on `data.domains.api`
  (owner's region = `https://api-apse1.plaud.ai`). No login needed. Returns `data_file.{id, filename, start_time (ms), duration (ms)}`,
  `is_audio`, `is_trans` (Plaud transcript present or not).
- `GET <region>/share/access/<key>/audio` → `{status:0, temp_url}` = presigned S3 URL, **expires in 1 h**.
- Audio = Ogg Opus, 16 kHz mono, ~15 MB per hour (sample: 88 min = 22.6 MB). ElevenLabs accepts it as-is.
- Flow: on paste → read meta (title, recorded_at = start_time, duration) → stream temp_url into Supabase Storage
  (keeps retries and the 90-day copy independent of Plaud) → start STT from our signed URL.
- Guard: dedupe on `data_file.id` (store as `voice_recordings.external_id`); if the API shape changes, fall back to file upload.

## Blockers before coding
- No AI keys in `.env.local` yet: need `ELEVENLABS_API_KEY` (STT) and `ANTHROPIC_API_KEY` (extraction); `OPENAI_API_KEY` optional for the Thai accuracy comparison.
- One sample Plaud share link.

## STT bake-off — 2026-11-17 (file "AGD-ประชุมหลังแฟร์", 88 min, Plaud Ogg Opus)
| | ElevenLabs `scribe_v3` | Gemini `gemini-3.8-flash` | Gemini `gemini-3-flash-preview` |
|---|---|---|---|
| Whole file in one call | yes, 131 s | **no** — 20-min chunk returned `promptFeedback.blockReason: OTHER`; 5-min chunk OK (40 s) | 20-min OK (98 s) |
| Thai word accuracy (first 40 s) | misheard แผ่นรองคลาน→"คาน", เพลยิม→"ตัวเอง" | best: คลาน ✓, ยิม ~ | คลาน ✓, เพลยิม ✓ |
| Timestamps | consistent | consistent | **wrong** (segment at 32:36 in a 20-min clip) + dropped text (2,166 vs ~3,500 chars per 5 min) |
| Speakers | 12 in 88 min (over-splits; 4 in first 20 min) | 3 per 5-min chunk; labels reset per chunk | 2 in 20 min (under-splits) |
| Cost | 7,066 credits / 88 min (~80 credits/min; free 10k/mo ≈ 2 h) | check AI Studio Spend after 24 h | — |
- `gemini-2.5-flash` is closed to new users (404) — use `gemini-3.8-flash`.
- Conclusion: ElevenLabs is the reliable backbone (one call, timestamps, diarization). Minor Thai mishears are tolerable for task
  extraction (Claude reads context). Gemini 3.8 needs ≤5-min chunks + cross-chunk speaker stitching — only worth it if cost forces it.
- Test script for Gemini lives in the session scratchpad (not in repo); prompt: verbatim Thai, speaker_N labels, start seconds, brand spellings.

## Resume point — 2026-11-17 (start Phase 1 in a fresh chat)
- Decided: STT = ElevenLabs `scribe_v3` (Starter plan once > 2 h/mo) · extraction = `claude-opus-5-5` (paid from Ultra API credits).
- Already in the working tree, **not committed**: `lib/voice/plaud.ts` (share link → meta + 1-h audio URL), `lib/voice/scribe.ts`
  (Scribe call + words→segments), `scripts/voice-test-plaud.ts`, this plan, `@elevenlabs/elevenlabs-js` in package.json/lock.
- `.env.local` has ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, GEMINI_API_KEY (never print it). Vercel env vars not added yet (owner).
- Next, in order: (1) migration `voice_recordings` / `voice_transcripts` / `voice_task_drafts` + `tasks` columns + private bucket
  `voice-audio` — show SQL to owner before applying to Supabase; (2) "paste Plaud link" API: resolve → copy audio into Storage →
  insert row (dedupe external_id) → start Scribe with webhook; (3) webhook → save segments → Claude extraction (structured output,
  roster = AGD staff nicknames, brands, meeting date) → drafts; (4) review page `/tasks/voice/[id]`: speaker→person, merge speakers,
  accept/reject → `tasks` + `task_assignees`; (5) 90-day audio cleanup cron. Test with the AGD meeting link (in owner's chat history).
