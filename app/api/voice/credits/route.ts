// GET /api/voice/credits — ElevenLabs credits left this month, shown on /tasks/voice (owner 19 Nov 69).
// Scribe transcription is billed from the same monthly credit pool as TTS (`character_count` / `character_limit`).
// /v1/user/subscription is rate-limited hard (429 after a few calls, 19 Nov) → keep the last good answer
// for 5 min per server instance, and fall back to it when ElevenLabs says 429.
import { requireVoiceAdmin, voiceError, voiceJson } from '@/lib/voice/server'

type Credits = { available: true; used: number; limit: number; left: number; resetAt: string | null; tier: string | null }

const TTL_MS = 5 * 60_000
let cache: { at: number; data: Credits } | null = null

export async function GET() {
  try {
    await requireVoiceAdmin()
    if (cache && Date.now() - cache.at < TTL_MS) return voiceJson(cache.data)
    const key = process.env.ELEVENLABS_API_KEY
    if (!key) return voiceJson({ available: false, reason: 'ไม่มี ELEVENLABS_API_KEY' })
    const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key }, cache: 'no-store' })
    if (!res.ok) return voiceJson(cache?.data ?? { available: false, reason: `ElevenLabs ${res.status}` })
    const s = (await res.json()) as { tier?: string; character_count?: number; character_limit?: number; next_character_count_reset_unix?: number }
    const limit = s.character_limit ?? 0
    const used = s.character_count ?? 0
    if (!(limit > 0)) return voiceJson({ available: false, reason: 'ไม่มีข้อมูลเครดิต' })
    const data: Credits = {
      available: true,
      used,
      limit,
      left: Math.max(0, limit - used),
      resetAt: s.next_character_count_reset_unix ? new Date(s.next_character_count_reset_unix * 1000).toISOString() : null,
      tier: s.tier ?? null,
    }
    cache = { at: Date.now(), data }
    return voiceJson(data)
  } catch (e) {
    return voiceError(e)
  }
}
