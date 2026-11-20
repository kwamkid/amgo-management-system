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
- [x] AGD 88-min clip no longer needs re-transcribing (2026-11-18, af89dab): owner said a meeting summary must not sit on the board as a task → old task #23 (summary + transcript pasted from Plaud) moved onto recording 537719fa (summary + 853 segments, status done), #24–#43 linked via source_recording_id, #23 deleted (backup memo/backup-task23-20261118.json). Credits only needed for future long clips.
- [x] Meeting page: `summary` (AI-written, editable) + "งานที่แจกแล้ว" grouped per person. Per-draft person picker + รับทั้งหมด already existed (owner asked 18 Nov).
- [x] First real run 2026-11-18 with a 51 s synthetic Thai clip (macOS `say -v Kanya`, recording 542682fe "ทดสอบ-ประชุมสั้น", left in review — not accepted): webhook → extracting in <1 min, batch picked up by the 10-min cron, 4/4 drafts correct (people, brands, Thai relative dates).
- [x] Fixed 9bd74ed: upload failed with 415 when the browser reports `application/octet-stream` (supabase-js sends the File's own type) — page now re-wraps the File.
- [x] Meeting page UX pushed 2026-11-19 (9176431..b115029): 2 playable ~10 s samples per speaker · 20 flat animal avatars (public/voice-speakers, Higgsfield sheet, recoloured so faces don't blend) · speaker picker = avatar top-right (SelectMenu `trigger`) · drafts one card each, tint by status (pending soft brown — owner rejected yellow and red) · "สร้าง Task" runs in background/parallel · picked avatars in MultiSelectMenu · shared `brandSelectOptions()` with logos · DatePicker `clearable`. 30 s poll no longer resets the audio player or unsaved names/summary/draft edits.
- [x] Fixed fa46282: evidence second was 0 for every draft (one segment per speaker turn) — turns now split at 30 s / 0.6 s pause after a spacing token.
- [x] Poll race checked 2026-11-20: jobs 1796 · 1798 · 1817 · 1821 all ended `skip` (webhook always won). Unknown id → 404 `transcript_not_found` (probed, free) → null → retry, give up after 2 h. The in-progress code is still unseen (needs a paid job while it runs); harmless — any other code throws, the poll job fails, the webhook still saves the transcript.
- [x] ~~88-min AGD clip end-to-end~~ dropped 2026-11-20: owner — already done (item above: recording 537719fa holds the transcript + tasks); credits only matter for future long clips.
- [x] iPhone Share-Sheet Shortcut "ส่งเข้า amgo" (2026-11-19, d176d14 pushed): bot key scope `voice` (migration 20261119100000 + key row run by owner; key in memo/bot-keys.env AMGO_VOICE_SHORTCUT_KEY) · POST /api/bot/voice/upload → PUT file to signed uploadUrl (Content-Type audio/mp4) → POST startUrl. Signed .shortcut built with `shortcuts sign` from scratchpad plist (key embedded — rebuild if key rotates). Prod test via curl 9ad328b2 "ทดสอบ-Shortcut": review, 1 correct draft (กอล์ฟ · hape · Fri 20 Nov). Not yet tried from the real iPhone.
- [x] Sidebar entry "เสียงประชุม" (admin only, AudioLines) under งานของทีม, 2026-11-20 — committed only our hunk via `git apply --cached`; the brief chat's "สรุปเช้า" lines stay uncommitted in the worktree.
- [x] ESLint config fixed 2026-11-20: eslint-config-next 16 ships flat configs, so FlatCompat is gone and the configs are imported directly; `npm run lint` = `eslint .` (Next 16 dropped `next lint`). Voice files are clean. The full repo has 164 errors / 222 warnings that were already there (mostly no-explicit-any, set-state-in-effect); left alone, and `next build` does not lint.
- [x] Pushed 2026-11-18 (5b12f44..6f802c1): 936d08f · db400e0 · voice fixes 9bd74ed fa46282 · tasks 1bfaf5e · meeting summary af89dab · avatars e045267 6f802c1
- [x] ElevenLabs credits on /tasks/voice (2026-11-19/20, 9b24508 be8b829 pushed · 53c43c4 not pushed): bar "เหลือ x / limit" + reset date from GET /api/voice/credits (cached 5 min, /v1/user/subscription 429s after a few calls) · per-clip "ใช้ ~N เครดิต" on list + meeting page, estimate = transcript duration × 1,240/h (lib/voice/format.ts) · clips < 1 min show seconds.
- [x] Pushed 2026-11-20 (be8b829..95b99b3): 53c43c4 credit rate 1,000 → 1,240/h.

## Resume note
Resume at: only the owner's real-iPhone Shortcut test is left.
### State
All code committed; typecheck green. Shortcut file built in scratchpad (sc/build.py → `shortcuts sign --mode anyone`), copy on owner's Desktop; key in memo/bot-keys.env AMGO_VOICE_SHORTCUT_KEY.
### Gotchas
Async Scribe returns no cost; sync responses carry `character-cost`. 18 Nov quota error implied ~4,800/h vs measured ~1,240/h — see followups. Extraction lags up to 10 min (queue cron).
### Read first
project/jobs/plans/voice-tasks.md · lib/voice/pipeline.ts · app/api/bot/voice/
