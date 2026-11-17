// POST /api/voice/webhook — ElevenLabs speech-to-text webhook (public; trust = HMAC signature).
//
// Set up in the ElevenLabs dashboard (Developers → Webhooks, event "Transcription completed", auth HMAC) with
// this URL; the signing secret goes in env ELEVENLABS_WEBHOOK_SECRET.
// Payloads (docs, 2026-11): success = { type: 'speech_to_text_transcription', data: { request_id, webhook_metadata,
// transcription: { language_code, text, words[{ text, start, end, type, speaker_id }] } } }
// failure = webhook_error with top-level { request_id, error_message, webhook_metadata }.
// We find the recording by webhook_metadata.recording_id (set when the job started), falling back to the job id.
// Answer 200 fast for anything we cannot or need not handle (duplicates, unknown events) so ElevenLabs stops retrying.
import { after, type NextRequest } from 'next/server'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { kickQueue } from '@/lib/queue/queue'
import { normalizeTranscript } from '@/lib/voice/scribe'
import { failRecording, saveTranscript } from '@/lib/voice/pipeline'
import type { Db } from '@/lib/voice/server'

const ok = (note: string) => Response.json({ ok: true, note })

function metadataRecordingId(meta: unknown): string | null {
  let m = meta
  if (typeof m === 'string') {
    try {
      m = JSON.parse(m)
    } catch {
      return null
    }
  }
  const id = (m as { recording_id?: unknown } | null)?.recording_id
  return typeof id === 'string' ? id : null
}

async function findRecording(db: Db, meta: unknown, jobId: unknown): Promise<string | null> {
  const fromMeta = metadataRecordingId(meta)
  if (fromMeta) return fromMeta
  if (typeof jobId !== 'string' || !jobId) return null
  const { data } = await db.from('voice_recordings').select('id').eq('provider', 'elevenlabs').eq('provider_job_id', jobId).maybeSingle()
  return data?.id ?? null
}

export async function POST(request: NextRequest) {
  const raw = await request.text()
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET
  if (!secret) {
    console.error('[voice-webhook] ELEVENLABS_WEBHOOK_SECRET is not set')
    return Response.json({ error: 'not configured' }, { status: 500 })
  }

  let event: Record<string, unknown>
  try {
    event = await new ElevenLabsClient().webhooks.constructEvent(raw, request.headers.get('elevenlabs-signature') ?? '', secret)
  } catch (e) {
    console.warn('[voice-webhook] bad signature:', (e as Error).message)
    return Response.json({ error: 'invalid signature' }, { status: 401 })
  }

  const db = createAdminClient()
  const type = String(event.type ?? '')
  const data = (event.data ?? {}) as Record<string, unknown>

  try {
    if (type === 'speech_to_text_transcription') {
      const id = await findRecording(db, data.webhook_metadata, data.request_id)
      if (!id) return ok('unknown recording')
      const t = normalizeTranscript(data.transcription)
      if (!t) {
        await failRecording(db, id, ['uploaded', 'transcribing'], new Error('ผลถอดเสียงไม่มีรายการคำ'))
        return ok('no words')
      }
      const saved = await saveTranscript(db, id, t)
      if (saved) {
        const origin = request.nextUrl.origin
        after(() => kickQueue(origin))
      }
      return ok(saved ? 'saved' : 'duplicate')
    }

    // Failure events: documented as webhook_error with top-level fields; accept them inside data too.
    const errMsg = event.error_message ?? data.error_message
    if (type.includes('error') || errMsg) {
      const id = await findRecording(db, event.webhook_metadata ?? data.webhook_metadata, event.request_id ?? data.request_id)
      if (id) await failRecording(db, id, ['uploaded', 'transcribing'], new Error(`ถอดเสียงไม่สำเร็จ: ${String(errMsg ?? type)}`))
      return ok('failure recorded')
    }
    return ok(`ignored ${type}`)
  } catch (e) {
    // Our side broke (DB) — 500 lets ElevenLabs retry (if retries are on); the poll job is the other safety net.
    console.error('[voice-webhook] failed:', e)
    return Response.json({ error: 'internal' }, { status: 500 })
  }
}
