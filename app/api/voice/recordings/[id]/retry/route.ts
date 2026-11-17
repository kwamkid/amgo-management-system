// POST /api/voice/recordings/[id]/retry — a failed recording: queue the step that failed again
// (transcript exists → extract · audio exists → transcribe · Plaud without audio → import).
import { after, type NextRequest } from 'next/server'
import { kickQueue } from '@/lib/queue/queue'
import { retryRecording } from '@/lib/voice/pipeline'
import { requireVoiceAdmin, voiceError, voiceJson } from '@/lib/voice/server'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { me, db } = await requireVoiceAdmin()
    const status = await retryRecording(db, id, me)
    const origin = request.nextUrl.origin
    after(() => kickQueue(origin))
    return voiceJson({ status })
  } catch (e) {
    return voiceError(e)
  }
}
