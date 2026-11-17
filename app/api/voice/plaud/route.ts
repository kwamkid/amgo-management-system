// POST /api/voice/plaud — { link: "https://web.plaud.ai/s/pub_…" } → { id, existed }
// Fast: reads the share metadata, inserts the row, and queues voice.plaud.import (the audio copy runs in the queue).
// Same Plaud file pasted twice → the existing recording (a failed import without audio is re-queued).
import { after, type NextRequest } from 'next/server'
import { kickQueue } from '@/lib/queue/queue'
import { enqueueVoice } from '@/lib/voice/pipeline'
import { VoiceError, registerPlaud, requireVoiceAdmin, voiceError, voiceJson } from '@/lib/voice/server'

export async function POST(request: NextRequest) {
  try {
    const { me, db } = await requireVoiceAdmin()
    const body = (await request.json().catch(() => null)) as { link?: unknown } | null
    const link = typeof body?.link === 'string' ? body.link.trim() : ''
    if (!link) throw new VoiceError(400, 'กรุณาวางลิงก์ Plaud')
    const r = await registerPlaud(db, me, link)
    if (r.needsImport) {
      await enqueueVoice(db, 'voice.plaud.import', r.id, { key: r.key }, { createdBy: me })
      const origin = request.nextUrl.origin
      after(() => kickQueue(origin))
    }
    return voiceJson({ id: r.id, existed: r.existed })
  } catch (e) {
    return voiceError(e)
  }
}
