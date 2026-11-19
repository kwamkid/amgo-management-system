// POST /api/bot/voice/[id]/start — Shortcut step 3: the file is in Storage → queue the transcription.
// Same as /api/voice/recordings/[id]/start, but with a bot key (scope 'voice' or superadmin) instead of a session.
import { after, type NextRequest } from 'next/server'
import { kickQueue } from '@/lib/queue/queue'
import { apiError, apiJson, authBotApi, UUID } from '@/lib/services/bot/botApi'
import { enqueueVoice } from '@/lib/voice/pipeline'
import { VoiceError, assertUploaded } from '@/lib/voice/server'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  if (caller.scope !== 'voice' && caller.scope !== 'superadmin') return apiError(403, 'ต้องใช้กุญแจ voice')
  const { id } = await params
  if (!UUID.test(id)) return apiError(400, 'id ไม่ถูกต้อง')
  try {
    await assertUploaded(caller.sb, id)
    await enqueueVoice(caller.sb, 'voice.transcribe.start', id, {}, { createdBy: caller.user.id })
    const origin = request.nextUrl.origin
    after(() => kickQueue(origin))
    return apiJson({ ok: true, message: 'ได้รับไฟล์แล้ว กำลังถอดเสียง — ร่างงานจะขึ้นใน amgo ภายใน ~15 นาที', pageUrl: `${origin}/tasks/voice/${id}` })
  } catch (e) {
    if (e instanceof VoiceError) return apiError(e.status, e.message)
    return apiError(500, e instanceof Error ? e.message : 'เริ่มถอดเสียงไม่สำเร็จ')
  }
}
