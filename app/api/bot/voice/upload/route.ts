// POST /api/bot/voice/upload — iPhone Share-Sheet Shortcut "ส่งเข้า amgo" (owner 19 Nov 69), step 1 of 3.
//   body (JSON, all optional): { filename, size, contentType, recordedAt (ISO or epoch ms) }
//   → { id, uploadUrl, contentType, startUrl, pageUrl }
// Step 2: the Shortcut PUTs the audio file to uploadUrl (Supabase signed upload, straight to Storage — the file
// never passes through Vercel's 4.5 MB body limit). Step 3: POST startUrl → transcription is queued.
// Key: bot key scope 'voice' (only /api/bot/voice) or superadmin; acts as the key's acts_as user.
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi } from '@/lib/services/bot/botApi'
import { VoiceError, createUpload } from '@/lib/voice/server'

export async function POST(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  if (caller.scope !== 'voice' && caller.scope !== 'superadmin') return apiError(403, 'ต้องใช้กุญแจ voice')

  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  // Voice Memos names files "<title>.m4a"; Shortcuts may drop the extension → default to m4a.
  let filename = str(body.filename) || `เสียงประชุม ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`
  if (!/\.[a-z0-9]{2,4}$/i.test(filename)) filename += '.m4a'
  // Shortcuts can't give a byte count easily — when missing, the bucket's own 50 MB limit still applies on PUT.
  const size = Number(body.size) > 0 ? Number(body.size) : 1
  const rec = body.recordedAt
  const recordedMs = typeof rec === 'number' ? rec : typeof rec === 'string' && rec ? Date.parse(rec) : NaN

  try {
    const up = await createUpload(caller.sb, caller.user.id, {
      filename,
      contentType: str(body.contentType),
      size,
      lastModified: Number.isFinite(recordedMs) ? recordedMs : null,
    })
    const origin = request.nextUrl.origin
    return apiJson({
      id: up.id,
      uploadUrl: up.signedUrl,
      contentType: up.contentType,
      startUrl: `${origin}/api/bot/voice/${up.id}/start`,
      pageUrl: `${origin}/tasks/voice/${up.id}`,
    })
  } catch (e) {
    if (e instanceof VoiceError) return apiError(e.status, e.message)
    return apiError(500, e instanceof Error ? e.message : 'สร้างลิงก์อัปโหลดไม่สำเร็จ')
  }
}
