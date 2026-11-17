// POST /api/voice/recordings/[id]/start — the browser finished uploadToSignedUrl → queue the transcription.
// Refused when the object is not in Storage yet.
import { after, type NextRequest } from 'next/server'
import { kickQueue } from '@/lib/queue/queue'
import { enqueueVoice } from '@/lib/voice/pipeline'
import { assertUploaded, requireVoiceAdmin, voiceError, voiceJson } from '@/lib/voice/server'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { me, db } = await requireVoiceAdmin()
    await assertUploaded(db, id)
    await enqueueVoice(db, 'voice.transcribe.start', id, {}, { createdBy: me })
    const origin = request.nextUrl.origin
    after(() => kickQueue(origin))
    return voiceJson({ ok: true })
  } catch (e) {
    return voiceError(e)
  }
}
