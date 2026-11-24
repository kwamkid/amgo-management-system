// Voice → Tasks pipeline on the central queue (.claude/rules/queue.md · plan: project/jobs/plans/voice-tasks.md).
// Server only. Every step is a small queue job (≤ ~15 s); the slow parts happen outside our functions:
//
//   voice.plaud.import    re-resolve the Plaud share (fresh 1-h URL) → copy audio to bucket → Plaud's own transcript
//                         when the share has one (free, owner 2026-11-24) → saveTranscript · else → transcribe.start
//                         (payload.forceScribe = the "ถอดใหม่ด้วย ElevenLabs" button skips Plaud's transcript)
//   voice.transcribe.start signed URL → ElevenLabs Scribe with webhook=true → status 'transcribing' (+ poll safety net)
//   (webhook)             POST /api/voice/webhook → saveTranscript() → status 'extracting' → extract.start
//   voice.transcribe.poll safety net if the webhook never comes: GET transcript every 5 min, give up after ~2 h
//   voice.extract.start   Claude request submitted as a Message Batch → extract.poll
//   voice.extract.poll    batch ended? → validate → drafts → status 'review' (retry every 60 s, give up after ~25 h)
//   voice.cleanup         (daily cron) delete audio > 90 days · re-enqueue rows stuck > 1 h with no live job
//
// Idempotent: each step checks the row's status first and moves it with an update that only matches the status
// it expects, so a duplicate webhook / job / click does nothing.
import type { SupabaseClient } from '@supabase/supabase-js'
import { enqueue, type HandlerResult, type QueueJob } from '@/lib/queue/queue'
import { BRANDS } from '@/lib/constants/brands'
import { fetchPlaudTranscript, resolvePlaudShare } from '@/lib/voice/plaud'
import { fetchTranscript, startTranscription, type Segment, type Transcript } from '@/lib/voice/scribe'
import { parseExtractMessage, readExtractBatch, submitExtractBatch, type ExtractedTask, type SpeakerGuesses } from '@/lib/voice/extract'
import { BUCKET, MAX_BYTES, cleanupOldAudio, getStaff, keyterms, type Db } from '@/lib/voice/server'
import type { Json } from '@/types/database'

export const voiceGroup = (recordingId: string) => `voice:${recordingId}`

const SIGNED_URL_SEC = 6 * 3600 // Scribe fetches the file itself; queue delays can be long
const TRANSCRIBE_POLL_FIRST_MS = 10 * 60_000
const TRANSCRIBE_POLL_EVERY_MS = 5 * 60_000
const TRANSCRIBE_GIVE_UP_MS = 2 * 3600_000
const EXTRACT_POLL_EVERY_MS = 60_000
const EXTRACT_GIVE_UP_MS = 25 * 3600_000 // batches expire after 24 h
const STUCK_MS = 3600_000

const LABEL: Record<string, string> = {
  'voice.plaud.import': 'ดึงเสียงจาก Plaud',
  'voice.transcribe.start': 'ส่งไฟล์ไปถอดเสียง',
  'voice.transcribe.poll': 'รอผลถอดเสียง',
  'voice.extract.start': 'ส่งให้ AI ร่างงาน',
  'voice.extract.poll': 'รอ AI ร่างงาน',
}

/** Kinds that count as "this recording has live work" (cleanup is not per recording). */
export const VOICE_KINDS = Object.keys(LABEL)

export async function enqueueVoice(
  db: Db,
  kind: keyof typeof LABEL | string,
  recordingId: string,
  extra: Record<string, unknown> = {},
  opts: { runAfterMs?: number; maxAttempts?: number; createdBy?: string | null } = {},
) {
  await enqueue(db as unknown as SupabaseClient, [
    {
      kind,
      payload: { recordingId, ...extra },
      groupKey: voiceGroup(recordingId),
      label: LABEL[kind] ?? kind,
      maxAttempts: opts.maxAttempts ?? 3,
      runAfter: opts.runAfterMs ? new Date(Date.now() + opts.runAfterMs) : undefined,
      createdBy: opts.createdBy ?? null,
    },
  ])
}

