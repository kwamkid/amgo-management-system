// PATCH /api/voice/drafts/[id] — edit a pending draft and/or reject / reopen it
//   { title?, notes?, assignee_ids?, due_date?, brand?, status?: 'rejected' | 'pending' }
// Accepting goes through POST /api/voice/drafts/[id]/accept (creates the task).
import type { NextRequest } from 'next/server'
import { VoiceError, parseDraftEdit, requireVoiceAdmin, syncRecordingDone, voiceError, voiceJson } from '@/lib/voice/server'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { db } = await requireVoiceAdmin()
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') throw new VoiceError(400, 'body ต้องเป็น JSON')

    const { data: d } = await db.from('voice_task_drafts').select('recording_id, status').eq('id', id).maybeSingle()
    if (!d) throw new VoiceError(404, 'ไม่พบร่างงานนี้')
    if (d.status === 'accepted') throw new VoiceError(409, 'ร่างนี้สร้างเป็นงานแล้ว — แก้ที่หน้างานของทีม')

    const edit = await parseDraftEdit(db, body)
    const status = body.status === 'rejected' || body.status === 'pending' ? body.status : undefined
    const { data, error } = await db
      .from('voice_task_drafts')
      .update({ ...edit, ...(status && { status }) })
      .eq('id', id)
      .neq('status', 'accepted')
      .select('id, status')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new VoiceError(409, 'ร่างนี้สร้างเป็นงานแล้ว')
    if (status) await syncRecordingDone(db, d.recording_id)
    return voiceJson({ draft: data })
  } catch (e) {
    return voiceError(e)
  }
}
