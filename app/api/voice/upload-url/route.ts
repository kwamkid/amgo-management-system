// POST /api/voice/upload-url — { filename, contentType, size, lastModified? } → { id, path, token, contentType }
// The browser then uploads straight to Storage (uploadToSignedUrl) — never through this route (Vercel 4.5 MB body
// limit) — and only after that succeeds calls POST /api/voice/recordings/[id]/process.
import type { NextRequest } from 'next/server'
import { VoiceError, createUpload, requireVoiceAdmin, voiceError, voiceJson } from '@/lib/voice/server'

export async function POST(request: NextRequest) {
  try {
    const { me, db } = await requireVoiceAdmin()
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body.filename !== 'string' || typeof body.size !== 'number')
      throw new VoiceError(400, 'ต้องมี filename และ size')
    return voiceJson(
      await createUpload(db, me, {
        filename: body.filename,
        contentType: typeof body.contentType === 'string' ? body.contentType : '',
        size: body.size,
        lastModified: typeof body.lastModified === 'number' ? body.lastModified : null,
      }),
    )
  } catch (e) {
    return voiceError(e)
  }
}