/** Is a job of this kind already queued/running for the recording? (avoid double submits) */
async function hasLiveJob(db: Db, recordingId: string, kinds: string[], exceptJobId?: number) {
  let q = db
    .from('queue_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('group_key', voiceGroup(recordingId))
    .in('kind', kinds)
    .in('status', ['queued', 'running'])
  if (exceptJobId) q = q.neq('id', exceptJobId)
  const { count } = await q
  return (count ?? 0) > 0
}

type Rec = { id: string; status: string; updated_at: string; storage_path: string | null; title: string; recorded_at: string | null; created_at: string; provider_job_id: string | null }
const REC_COLS = 'id, status, updated_at, storage_path, title, recorded_at, created_at, provider_job_id'

async function getRec(db: Db, id: string): Promise<Rec | null> {
  const { data, error } = await db.from('voice_recordings').select(REC_COLS).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** Mark the recording failed (only from the given statuses) — the review page shows the error + a retry button. */
/** Turn known provider errors into Thai the owner can act on (owner 2026-11-18). */
function friendlyError(raw: string): string {
  const quota = raw.match(/exceeds your quota[^.]*\.\s*You have (\d+) credits remaining, while (\d+) credits are required/i)
  if (quota) {
    const n = (s: string) => Number(s).toLocaleString('en-US')
    return `เครดิต ElevenLabs ไม่พอ — คลิปนี้ต้องใช้ ${n(quota[2])} เครดิต เหลืออยู่ ${n(quota[1])} · เติมเครดิตหรืออัปแพลนที่ elevenlabs.io แล้วกด "ลองใหม่"`
  }
  return raw
}

export async function failRecording(db: Db, id: string, from: string[], e: unknown) {
  const msg = friendlyError(e instanceof Error ? e.message : String(e)).slice(0, 1000)
  console.error(`[voice] ${id} failed:`, msg)
  await db.from('voice_recordings').update({ status: 'failed', error: msg }).eq('id', id).in('status', from)
}

/** Queue retries thrown errors; on the last attempt also mark the recording failed, then rethrow. */
async function lastTryFails(db: Db, job: QueueJob, id: string, from: string[], e: unknown): Promise<never> {
  if (job.attempts >= job.max_attempts) await failRecording(db, id, from, e)
  throw e
}

const age = (iso: string) => Date.now() - new Date(iso).getTime()

// ── steps ────────────────────────────────────────────────────────────────

async function plaudImport(db: Db, job: QueueJob): Promise<HandlerResult> {
  const id = job.payload.recordingId as string
  const rec = await getRec(db, id)
  if (!rec || rec.status !== 'uploaded') return { result: 'skip' }
  if (!rec.storage_path) {
    try {
      const share = await resolvePlaudShare(job.payload.key as string)
      const res = await fetch(share.audioUrl, { cache: 'no-store' })
      if (!res.ok) throw new Error(`ดาวน์โหลดเสียงจาก Plaud ไม่ได้ (HTTP ${res.status})`)
      const bytes = new Uint8Array(await res.arrayBuffer())
      if (bytes.byteLength > MAX_BYTES) {
        await failRecording(db, id, ['uploaded'], new Error('ไฟล์เสียงใหญ่เกิน 50 MB'))
        return { result: 'too big' }
      }
      const path = `${id}.ogg`
      const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: 'audio/ogg', upsert: true })
      if (up.error) throw new Error(`อัปโหลดเสียงไม่สำเร็จ: ${up.error.message}`)
      const { error } = await db.from('voice_recordings').update({ storage_path: path }).eq('id', id).is('storage_path', null)
      if (error) throw new Error(error.message)
    } catch (e) {
      return lastTryFails(db, job, id, ['uploaded'], e)
    }
  }
  // Plaud already transcribed it → use that (0 ElevenLabs credits). Any error here falls back to ElevenLabs.
  if (!job.payload.forceScribe) {
    const t = await fetchPlaudTranscript(job.payload.key as string).catch((e) => {
      console.warn(`[voice] ${id} Plaud transcript unavailable:`, e instanceof Error ? e.message : e)
      return null
    })
    if (t) return { result: (await saveTranscript(db, id, t, 'plaud')) ? 'plaud transcript' : 'already saved' }
  }
  if (!(await hasLiveJob(db, id, ['voice.transcribe.start']))) await enqueueVoice(db, 'voice.transcribe.start', id)
  return { result: 'copied' }
}

async function transcribeStart(db: Db, job: QueueJob): Promise<HandlerResult> {
  const id = job.payload.recordingId as string
  const rec = await getRec(db, id)
  if (!rec || rec.status !== 'uploaded') return { result: 'skip' }
  try {
    if (!rec.storage_path) throw new Error('ยังไม่มีไฟล์เสียง')
    const signed = await db.storage.from(BUCKET).createSignedUrl(rec.storage_path, SIGNED_URL_SEC)
    if (signed.error || !signed.data?.signedUrl) throw new Error(`ไม่พบไฟล์เสียง (${signed.error?.message ?? 'no url'})`)
    const roster = await getStaff(db, true)
    const started = await startTranscription(signed.data.signedUrl, { keyterms: keyterms(roster), metadata: { recording_id: id } })
    // A very short file's webhook may already have moved the row on — then this update matches nothing (fine).
    await db
      .from('voice_recordings')
      .update({ status: 'transcribing', provider: 'elevenlabs', provider_job_id: started.transcriptionId ?? started.requestId, error: null })
      .eq('id', id)
      .eq('status', 'uploaded')
  } catch (e) {
    return lastTryFails(db, job, id, ['uploaded'], e)
  }
  await enqueueVoice(db, 'voice.transcribe.poll', id, {}, { runAfterMs: TRANSCRIBE_POLL_FIRST_MS })
  return { result: 'started' }
}

