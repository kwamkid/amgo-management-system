// GET    /api/voice/recordings/[id] — recording + transcript + drafts + staff list + short-lived audio URL
//        + queue progress of this recording's jobs (group voice:<id>; read with the service role — queue_jobs RLS
//          only lets web owners read, see lib/services/queueService.ts)
//        + tasks already handed out from this meeting (tasks.source_recording_id) — page groups them per person
// PATCH  /api/voice/recordings/[id] — { title?, summary?, speaker_map?: { speaker_0: <user id> | null } }
// DELETE /api/voice/recordings/[id] — remove audio + recording (transcript/drafts cascade; accepted tasks stay)
import type { NextRequest } from 'next/server'
import { BUCKET, VoiceError, getStaff, requireVoiceAdmin, voiceError, voiceJson } from '@/lib/voice/server'
import { voiceGroup } from '@/lib/voice/pipeline'
import { scribeCredits } from '@/lib/voice/format'
import type { Json } from '@/types/database'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { db } = await requireVoiceAdmin()
    const { data: recording, error } = await db
      .from('voice_recordings')
      .select('id, title, summary, recorded_at, duration_sec, source, status, error, storage_path, created_at, audio_deleted_at')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!recording) throw new VoiceError(404, 'ไม่พบไฟล์เสียงนี้')

    const [{ data: transcript }, { data: drafts, error: dErr }, people, { data: jobs }, { data: tasks }] = await Promise.all([
      db.from('voice_transcripts').select('language, segments, speaker_map, speaker_guesses, provider:raw->>provider, scribe_sec:raw->>duration_sec').eq('recording_id', id).maybeSingle(),
      db
        .from('voice_task_drafts')
        .select('id, sort_order, title, notes, assignee_ids, assignee_raw, due_date, brand, evidence_quote, evidence_start_sec, confidence, status, task_id')
        .eq('recording_id', id)
        .order('sort_order')
        .order('id')
        .limit(1000),
      getStaff(db, false),
      db.from('queue_jobs').select('status, label, kind').eq('group_key', voiceGroup(id)).order('id').limit(100),
      db
        .from('tasks')
        .select('id, no, title, status, due_date, brand, task_assignees(user_id)')
        .eq('source_recording_id', id)
        .order('no')
        .limit(500),
    ])
    if (dErr) throw new Error(dErr.message)

    let audioUrl: string | null = null
    if (recording.storage_path) {
      const s = await db.storage.from(BUCKET).createSignedUrl(recording.storage_path, 3600)
      audioUrl = s.data?.signedUrl ?? null
    }
    const { storage_path: _path, ...rec } = recording
    void _path
    const rows = jobs ?? []
    const failed = rows.filter((j) => j.status === 'failed').length
    const done = rows.filter((j) => j.status === 'done').length + failed
    const queue = {
      total: rows.length,
      done,
      failed,
      active: done < rows.length,
      running: rows.filter((j) => j.status === 'running').map((j) => j.label ?? j.kind),
      waiting: rows.filter((j) => j.status === 'queued').map((j) => j.label ?? j.kind),
    }
    const handedOut = (tasks ?? []).map(({ task_assignees, ...t }) => ({ ...t, assignee_ids: task_assignees.map((a) => a.user_id) }))
    // credits this clip used on ElevenLabs (null = transcript came from elsewhere)
    const { provider, scribe_sec, ...tr } = (transcript ?? {}) as NonNullable<typeof transcript>
    const credits = transcript && provider === 'elevenlabs' && Number(scribe_sec) > 0 ? scribeCredits(Number(scribe_sec)) : null
    return voiceJson({ recording: { ...rec, credits, transcript_provider: transcript ? (provider ?? null) : null }, transcript: transcript ? tr : null, drafts: drafts ?? [], tasks: handedOut, people, audioUrl, queue })
  } catch (e) {
    return voiceError(e)
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { db } = await requireVoiceAdmin()
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') throw new VoiceError(400, 'body ต้องเป็น JSON')

    if (typeof body.title === 'string') {
      const title = body.title.replace(/\s+/g, ' ').trim().slice(0, 300)
      if (!title) throw new VoiceError(400, 'ต้องมีชื่อ')
      const { error } = await db.from('voice_recordings').update({ title }).eq('id', id)
      if (error) throw new Error(error.message)
    }

    if (typeof body.summary === 'string') {
      const summary = body.summary.trim().slice(0, 20000)
      const { error } = await db.from('voice_recordings').update({ summary: summary || null }).eq('id', id)
      if (error) throw new Error(error.message)
    }

    if (body.speaker_map !== undefined) {
      const raw = body.speaker_map
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new VoiceError(400, 'speaker_map ไม่ถูกต้อง')
      const staff = new Set((await getStaff(db, false)).map((p) => p.user_id))
      const map: Record<string, string> = {}
      for (const [speaker, uid] of Object.entries(raw as Record<string, unknown>)) {
        if (!/^speaker_\d+$/.test(speaker)) throw new VoiceError(400, `ชื่อผู้พูดไม่ถูกต้อง: ${speaker}`)
        if (uid === null || uid === '') continue
        if (typeof uid !== 'string' || !staff.has(uid)) throw new VoiceError(400, 'มีคนที่ไม่ใช่พนักงานที่ใช้งานอยู่')
        map[speaker] = uid
      }
      const { data, error } = await db
        .from('voice_transcripts')
        .update({ speaker_map: map as Json })
        .eq('recording_id', id)
        .select('recording_id')
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new VoiceError(404, 'ยังไม่มีข้อความถอดเสียง')
    }
    return voiceJson({ ok: true })
  } catch (e) {
    return voiceError(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { db } = await requireVoiceAdmin()
    const { data: rec } = await db.from('voice_recordings').select('storage_path').eq('id', id).maybeSingle()
    if (!rec) throw new VoiceError(404, 'ไม่พบไฟล์เสียงนี้')
    if (rec.storage_path) {
      const rm = await db.storage.from(BUCKET).remove([rec.storage_path])
      if (rm.error) throw new Error(`ลบไฟล์เสียงไม่สำเร็จ: ${rm.error.message}`)
    }
    const { error } = await db.from('voice_recordings').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return voiceJson({ ok: true })
  } catch (e) {
    return voiceError(e)
  }
}
