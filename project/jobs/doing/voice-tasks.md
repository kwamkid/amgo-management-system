# 🎙 Voice → Tasks — Phase 1 — 2026-11-17

> Plan: [voice-tasks.md](../plans/voice-tasks.md) (decisions, Plaud API, STT bake-off). This file = open items only.

- [x] (1) Migration `20261117090000_voice_tasks.sql` — owner ran it in SQL editor 2026-11-17, verified via REST (3 tables, tasks cols, bucket) · commit 189a406
- Decided 2026-11-17: Scribe async needs a webhook set up in the ElevenLabs dashboard (400 `no_webhooks_configured`). Owner chose central queue + webhook (queue rule) over one long request; extraction = Claude Message Batch.
- Owner 2026-11-17: inputs must be several, not only Plaud — Plaud link · web upload (iPhone Voice Memos .m4a) · iPhone Share-Sheet Shortcut.
- [x] (2)–(5) Built on the queue (lib/voice/pipeline.ts, kinds voice.plaud.import / transcribe.start / transcribe.poll / extract.start / extract.poll / cleanup), webhook `/api/voice/webhook`, pages `/tasks/voice` + `/tasks/voice/[id]`, accept → tasks (source_kind voice), cron `/api/cron/voice-cleanup` · tsc green · commit see below
- [x] Pushed 2026-11-17 (6cbc271..5ab9832)
- [ ] รอคุณแอม: Vercel env `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_WEBHOOK_SECRET` → redeploy
- [ ] รอคุณแอม: ElevenLabs dashboard → Developers → Webhooks → Create: URL `https://app.amgovenger.com/api/voice/webhook`, auth HMAC, event "Transcription completed"; copy signing secret to `ELEVENLABS_WEBHOOK_SECRET`
- [x] Daily voice cleanup piggybacks on the existing /api/cron/cleanup-photos cron (owner 2026-11-17: no new cron); /api/cron/voice-cleanup = manual trigger only
- [x] Plaud import works on prod after region fix 5b12f44 (2026-11-18); webhook test event 200 · signature OK · payload shape matches
- [ ] รอคุณแอม: ElevenLabs credits — the 88-min AGD clip needs 7,066 credits, 2,934 left of 10,000 (recording 537719fa failed, Thai message db400e0). Top up, then press ลองใหม่
- [ ] First real transcription run (after credits): check webhook payload shape, `transcripts.get` "not ready" codes (guessed 404/409/425), batch result, drafts quality
- [ ] iPhone Share-Sheet Shortcut "ส่งเข้า amgo": needs a token the Shortcut can hold (new bot key scope `voice`, migration on `bot_api_keys_scope_check`) → upload-url endpoint → PUT file to Storage → start
- [ ] Sidebar menu entry for `/tasks/voice` (skipped: components/layout/Sidebar.tsx has another chat's uncommitted edits) — for now reached via the "จากเสียงประชุม" button on /tasks
- [ ] Repo ESLint config crashes ("Converting circular structure to JSON" in FlatCompat, eslint.config.mjs) — pre-existing, not caused by this work