/**
 * Store a finished transcript and move on to extraction. Shared by the webhook and the poll; idempotent —
 * only a row still waiting for its transcript ('uploaded' / 'transcribing') is updated.
 */
export async function saveTranscript(db: Db, id: string, t: Transcript, provider: 'elevenlabs' | 'plaud' = 'elevenlabs'): Promise<boolean> {
  const rec = await getRec(db, id)
  if (!rec || !['uploaded', 'transcribing'].includes(rec.status)) return false
  const { error } = await db.from('voice_transcripts').upsert(
    {
      recording_id: id,
      language: t.languageCode,
      text: t.text,
      segments: t.segments as unknown as Json,
      raw: (provider === 'plaud'
        ? { provider: 'plaud', duration_sec: t.durationSec }
        : { provider: 'elevenlabs', model: 'scribe_v3', transcription_id: t.transcriptionId ?? null, duration_sec: t.durationSec }) as Json,
    },
    { onConflict: 'recording_id' },
  )
  if (error) throw new Error(error.message)
  const { data: moved } = await db
    .from('voice_recordings')
    .update({ status: 'extracting', error: null, ...(t.durationSec ? { duration_sec: Math.round(t.durationSec) } : {}) })
    .eq('id', id)
    .in('status', ['uploaded', 'transcribing'])
    .select('id')
    .maybeSingle()
  if (!moved) return false
  await enqueueVoice(db, 'voice.extract.start', id)
  return true
}

async function transcribePoll(db: Db, job: QueueJob): Promise<HandlerResult> {
  const id = job.payload.recordingId as string
  const rec = await getRec(db, id)
  if (!rec || rec.status !== 'transcribing') return { result: 'skip' }
  if (!rec.provider_job_id) throw new Error('ไม่มีเลขงานถอดเสียง')
  const t = await fetchTranscript(rec.provider_job_id)
  if (!t) {
    if (age(rec.updated_at) > TRANSCRIBE_GIVE_UP_MS) {
      await failRecording(db, id, ['transcribing'], new Error('ถอดเสียงนานเกิน 2 ชั่วโมง — ลองใหม่'))
      return { result: 'gave up' }
    }
    return { retryAfterMs: TRANSCRIBE_POLL_EVERY_MS }
  }
  return { result: (await saveTranscript(db, id, t)) ? 'saved' : 'already saved' }
}

type SegmentsRow = { segments: Json; speaker_map: Json }

async function extractInput(db: Db, rec: Rec) {
  const { data: tr, error } = await db.from('voice_transcripts').select('segments, speaker_map').eq('recording_id', rec.id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!tr) throw new Error('ยังไม่มีข้อความถอดเสียง')
  const roster = (await getStaff(db, true)).map(({ user_id, nickname, full_name }) => ({ user_id, nickname, full_name }))
  const segments = ((tr as SegmentsRow).segments ?? []) as unknown as Segment[]
  return { tr: tr as SegmentsRow, roster, segments }
}

async function extractStart(db: Db, job: QueueJob): Promise<HandlerResult> {
  const id = job.payload.recordingId as string
  const rec = await getRec(db, id)
  if (!rec || rec.status !== 'extracting') return { result: 'skip' }
  if (await hasLiveJob(db, id, ['voice.extract.poll'])) return { result: 'already submitted' }
  try {
    const { tr, roster, segments } = await extractInput(db, rec)
    if (!segments.length) {
      await finishExtract(db, id, tr, [], {}, '')
      return { result: 'no speech' }
    }
    const batchId = await submitExtractBatch(id, {
      meetingAt: new Date(rec.recorded_at ?? rec.created_at),
      title: rec.title,
      roster,
      brands: BRANDS,
      segments,
    })
    await enqueueVoice(db, 'voice.extract.poll', id, { batchId, submittedAt: Date.now() }, { runAfterMs: EXTRACT_POLL_EVERY_MS, maxAttempts: 5 })
    return { result: { batchId } }
  } catch (e) {
    return lastTryFails(db, job, id, ['extracting'], e)
  }
}

