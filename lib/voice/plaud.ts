// Resolve a Plaud public share link to recording metadata + a temporary audio URL.
// Unofficial: these are the endpoints web.plaud.ai's share page calls (checked 2026-11-17).
// If Plaud changes them, fall back to uploading the exported audio file.
import type { Segment, Transcript } from '@/lib/voice/scribe'

const PLAUD_API = 'https://api.plaud.ai'
const HEADERS = { 'User-Agent': 'Mozilla/5.0', Origin: 'https://web.plaud.ai' }

export interface PlaudShare {
  key: string
  fileId: string
  title: string
  recordedAt: Date
  durationSec: number
  hasPlaudTranscript: boolean
  audioUrl: string // presigned S3 URL, expires ~1 h
}

/** Accepts https://web.plaud.ai/s/<key>, /nshare/<key>, /nshare3/<key> or the bare key. */
export function parsePlaudShareKey(input: string): string | null {
  const s = input.trim()
  const m = s.match(/(?:\/s\/|\/nshare3?\/)(pub_[^/?#\s]+)/) ?? s.match(/^(pub_[^/?#\s]+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

async function getJson(base: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(base + path, { headers: HEADERS, cache: 'no-store' })
  if (!res.ok) throw new Error(`Plaud ${path.split('/').pop()} HTTP ${res.status}`)
  return (await res.json()) as Record<string, unknown>
}

/** Regional hosts to try when the global host says "Share not found" (seen 2026-11-17: an APAC
 *  account's share answers 40400 on api.plaud.ai instead of the -302 redirect). */
const PLAUD_REGIONS = ['https://api-apse1.plaud.ai', 'https://api-euc1.plaud.ai']

/** Plaud answers status -302 with the user's regional API host; retry there once. */
async function getRegional(path: string): Promise<{ base: string; body: Record<string, unknown> }> {
  let base = PLAUD_API
  let body = await getJson(base, path)
  if (body.status === 40400) {
    for (const region of PLAUD_REGIONS) {
      const b = await getJson(region, path).catch(() => null)
      if (b && b.status !== 40400) {
        base = region
        body = b
        break
      }
    }
  }
  if (body.status === -302) {
    const api = (body.data as { domains?: { api?: string } } | undefined)?.domains?.api
    if (!api || !/^https:\/\/api[-a-z0-9]*\.plaud\.ai$/.test(api)) throw new Error('Plaud region redirect without a valid host')
    base = api
    body = await getJson(base, path)
  }
  if (body.status !== 0) throw new Error(`Plaud share error: ${String(body.msg ?? body.status)}`)
  return { base, body }
}

export async function resolvePlaudShare(input: string): Promise<PlaudShare> {
  const key = parsePlaudShareKey(input)
  if (!key) throw new Error('Not a Plaud share link')
  const enc = encodeURIComponent(key)

  const { base, body: meta } = await getRegional(`/share/access/${enc}`)
  if (meta.is_audio !== 1) throw new Error('This Plaud share has no audio')
  const file = meta.data_file as { id: string; filename: string; start_time: number; duration: number }

  const audio = await getJson(base, `/share/access/${enc}/audio`)
  const audioUrl = typeof audio.temp_url === 'string' ? audio.temp_url : ''
  if (audio.status !== 0 || !audioUrl.startsWith('https://')) throw new Error('Plaud did not return an audio URL')

  return {
    key,
    fileId: file.id,
    title: file.filename,
    recordedAt: new Date(file.start_time),
    durationSec: Math.round(file.duration / 1000),
    hasPlaudTranscript: meta.is_trans === 1,
    audioUrl,
  }
}

type PlaudSegment = { content?: string; start_time?: number; end_time?: number; speaker?: string; original_speaker?: string }

/** "Speaker 3" → "speaker_2" (same ids as ElevenLabs, so the page labels them "ผู้พูด 3"); a name the
 *  owner gave the speaker in Plaud stays as is. */
function speakerId(raw: string | undefined): string {
  const s = (raw ?? '').trim()
  const m = s.match(/^speaker\s*(\d+)$/i)
  if (m) return `speaker_${Math.max(0, Number(m[1]) - 1)}`
  return s || 'speaker_0'
}

/** Plaud puts a space between Thai words ("พอ คุยกับ เจ้") — join them back; keep spaces next to Latin/digits. */
const joinThai = (t: string) => t.replace(/([฀-๿]) +(?=[฀-๿])/g, '$1').replace(/\s+/g, ' ').trim()

/**
 * The transcript Plaud already made for this share (free — no ElevenLabs credits), or null when the share has none.
 * Same shape the pipeline stores for ElevenLabs: seconds, one segment per Plaud utterance.
 */
export async function fetchPlaudTranscript(input: string): Promise<Transcript | null> {
  const key = parsePlaudShareKey(input)
  if (!key) throw new Error('Not a Plaud share link')
  const { body: meta } = await getRegional(`/share/access/${encodeURIComponent(key)}`)
  if (meta.is_trans !== 1) return null
  const file = meta.data_file as { duration?: number; trans_result?: PlaudSegment[]; file_language?: string } | undefined
  const raw = Array.isArray(file?.trans_result) ? file.trans_result : []
  const segments: Segment[] = raw
    .map((s) => ({
      speaker: speakerId(s.speaker ?? s.original_speaker),
      start: (s.start_time ?? 0) / 1000,
      end: (s.end_time ?? s.start_time ?? 0) / 1000,
      text: joinThai(s.content ?? ''),
    }))
    .filter((s) => s.text)
  if (!segments.length) return null
  const lang = file?.file_language && file.file_language !== 'auto' ? file.file_language : 'th'
  return {
    text: segments.map((s) => s.text).join('\n'),
    languageCode: lang,
    durationSec: (file?.duration ?? 0) / 1000,
    segments,
  }
}
