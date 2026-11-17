// GET /api/voice/recordings — recordings list for /tasks/voice (admin only), newest first, with draft counts.
import { requireVoiceAdmin, voiceError, voiceJson } from '@/lib/voice/server'

export async function GET() {
  try {
    const { db } = await requireVoiceAdmin()
    // Phase 1 volume is a few recordings a week — 200 newest is plenty for the list.
    const { data, error } = await db
      .from('voice_recordings')
      .select('id, title, recorded_at, duration_sec, source, status, error, created_at, audio_deleted_at, voice_task_drafts(status)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw new Error(error.message)
    const recordings = (data ?? []).map(({ voice_task_drafts: drafts, ...r }) => ({
      ...r,
      drafts: {
        pending: drafts.filter((d) => d.status === 'pending').length,
        accepted: drafts.filter((d) => d.status === 'accepted').length,
        total: drafts.length,
      },
    }))
    return voiceJson({ recordings })
  } catch (e) {
    return voiceError(e)
  }
}
