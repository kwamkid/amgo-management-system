// Resolve a Plaud public share link to recording metadata + a temporary audio URL.
// Unofficial: these are the endpoints web.plaud.ai's share page calls (checked 2026-11-17).
// If Plaud changes them, fall back to uploading the exported audio file.

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

/** Plaud answers status -302 with the user's regional API host; retry there once. */
async function getRegional(path: string): Promise<{ base: string; body: Record<string, unknown> }> {
  let base = PLAUD_API
  let body = await getJson(base, path)
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
