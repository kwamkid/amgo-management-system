// Voice → Tasks server logic (plan: project/jobs/plans/voice-tasks.md). Server only — uses the service role.
// Admin guard, inputs (Plaud link / web upload), audio cleanup and the review/accept flow.
// The pipeline itself (transcribe → extract) runs on the central queue: lib/voice/pipeline.ts.
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'
import { BRANDS } from '@/lib/constants/brands'
import { parsePlaudShareKey, resolvePlaudShare } from '@/lib/voice/plaud'
import type { RosterPerson } from '@/lib/voice/extract'

export type Db = ReturnType<typeof createAdminClient>
export type VoiceStatus = 'uploaded' | 'transcribing' | 'extracting' | 'review' | 'done' | 'failed'

export const BUCKET = 'voice-audio'
export const AGD_CODE = 'AGD'
export const MAX_BYTES = 50 * 1024 * 1024 // bucket file_size_limit
export const AUDIO_RETENTION_DAYS = 90

/** Upload types the bucket accepts → file extension we store under. */
export const AUDIO_TYPES: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
}
const EXT_TYPES: Record<string, string> = { ogg: 'audio/ogg', opus: 'audio/opus', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', webm: 'audio/webm' }

export class VoiceError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export const voiceJson = (body: unknown, status = 200) => Response.json(body, { status })
export const voiceError = (e: unknown) => {
  if (e instanceof VoiceError) return voiceJson({ error: e.message }, e.status)
  console.error('[voice]', e)
  return voiceJson({ error: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด' }, 500)
}

/** Admin only (Phase 1: the owner uploads and reviews). Throws VoiceError 401/403. */
export async function requireVoiceAdmin(): Promise<{ me: string; db: Db }> {
  const cur = await getCurrentUser()
  if (!cur) throw new VoiceError(401, 'กรุณาเข้าสู่ระบบ')
  if (cur.profile.role !== 'admin') throw new VoiceError(403, 'เฉพาะแอดมิน')
  return { me: cur.profile.id, db: createAdminClient() }
}

// ── people / company ─────────────────────────────────────────────────────

export async function agdCompanyId(db: Db): Promise<string | null> {
  const { data } = await db.from('companies').select('id').eq('code', AGD_CODE).maybeSingle()
  return data?.id ?? null
}

export interface StaffPerson extends RosterPerson {
  company: string | null
}

/** Active staff (small team — well under the 1,000-row cap). onlyAgd = the extraction roster. */
export async function getStaff(db: Db, onlyAgd: boolean): Promise<StaffPerson[]> {
  let q = db
    .from('users')
    .select('id, nickname, full_name, company:companies!users_company_id_fkey(code)')
    .eq('is_active', true)
    .eq('is_system', false)
    .is('deleted_at', null)
  if (onlyAgd) {
    const cid = await agdCompanyId(db)
    if (cid) q = q.eq('company_id', cid)
  }
  const { data, error } = await q.order('id').limit(1000)
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as { id: string; nickname: string | null; full_name: string; company: { code: string } | null }[])
    .map((u) => ({ user_id: u.id, nickname: u.nickname, full_name: u.full_name, company: u.company?.code ?? null }))
    .sort((a, b) => (a.nickname || a.full_name).localeCompare(b.nickname || b.full_name, 'th'))
}

/** Scribe keyterms: brand names + staff nicknames (max 100). */
export function keyterms(roster: RosterPerson[]): string[] {
  const terms = [...BRANDS.map((b) => b.label), 'AGD', ...roster.map((p) => p.nickname?.trim() ?? '')]
  return [...new Set(terms.filter((t) => t && t.length <= 50))].slice(0, 100)
}

// ── inputs ───────────────────────────────────────────────────────────────

/**
 * Paste a Plaud share link → read the metadata (fast) → new row (or the existing one for the same file).
 * The audio copy happens in the queue job voice.plaud.import (the 1-h audio URL is re-resolved there).
 * Returns needsImport = true when the caller must enqueue that job.
 */
export async function registerPlaud(
  db: Db,
  me: string,
  link: string,
): Promise<{ id: string; existed: boolean; key: string; needsImport: boolean }> {
  const key = parsePlaudShareKey(link)
  if (!key) throw new VoiceError(400, 'ไม่ใช่ลิงก์แชร์ของ Plaud (https://web.plaud.ai/s/…)')
  let share
  try {
    share = await resolvePlaudShare(link)
  } catch (e) {
    throw new VoiceError(400, `อ่านลิงก์ Plaud ไม่ได้: ${e instanceof Error ? e.message : e}`)
  }
  const existing = await findPlaud(db, share.fileId)
  if (existing) {
    // Earlier import failed before the audio was copied → reset and import again with this (fresh) link.
    if (existing.status === 'failed' && !existing.storage_path) {
      const { data } = await db
        .from('voice_recordings')
        .update({ status: 'uploaded', error: null })
        .eq('id', existing.id)
        .eq('status', 'failed')
        .select('id')
        .maybeSingle()
      return { id: existing.id, existed: true, key, needsImport: !!data }
    }
    return { id: existing.id, existed: true, key, needsImport: false }
  }

  const id = crypto.randomUUID()
  const { error } = await db.from('voice_recordings').insert({
    id,
    title: share.title,
    recorded_at: share.recordedAt.toISOString(),
    duration_sec: share.durationSec,
    source: 'plaud',
    external_id: share.fileId,
    storage_path: null,
    status: 'uploaded',
    uploaded_by: me,
    company_id: await agdCompanyId(db),
  })
  if (error) {
    const again = await findPlaud(db, share.fileId) // lost a race on the unique index
    if (again) return { id: again.id, existed: true, key, needsImport: false }
    throw new Error(error.message)
  }
  return { id, existed: false, key, needsImport: true }
}

async function findPlaud(db: Db, fileId: string) {
  const { data } = await db
    .from('voice_recordings')
    .select('id, status, storage_path')
    .eq('source', 'plaud')
    .eq('external_id', fileId)
    .maybeSingle()
  return data
}

/** Web upload: create the row + a signed upload URL; the browser sends the file straight to Storage. */
export async function createUpload(
  db: Db,
  me: string,
  input: { filename: string; contentType: string; size: number; lastModified?: number | null },
): Promise<{ id: string; path: string; token: string; contentType: string; signedUrl: string }> {
  const name = input.filename.trim().slice(0, 200)
  const extFromName = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  const contentType = AUDIO_TYPES[input.contentType] ? input.contentType : EXT_TYPES[extFromName]
  if (!contentType) throw new VoiceError(400, 'รองรับเฉพาะไฟล์เสียง .m4a .mp3 .wav .ogg .webm')
  if (!(input.size > 0)) throw new VoiceError(400, 'ไฟล์ว่าง')
  if (input.size > MAX_BYTES) throw new VoiceError(413, 'ไฟล์เสียงใหญ่เกิน 50 MB')

  const id = crypto.randomUUID()
  const path = `${id}.${AUDIO_TYPES[contentType]}`
  const recordedAt = input.lastModified && Number.isFinite(input.lastModified) ? new Date(input.lastModified).toISOString() : null
  const { error } = await db.from('voice_recordings').insert({
    id,
    title: name.replace(/\.[^.]+$/, '') || 'ไฟล์เสียง',
    recorded_at: recordedAt,
    source: 'upload',
    storage_path: path,
    status: 'uploaded',
    uploaded_by: me,
    company_id: await agdCompanyId(db),
  })
  if (error) throw new Error(error.message)

  const signed = await db.storage.from(BUCKET).createSignedUploadUrl(path)
  if (signed.error) {
    await db.from('voice_recordings').delete().eq('id', id)
    throw new Error(`สร้างลิงก์อัปโหลดไม่สำเร็จ: ${signed.error.message}`)
  }
  return { id, path: signed.data.path, token: signed.data.token, contentType, signedUrl: signed.data.signedUrl }
}

/** Browser says the upload finished — check the object really exists before queueing transcription. */
export async function assertUploaded(db: Db, id: string): Promise<void> {
  const { data: rec } = await db.from('voice_recordings').select('status, storage_path').eq('id', id).maybeSingle()
  if (!rec) throw new VoiceError(404, 'ไม่พบไฟล์เสียงนี้')
  if (rec.status !== 'uploaded') throw new VoiceError(409, 'ไฟล์นี้เริ่มถอดเสียงไปแล้ว')
  if (!rec.storage_path) throw new VoiceError(400, 'ยังไม่มีไฟล์เสียง')
  const s = await db.storage.from(BUCKET).createSignedUrl(rec.storage_path, 60)
  if (s.error || !s.data?.signedUrl) throw new VoiceError(400, 'ยังไม่พบไฟล์ใน Storage — อัปโหลดใหม่')
}

// ── cron helpers ─────────────────────────────────────────────────────────

export async function cleanupOldAudio(db: Db, limit = 50): Promise<{ files: number; remaining: boolean }> {
  const cutoff = new Date(Date.now() - AUDIO_RETENTION_DAYS * 86_400_000).toISOString()
  const { data, error } = await db
    .from('voice_recordings')
    .select('id, storage_path')
    .not('storage_path', 'is', null)
    .lt('created_at', cutoff)
    .order('created_at')
    .limit(limit)
  if (error) throw new Error(error.message)
  const rows = (data ?? []).filter((r): r is { id: string; storage_path: string } => !!r.storage_path)
  if (!rows.length) return { files: 0, remaining: false }
  const rm = await db.storage.from(BUCKET).remove(rows.map((r) => r.storage_path))
  if (rm.error) throw new Error(`ลบไฟล์เสียงไม่สำเร็จ: ${rm.error.message}`)
  const { error: upErr } = await db
    .from('voice_recordings')
    .update({ storage_path: null, audio_deleted_at: new Date().toISOString() })
    .in('id', rows.map((r) => r.id))
  if (upErr) throw new Error(upErr.message)
  return { files: rows.length, remaining: rows.length === limit }
}

// ── review ───────────────────────────────────────────────────────────────

const YMD = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface DraftEdit {
  title?: string
  notes?: string
  assignee_ids?: string[]
  due_date?: string | null
  brand?: string | null
}

/** Validate an edit from the page. Unknown/blank fields are dropped; assignees must be active staff. */
export async function parseDraftEdit(db: Db, body: Record<string, unknown>): Promise<DraftEdit> {
  const out: DraftEdit = {}
  if (typeof body.title === 'string') {
    const t = body.title.replace(/\s+/g, ' ').trim().slice(0, 300)
    if (!t) throw new VoiceError(400, 'ต้องมีชื่องาน')
    out.title = t
  }
  if (typeof body.notes === 'string') out.notes = body.notes.trim().slice(0, 5000)
  if (body.due_date !== undefined) {
    if (body.due_date !== null && (typeof body.due_date !== 'string' || !YMD.test(body.due_date)))
      throw new VoiceError(400, 'วันครบกำหนดไม่ถูกต้อง')
    out.due_date = body.due_date as string | null
  }
  if (body.brand !== undefined) {
    out.brand = typeof body.brand === 'string' && body.brand.trim() ? body.brand.trim().toLowerCase().slice(0, 50) : null
  }
  if (body.assignee_ids !== undefined) {
    if (!Array.isArray(body.assignee_ids) || body.assignee_ids.some((x) => typeof x !== 'string' || !UUID.test(x)))
      throw new VoiceError(400, 'ผู้รับผิดชอบไม่ถูกต้อง')
    const ids = [...new Set(body.assignee_ids as string[])]
    if (ids.length) {
      const staff = new Set((await getStaff(db, false)).map((p) => p.user_id))
      if (ids.some((x) => !staff.has(x))) throw new VoiceError(400, 'มีผู้รับผิดชอบที่ไม่ใช่พนักงานที่ใช้งานอยู่')
    }
    out.assignee_ids = ids
  }
  return out
}

/** All drafts decided → recording 'done'; a draft reopened → back to 'review'. */
export async function syncRecordingDone(db: Db, recordingId: string) {
  const { count } = await db
    .from('voice_task_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('recording_id', recordingId)
    .eq('status', 'pending')
  if ((count ?? 0) === 0) await db.from('voice_recordings').update({ status: 'done' }).eq('id', recordingId).eq('status', 'review')
  else await db.from('voice_recordings').update({ status: 'review' }).eq('id', recordingId).eq('status', 'done')
}

/** Accept a draft → a normal task (+ assignees). Idempotent: an accepted draft returns its task, never a second one. */
export async function acceptDraft(db: Db, me: string, draftId: string, edit: DraftEdit): Promise<{ taskId: string; already: boolean }> {
  const { data: d, error } = await db
    .from('voice_task_drafts')
    .select('id, recording_id, status, task_id, title, notes, assignee_ids, due_date, brand')
    .eq('id', draftId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!d) throw new VoiceError(404, 'ไม่พบร่างงานนี้')
  if (d.status === 'accepted') {
    if (d.task_id) return { taskId: d.task_id, already: true }
    throw new VoiceError(409, 'ร่างงานนี้กำลังถูกสร้างเป็นงานอยู่')
  }
  if (d.status !== 'pending') throw new VoiceError(409, 'ร่างงานนี้ถูกปัดตกแล้ว — เปิดกลับก่อนจึงจะรับได้')

  // Claim the draft first (status pending → accepted) so a double click cannot insert two tasks.
  const { data: claimed } = await db
    .from('voice_task_drafts')
    .update({ status: 'accepted', ...edit })
    .eq('id', draftId)
    .eq('status', 'pending')
    .select('title, notes, assignee_ids, due_date, brand')
    .maybeSingle()
  if (!claimed) {
    const { data: again } = await db.from('voice_task_drafts').select('task_id').eq('id', draftId).maybeSingle()
    if (again?.task_id) return { taskId: again.task_id, already: true }
    throw new VoiceError(409, 'ร่างงานนี้เปลี่ยนสถานะไปแล้ว ลองโหลดหน้าใหม่')
  }

  try {
    const { data: rec } = await db.from('voice_recordings').select('title').eq('id', d.recording_id).maybeSingle()
    const backLink = `จากเสียงประชุม: ${rec?.title || 'ไม่มีชื่อ'}`
    const notes = claimed.notes ? `${claimed.notes}\n\n${backLink}` : backLink

    // New tasks go to the top of "ต้องทำ" (same rule as the web board and the bot API).
    const { data: top } = await db.from('tasks').select('sort_order').eq('status', 'todo').order('sort_order').limit(1).maybeSingle()
    const { data: task, error: tErr } = await db
      .from('tasks')
      .insert({
        title: claimed.title,
        notes,
        brand: claimed.brand,
        due_date: claimed.due_date,
        status: 'todo',
        sort_order: (top?.sort_order ?? 1) - 1,
        created_by: me,
        source_kind: 'voice',
        source_recording_id: d.recording_id,
      })
      .select('id')
      .single()
    if (tErr) throw new Error(tErr.message)

    if (claimed.assignee_ids.length) {
      const { error: aErr } = await db
        .from('task_assignees')
        .insert(claimed.assignee_ids.map((user_id) => ({ task_id: task.id, user_id })))
      if (aErr) {
        await db.from('tasks').delete().eq('id', task.id)
        throw new Error(`ใส่ผู้รับผิดชอบไม่สำเร็จ: ${aErr.message}`)
      }
    }
    await db.from('voice_task_drafts').update({ task_id: task.id }).eq('id', draftId)
    await syncRecordingDone(db, d.recording_id)
    return { taskId: task.id, already: false }
  } catch (e) {
    await db.from('voice_task_drafts').update({ status: 'pending' }).eq('id', draftId).is('task_id', null)
    throw e
  }
}
