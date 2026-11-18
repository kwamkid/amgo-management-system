# 🎙 Voice → Tasks — Phase 1 — 2026-11-17

> Plan: [voice-tasks.md](../plans/voice-tasks.md) (decisions, Plaud API, STT bake-off). This file = open items only.

<!-- toc -->
**Contents** (1)
- Resume note
<!-- /toc -->

- [x] (1) Migration `20261117090000_voice_tasks.sql` — owner ran it in SQL editor 2026-11-17, verified via REST (3 tables, tasks cols, bucket) · commit 189a406
- Decided 2026-11-17: Scribe async needs a webhook set up in the ElevenLabs dashboard (400 `no_webhooks_configured`). Owner chose central queue + webhook (queue rule) over one long request; extraction = Claude Message Batch.
- Owner 2026-11-17: inputs must be several, not only Plaud — Plaud link · web upload (iPhone Voice Memos .m4a) · iPhone Share-Sheet Shortcut.
- [x] (2)–(5) Built on the queue (lib/voice/pipeline.ts, kinds voice.plaud.import / transcribe.start / transcribe.poll / extract.start / extract.poll / cleanup), webhook `/api/voice/webhook`, pages `/tasks/voice` + `/tasks/voice/[id]`, accept → tasks (source_kind voice), cron `/api/cron/voice-cleanup` · tsc green · commit see below
- [x] Pushed 2026-11-17 (6cbc271..5ab9832)
- [x] Vercel env ANTHROPIC_API_KEY / ELEVENLABS_API_KEY / ELEVENLABS_WEBHOOK_SECRET set by owner 2026-11-18
- [x] ElevenLabs webhook created by owner 2026-11-18 (test event 200): URL `https://app.amgovenger.com/api/voice/webhook`, auth HMAC, event "Transcription completed"; copy signing secret to `ELEVENLABS_WEBHOOK_SECRET`
- [x] Daily voice cleanup piggybacks on the existing /api/cron/cleanup-photos cron (owner 2026-11-17: no new cron); /api/cron/voice-cleanup = manual trigger only
- [x] Plaud import works on prod after region fix 5b12f44 (2026-11-18); webhook test event 200 · signature OK · payload shape matches
- [ ] รอคุณแอม: ElevenLabs credits — the 88-min AGD clip needs 7,066 credits, 2,934 left of 10,000 (recording 537719fa failed, Thai message db400e0). Top up, then press ลองใหม่
- [x] First real run 2026-11-18 with a 51 s synthetic Thai clip (macOS `say -v Kanya`, recording 542682fe "ทดสอบ-ประชุมสั้น", left in review — not accepted): webhook → extracting in <1 min, batch picked up by the 10-min cron, 4/4 drafts correct (people, brands, Thai relative dates).
- [x] Fixed 9bd74ed: upload failed with 415 when the browser reports `application/octet-stream` (supabase-js sends the File's own type) — page now re-wraps the File.
- [x] Fixed fa46282: evidence second was 0 for every draft (one segment per speaker turn) — turns now split at 30 s / 0.6 s pause after a spacing token.
- [ ] Still unverified: `transcripts.get` "not ready" codes (webhook won the race; poll job 1798 was still queued → should end as skip) · 88-min AGD clip after credits.
- [ ] iPhone Share-Sheet Shortcut "ส่งเข้า amgo": needs a token the Shortcut can hold (new bot key scope `voice`, migration on `bot_api_keys_scope_check`) → upload-url endpoint → PUT file to Storage → start
- [ ] Sidebar menu entry for `/tasks/voice` (skipped: components/layout/Sidebar.tsx has another chat's uncommitted edits) — for now reached via the "จากเสียงประชุม" button on /tasks
- [ ] Repo ESLint config crashes ("Converting circular structure to JSON" in FlatCompat, eslint.config.mjs) — pre-existing, not caused by this work
- [ ] Not pushed: 936d08f (person-strip badge fix, /tasks) · db400e0 (Thai ElevenLabs credit message) — needs `/push`

## Resume note
Resume at: owner tops up ElevenLabs credits → on /tasks/voice press ลองใหม่ on "AGD-ประชุมหลังแฟร์" (recording 537719fa…) → watch queue_jobs + voice_recordings status through transcribing → extracting → review; verify poll codes and draft quality.
### State
All code committed; typecheck green. Plaud import + webhook verified on prod. `.env.local` has ELEVENLABS_WEBHOOK_SECRET (local only).
### Gotchas
Extraction is a Claude Message Batch woken by the 10-min queue cron → drafts can lag ~10 min. Short test clip alternative: Voice Memos upload (~35 min fits remaining credits).
### Read first
project/jobs/plans/voice-tasks.md · lib/voice/pipeline.ts
