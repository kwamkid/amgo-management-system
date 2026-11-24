// POST /api/voice/recordings/[id]/rescribe — replace the free Plaud transcript with an ElevenLabs one
// (costs credits; blocked once a draft was accepted). See rescribeRecording().
import { after, type NextRequest } from 'next/server'
import { kickQueue } from '@/lib/queue/queue'
import { rescribeRecording } from '@/lib/voice/pipeline'
import { VoiceError, requireVoiceAdmin, voiceError, voiceJson } from '@/lib/voice/server'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { me, db } = await requireVoiceAdmin()
    let status: string
    try {
      status = await rescribeRecording(db, id, me)
    } catch (e) {
      throw new VoiceError(400, e instanceof Error ? e.message : String(e))
    }
    const origin = request.nextUrl.origin
    after(() => kickQueue(origin))
    return voiceJson({ status })
  } catch (e) {
    return voiceError(e)
  }
}