async function extractPoll(db: Db, job: QueueJob): Promise<HandlerResult> {
  const id = job.payload.recordingId as string
  const batchId = job.payload.batchId as string
  const rec = await getRec(db, id)
  if (!rec || rec.status !== 'extracting') return { result: 'skip' }

  const out = await readExtractBatch(batchId, id)
  if (out.state === 'pending') {
    if (Date.now() - Number(job.payload.submittedAt ?? 0) > EXTRACT_GIVE_UP_MS) {
      await failRecording(db, id, ['extracting'], new Error('AI ร่างงานไม่เสร็จภายใน 24 ชั่วโมง — ลองใหม่'))
      return { result: 'gave up' }
    }
    return { retryAfterMs: EXTRACT_POLL_EVERY_MS }
  }
  if (out.state === 'error') {
    await failRecording(db, id, ['extracting'], new Error(out.error))
    return { result: 'batch error' }
  }
  try {
    const { tr, roster, segments } = await extractInput(db, rec)
    const parsed = parseExtractMessage(out.message, { roster, brands: BRANDS, segments })
    await finishExtract(db, id, tr, parsed.tasks, parsed.speakerGuesses, parsed.summary)
    return { result: { tasks: parsed.tasks.length, usage: parsed.usage } }
  } catch (e) {
    // A bad answer will not get better by re-reading the same batch — fail the recording (retry = new batch).
    await failRecording(db, id, ['extracting'], e)
    return { result: 'parse error' }
  }
}

/** extracting → review, then write drafts. Only the caller that wins the status update writes (no duplicates). */
async function finishExtract(db: Db, id: string, tr: SegmentsRow, tasks: ExtractedTask[], guesses: SpeakerGuesses, summary: string) {
  const { data: won } = await db
    .from('voice_recordings')
    // a re-run ("ลองใหม่") replaces the summary with the new one
    .update({ status: 'review', error: null, ...(summary && { summary }) })
    .eq('id', id)
    .eq('status', 'extracting')
    .select('id')
    .maybeSingle()
  if (!won) return
  try {
    // Prefill the mapping with confident guesses only when the owner has not mapped anyone yet.
    const map = (tr.speaker_map ?? {}) as Record<string, string | null>
    const prefill = Object.keys(map).length
      ? map
      : Object.fromEntries(Object.entries(guesses).filter(([, g]) => g.user_id).map(([s, g]) => [s, g.user_id]))
    const { error: gErr } = await db
      .from('voice_transcripts')
      .update({ speaker_guesses: guesses as unknown as Json, speaker_map: prefill as Json })
      .eq('recording_id', id)
    if (gErr) throw new Error(gErr.message)

    await db.from('voice_task_drafts').delete().eq('recording_id', id).eq('status', 'pending')
    if (tasks.length) {
      const { error } = await db.from('voice_task_drafts').insert(
        tasks.map((t, i) => ({
          recording_id: id,
          sort_order: i,
          title: t.title,
          notes: t.notes,
          assignee_ids: t.assignee_user_ids,
          assignee_raw: t.assignee_raw,
          due_date: t.due_date,
          brand: t.brand,
          evidence_quote: t.evidence_quote,
          evidence_start_sec: t.evidence_start_sec,
          confidence: t.confidence,
        })),
      )
      if (error) throw new Error(error.message)
    }
  } catch (e) {
    await failRecording(db, id, ['review'], e)
  }
}

/** Daily: delete old audio + re-enqueue rows stuck > 1 h with no live queue job. */
async function cleanup(db: Db): Promise<HandlerResult> {
  const audio = await cleanupOldAudio(db)
  const { data: stuck } = await db
    .from('voice_recordings')
    .select('id, status, storage_path')
    .in('status', ['uploaded', 'extracting'])
    .lt('updated_at', new Date(Date.now() - STUCK_MS).toISOString())
    .order('updated_at')
    .limit(20)
  let requeued = 0
  for (const r of stuck ?? []) {
    if (await hasLiveJob(db, r.id, VOICE_KINDS)) continue
    if (r.status === 'extracting') await enqueueVoice(db, 'voice.extract.start', r.id)
    else if (r.storage_path) await enqueueVoice(db, 'voice.transcribe.start', r.id)
    else {
      await failRecording(db, r.id, ['uploaded'], new Error('ไม่ได้รับไฟล์เสียง — อัปโหลดหรือวางลิงก์ใหม่'))
      continue
    }
    requeued++
  }
  return { result: { audioDeleted: audio.files, moreAudio: audio.remaining, requeued } }
}

