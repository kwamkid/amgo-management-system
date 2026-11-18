// ElevenLabs Scribe v3 transcription with speaker diarization (Thai + English).
// The SDK reads ELEVENLABS_API_KEY from the environment.
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

export interface Segment {
  speaker: string // "speaker_0" …
  start: number // seconds
  end: number
  text: string
}

export interface Transcript {
  text: string
  languageCode: string
  durationSec: number
  segments: Segment[]
  transcriptionId?: string
}

type Word = { text: string; start?: number; end?: number; type: string; speakerId?: string }

/** Long monologues are split so each draft's evidence can jump near the right second
 *  (one segment per turn made a 51 s single-speaker clip cite 0:00 for every task — 2026-11-18). */
const MAX_SEGMENT_SEC = 30
const PAUSE_SPLIT_SEC = 0.6
const MIN_BEFORE_PAUSE_SPLIT_SEC = 8

/** Merge word-level output into segments per speaker turn, split on long turns / pauses. */
export function wordsToSegments(words: Word[]): Segment[] {
  const out: Segment[] = []
  // spacing tokens stretch across the pause, so measure the gap from the previous *word*
  let lastWordEnd: number | null = null
  // Thai "words" from Scribe are often single characters — only split right after a spacing token
  let afterSpace = false
  for (const w of words) {
    if (w.type === 'audio_event') continue
    const speaker = w.speakerId ?? 'speaker_0'
    const last = out[out.length - 1]
    const len = last ? last.end - last.start : 0
    const gap = last && w.start != null && lastWordEnd != null ? w.start - lastWordEnd : 0
    if (w.type === 'word' && w.end != null) lastWordEnd = w.end
    const split =
      w.type === 'word' &&
      afterSpace &&
      (len >= MAX_SEGMENT_SEC || (len >= MIN_BEFORE_PAUSE_SPLIT_SEC && gap >= PAUSE_SPLIT_SEC))
    afterSpace = w.type === 'spacing'
    if (last && last.speaker === speaker && !split) {
      last.text += w.text
      if (w.end != null) last.end = w.end
    } else if (w.type === 'word') {
      out.push({ speaker, start: w.start ?? 0, end: w.end ?? w.start ?? 0, text: w.text })
    }
  }
  return out.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text)
}

export async function transcribeUrl(
  audioUrl: string,
  opts: { keyterms?: string[]; numSpeakers?: number } = {},
): Promise<Transcript> {
  const client = new ElevenLabsClient()
  const res = await client.speechToText.convert(
    {
      modelId: 'scribe_v3',
      cloudStorageUrl: audioUrl,
      languageCode: 'tha',
      diarize: true,
      timestampsGranularity: 'word',
      tagAudioEvents: false,
      keyterms: opts.keyterms?.slice(0, 100),
      numSpeakers: opts.numSpeakers,
    },
    { timeoutInSeconds: 1800 },
  )
  if (!('words' in res)) throw new Error('Unexpected Scribe response (multichannel or webhook)')
  return {
    text: res.text,
    languageCode: res.languageCode,
    durationSec: (res as { audioDurationSecs?: number }).audioDurationSecs ?? 0,
    segments: wordsToSegments(res.words as Word[]),
    transcriptionId: (res as { transcriptionId?: string }).transcriptionId,
  }
}

// ── async (webhook) mode — used by the queue (lib/voice/pipeline.ts) ─────────

/** Start an async Scribe job; the result arrives at POST /api/voice/webhook. Returns ids to store. */
export async function startTranscription(
  audioUrl: string,
  opts: { keyterms?: string[]; metadata: Record<string, string> },
): Promise<{ requestId: string; transcriptionId: string | null }> {
  const client = new ElevenLabsClient()
  const res = await client.speechToText.convert({
    modelId: 'scribe_v3',
    cloudStorageUrl: audioUrl,
    languageCode: 'tha',
    diarize: true,
    timestampsGranularity: 'word',
    tagAudioEvents: false,
    keyterms: opts.keyterms?.slice(0, 100),
    webhook: true,
    webhookMetadata: JSON.stringify(opts.metadata),
  })
  const r = res as { requestId?: string; transcriptionId?: string }
  if (!r.requestId && !r.transcriptionId) throw new Error('Scribe ไม่ได้ส่งเลขงานกลับมา')
  return { requestId: r.requestId ?? r.transcriptionId!, transcriptionId: r.transcriptionId ?? null }
}

/**
 * Normalise a transcription object from the webhook (snake_case JSON) or the SDK (camelCase).
 * Returns null when it has no word list (e.g. multichannel — not used here).
 */
export function normalizeTranscript(raw: unknown): Transcript | null {
  const t = (raw ?? {}) as Record<string, unknown>
  const words = t.words
  if (!Array.isArray(words)) return null
  const mapped: Word[] = words.map((w: Record<string, unknown>) => ({
    text: String(w.text ?? ''),
    start: typeof w.start === 'number' ? w.start : undefined,
    end: typeof w.end === 'number' ? w.end : undefined,
    type: String(w.type ?? 'word'),
    speakerId: (w.speaker_id ?? w.speakerId) as string | undefined,
  }))
  const dur = t.audio_duration_secs ?? t.audioDurationSecs
  return {
    text: String(t.text ?? ''),
    languageCode: String(t.language_code ?? t.languageCode ?? ''),
    durationSec: typeof dur === 'number' ? dur : 0,
    segments: wordsToSegments(mapped),
    transcriptionId: (t.transcription_id ?? t.transcriptionId) as string | undefined,
  }
}

/** Poll fallback. null = not ready yet (or unknown id) — the docs do not say what "not ready" returns. */
export async function fetchTranscript(transcriptionId: string): Promise<Transcript | null> {
  const client = new ElevenLabsClient()
  try {
    const res = await client.speechToText.transcripts.get(transcriptionId)
    return normalizeTranscript(res)
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode
    if (code === 404 || code === 409 || code === 425) return null
    throw e
  }
}
