// Small display helpers shared by the Voice → Tasks pages (client-safe).

/** 125 → "02:05" · 3725 → "1:02:05" */
export function clock(sec: number | null | undefined): string {
  const s = Math.max(0, Math.floor(sec ?? 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${String(m).padStart(2, '0')}:${r}`
}

/** 5280 → "1 ชม. 28 นาที" · '' when unknown */
export function durationText(sec: number | null | undefined): string {
  if (!sec) return ''
  if (sec < 60) return `${Math.round(sec)} วินาที`
  const m = Math.round(sec / 60)
  return m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที`
}

/** "speaker_0" → "ผู้พูด 1" */
export const speakerLabel = (speaker: string) => {
  const n = Number(speaker.replace(/^speaker_/, ''))
  return Number.isFinite(n) ? `ผู้พูด ${n + 1}` : speaker
}

export const SOURCE_LABEL: Record<string, string> = { plaud: 'Plaud', upload: 'อัปโหลด', share: 'แชร์จากมือถือ', app: 'อัดในแอป' }

/** POST/PATCH JSON to our API; throws with the route's Thai error message. */
export async function voiceFetch<T>(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error || `HTTP ${res.status}`)
  return json as T
}

/** ElevenLabs Scribe v3 bills ~1,240 credits per hour of audio as the pipeline calls it (diarize + keyterms;
 *  measured 20 Nov 69 via the sync API's `character-cost` header: 55 s → 19 with 3 or 60 keyterms, 7 s → 2 without).
 *  The async/webhook API returns no cost, so per-clip usage is estimated from the transcript's own duration.
 *  ⚠ An 18 Nov quota error asked 7,066 credits for an 88-min clip (~4,800/h) — likely a pre-check reserve; re-measure
 *  if the credit bar drops faster than these estimates add up. */
export const SCRIBE_CREDITS_PER_HOUR = 1240
export const scribeCredits = (sec: number) => Math.ceil((sec * SCRIBE_CREDITS_PER_HOUR) / 3600)
/** null → '' (transcript not from ElevenLabs, e.g. pasted from Plaud) */
export const creditsText = (credits: number | null | undefined) =>
  credits == null ? '' : `ใช้ ~${credits.toLocaleString('th-TH')} เครดิต`