/**
 * Retry a failed recording from the step that failed:
 * transcript exists → extract · audio exists → transcribe · Plaud without audio → import again (last pasted key).
 */
export async function retryRecording(db: Db, id: string, me: string): Promise<string> {
  const rec = await getRec(db, id)
  if (!rec) throw new Error('ไม่พบไฟล์เสียงนี้')
  if (rec.status !== 'failed') return rec.status
  const { data: tr } = await db.from('voice_transcripts').select('recording_id').eq('recording_id', id).maybeSingle()
  let next: 'extracting' | 'uploaded'
  let kind: string
  let extra: Record<string, unknown> = {}
  if (tr) {
    next = 'extracting'
    kind = 'voice.extract.start'
  } else if (rec.storage_path) {
    next = 'uploaded'
    kind = 'voice.transcribe.start'
  } else {
    const { data: last } = await db
      .from('queue_jobs')
      .select('payload')
      .eq('group_key', voiceGroup(id))
      .eq('kind', 'voice.plaud.import')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()
    const key = (last?.payload as { key?: string } | null)?.key
    if (!key) throw new Error('ไม่มีไฟล์เสียงให้ลองใหม่ — อัปโหลดหรือวางลิงก์ใหม่')
    next = 'uploaded'
    kind = 'voice.plaud.import'
    extra = { key }
  }
  const { data: moved } = await db.from('voice_recordings').update({ status: next, error: null }).eq('id', id).eq('status', 'failed').select('id').maybeSingle()
  if (!moved) return (await getRec(db, id))?.status ?? 'failed'
  await enqueueVoice(db, kind, id, extra, { createdBy: me })
  return next
}

/**
 * "ถอดใหม่ด้วย ElevenLabs": drop the Plaud transcript + pending drafts and transcribe the stored audio on ElevenLabs.
 * Blocked once any draft was accepted (the new drafts would duplicate tasks already on the board).
 */
export async function rescribeRecording(db: Db, id: string, me: string): Promise<string> {
  const rec = await getRec(db, id)
  if (!rec) throw new Error('ไม่พบไฟล์เสียงนี้')
  if (!['review', 'done', 'failed'].includes(rec.status)) throw new Error('ไฟล์นี้กำลังทำงานอยู่ — รอให้เสร็จก่อน')
  if (!rec.storage_path) throw new Error('ไม่มีไฟล์เสียงแล้ว (ลบตามกำหนด 90 วัน) — ถอดใหม่ไม่ได้')
  const { count } = await db
    .from('voice_task_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('recording_id', id)
    .eq('status', 'accepted')
  if (count) throw new Error('มีงานที่รับลงบอร์ดแล้ว — ถอดใหม่จะได้ร่างงานซ้ำ จึงถอดใหม่ไม่ได้')
  const { data: moved } = await db
    .from('voice_recordings')
    .update({ status: 'uploaded', error: null })
    .eq('id', id)
    .in('status', ['review', 'done', 'failed'])
    .select('id')
    .maybeSingle()
  if (!moved) return (await getRec(db, id))?.status ?? rec.status
  await db.from('voice_task_drafts').delete().eq('recording_id', id).neq('status', 'accepted')
  // speaker ids differ between Plaud and ElevenLabs — start the mapping fresh with the new transcript
  await db.from('voice_transcripts').delete().eq('recording_id', id)
  await enqueueVoice(db, 'voice.transcribe.start', id, {}, { createdBy: me })
  return 'uploaded'
}

const asDb = (sb: SupabaseClient) => sb as unknown as Db

export const VOICE_HANDLERS: Record<string, (sb: SupabaseClient, job: QueueJob) => Promise<HandlerResult>> = {
  'voice.plaud.import': (sb, job) => plaudImport(asDb(sb), job),
  'voice.transcribe.start': (sb, job) => transcribeStart(asDb(sb), job),
  'voice.transcribe.poll': (sb, job) => transcribePoll(asDb(sb), job),
  'voice.extract.start': (sb, job) => extractStart(asDb(sb), job),
  'voice.extract.poll': (sb, job) => extractPoll(asDb(sb), job),
  'voice.cleanup': (sb) => cleanup(asDb(sb)),
}

/** Queue the daily `voice.cleanup` job unless one is already waiting. Called by the photo-cleanup cron. */
export async function queueVoiceCleanup(db: SupabaseClient): Promise<boolean> {
  const { count } = await db
    .from('queue_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'voice.cleanup')
    .in('status', ['queued', 'running'])
  if (count) return false
  await enqueue(db, [{ kind: 'voice.cleanup', label: 'ล้างไฟล์เสียงเก่า', groupKey: 'voice:cleanup' }])
  return true
}
