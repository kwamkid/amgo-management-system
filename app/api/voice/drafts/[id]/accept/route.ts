// POST /api/voice/drafts/[id]/accept — { title?, notes?, assignee_ids?, due_date?, brand? } (latest edits)
// → inserts a normal task (source_kind 'voice') + task_assignees. Idempotent: a second call returns the same task.
import type { NextRequest } from 'next/server'
import { acceptDraft, parseDraftEdit, requireVoiceAdmin, voiceError, voiceJson } from '@/lib/voice/server'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { me, db } = await requireVoiceAdmin()
    const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const edit = await parseDraftEdit(db, typeof body === 'object' && body ? body : {})
    return voiceJson(await acceptDraft(db, me, id, edit))
  } catch (e) {
    return voiceError(e)
  }
}
