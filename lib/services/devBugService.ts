// Dev tracker — bug reports, browser-side (RLS + triggers do the permission work, migration 20261123120000_dev_bugs)
// Status moves only through the dev_bug_set_status RPC (it writes the history). Pictures: dev-shots `bugs/<project id>/…`.

import { createClient } from '@/lib/supabase/client'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import { resizeImage } from '@/lib/utils/resizeImage'
import { SHOT_BUCKET, type UatDevice, type UatEnvironment } from '@/lib/dev/uat'
import { BUG_MAX_SHOTS, bugShotFolder, type BugEvent, type BugSeverity, type BugStatus, type DevBug } from '@/lib/dev/bugs'

const db = () => createClient()
const SIGNED_TTL = 60 * 60 * 24

type Person = { full_name: string; nickname: string | null } | null
const personName = (u: Person) => (u ? u.nickname || u.full_name : null)

type BugRow = {
  id: string
  project_id: string
  no: number
  title: string
  steps: string | null
  expected: string | null
  actual: string | null
  environment: UatEnvironment
  device: UatDevice
  page_url: string | null
  severity: BugSeverity
  status: BugStatus
  shots: string[] | null
  reported_by: string | null
  assignee_id: string | null
  uat_case_id: string | null
  fix_note: string | null
  close_reason: string | null
  source: string | null
  sort_order: number | null
  closed_at: string | null
  created_at: string
  updated_at: string
  reporter: Person
  assignee: Person
  uat: { no: number } | null
}

export const BUG_COLS =
  'id, project_id, no, title, steps, expected, actual, environment, device, page_url, severity, status, shots, reported_by, ' +
  'assignee_id, uat_case_id, fix_note, close_reason, source, sort_order, closed_at, created_at, updated_at, ' +
  'reporter:users!dev_bugs_reported_by_fkey(full_name, nickname), assignee:users!dev_bugs_assignee_id_fkey(full_name, nickname), ' +
  'uat:dev_uat_cases(no)'

const toBug = (r: BugRow): DevBug => ({
  id: r.id,
  projectId: r.project_id,
  no: r.no,
  title: r.title,
  steps: r.steps,
  expected: r.expected,
  actual: r.actual,
  environment: r.environment,
  device: r.device,
  pageUrl: r.page_url,
  severity: r.severity,
  status: r.status,
  shots: Array.isArray(r.shots) ? r.shots : [],
  reportedBy: r.reported_by,
  reporterName: personName(r.reporter),
  assigneeId: r.assignee_id,
  assigneeName: personName(r.assignee),
  uatCaseId: r.uat_case_id,
  uatCaseNo: r.uat?.no ?? null,
  fixNote: r.fix_note,
  closeReason: r.close_reason,
  source: r.source,
  sortOrder: r.sort_order ?? r.no,
  closedAt: r.closed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const CLOSED_SHOWN = 60

/** บั๊กของโปรเจกต์: ที่ยังเปิดทั้งหมด + ที่ปิดล่าสุด */
export async function getBugs(projectId: string): Promise<DevBug[]> {
  const [open, closed] = await Promise.all([
    db().from('dev_bugs').select(BUG_COLS).eq('project_id', projectId).not('status', 'in', '(closed,wont_fix)')
      .order('sort_order', { nullsFirst: false }).order('no').limit(2000),
    db().from('dev_bugs').select(BUG_COLS).eq('project_id', projectId).in('status', ['closed', 'wont_fix'])
      .order('closed_at', { ascending: false }).limit(CLOSED_SHOWN),
  ])
  const error = open.error ?? closed.error
  if (error) throw new Error(`ดึงบั๊กไม่สำเร็จ: ${error.message}`)
  return [...((open.data ?? []) as unknown as BugRow[]), ...((closed.data ?? []) as unknown as BugRow[])].map(toBug)
}

/** บั๊กที่แจ้งจากเคส UAT นี้ (โชว์ในเคส) */
export async function getBugsOfCase(caseId: string): Promise<DevBug[]> {
  const { data, error } = await db().from('dev_bugs').select(BUG_COLS).eq('uat_case_id', caseId).order('no')
  if (error) throw new Error(`ดึงบั๊กไม่สำเร็จ: ${error.message}`)
  return ((data ?? []) as unknown as BugRow[]).map(toBug)
}

/** จำนวนบั๊กที่ยังเปิดต่อโปรเจกต์ (หน้ารวมโปรเจกต์) */
export async function getOpenBugCounts(): Promise<Record<string, number>> {
  const { data, error } = await db().from('dev_bugs').select('project_id').not('status', 'in', '(closed,wont_fix)').limit(5000)
  if (error) throw new Error(`ดึงบั๊กไม่สำเร็จ: ${error.message}`)
  const out: Record<string, number> = {}
  for (const r of (data ?? []) as { project_id: string }[]) out[r.project_id] = (out[r.project_id] ?? 0) + 1
  return out
}

export interface BugInput {
  title: string
  steps?: string | null
  expected?: string | null
  actual?: string | null
  environment?: UatEnvironment
  device?: UatDevice
  pageUrl?: string | null
  severity?: BugSeverity
  uatCaseId?: string | null
}

function bugRow(input: Partial<BugInput>): TablesUpdate<'dev_bugs'> {
  const p: TablesUpdate<'dev_bugs'> = {}
  const text = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null)
  if (input.title !== undefined) p.title = input.title.trim()
  if (input.steps !== undefined) p.steps = text(input.steps)
  if (input.expected !== undefined) p.expected = text(input.expected)
  if (input.actual !== undefined) p.actual = text(input.actual)
  if (input.environment !== undefined) p.environment = input.environment
  if (input.device !== undefined) p.device = input.device
  if (input.pageUrl !== undefined) p.page_url = text(input.pageUrl)
  if (input.severity !== undefined) p.severity = input.severity
  if (input.uatCaseId !== undefined) p.uat_case_id = input.uatCaseId
  return p
}

/** only files uploaded for bugs — a bug reported from a UAT result points at the result's pictures, never delete those */
const ownShots = (paths: string[]) => paths.filter((p) => p.startsWith('bugs/'))

/** ย่อรูป 1600 JPEG แล้วอัปทีละรูป (Vercel จำกัด body) → path ใน dev-shots */
async function uploadShots(projectId: string, files: File[]): Promise<string[]> {
  const sb = db()
  const paths: string[] = []
  for (const file of files) {
    const blob = await resizeImage(file, { maxSide: 1600, quality: 0.82 })
    const path = `${bugShotFolder(projectId)}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
    const { error } = await sb.storage.from(SHOT_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) {
      if (paths.length) await sb.storage.from(SHOT_BUCKET).remove(paths)
      throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${error.message}`)
    }
    paths.push(path)
  }
  return paths
}

/** แจ้งบั๊ก (ผู้เทส/ผู้จัดการ) — รูป 0–8 · ต่อท้ายคอลัมน์ใหม่ · คืนเลข */
/** existing = รูปที่มีอยู่แล้ว (รูปผลเทส UAT ตอนแจ้งจากเคส) — ใช้ path เดิม ไม่ copy */
export async function createBug(
  projectId: string,
  input: BugInput,
  files: File[],
  reporterId: string,
  existing: string[] = []
): Promise<{ id: string; no: number }> {
  if (!input.title.trim()) throw new Error('ใส่ชื่อบั๊กก่อน')
  if (existing.length + files.length > BUG_MAX_SHOTS) throw new Error(`แนบได้ไม่เกิน ${BUG_MAX_SHOTS} รูป`)
  const added = await uploadShots(projectId, files)
  const shots = [...existing, ...added]
  const { data, error } = await db()
    .from('dev_bugs')
    .insert({ project_id: projectId, reported_by: reporterId, sort_order: Date.now() / 1000, shots, ...bugRow(input) } as TablesInsert<'dev_bugs'>) // no/title: trigger + checked above
    .select('id, no')
    .single()
  if (error) {
    if (added.length) await db().storage.from(SHOT_BUCKET).remove(added)
    throw new Error(`แจ้งบั๊กไม่สำเร็จ: ${error.message}`)
  }
  return data as { id: string; no: number }
}

/** แก้รายละเอียด (ผู้จัดการ หรือคนแจ้งตอนยังเป็น "ใหม่") · keepShots = รูปเดิมที่ยังเก็บ + ไฟล์ใหม่ */
export async function updateBug(bug: Pick<DevBug, 'id' | 'projectId' | 'shots'>, input: Partial<BugInput>, keepShots?: string[], files: File[] = []): Promise<void> {
  const patch = bugRow(input)
  let added: string[] = []
  if (keepShots) {
    if (keepShots.length + files.length > BUG_MAX_SHOTS) throw new Error(`แนบได้ไม่เกิน ${BUG_MAX_SHOTS} รูป`)
    added = await uploadShots(bug.projectId, files)
    patch.shots = [...keepShots, ...added]
  }
  const { error } = await db().from('dev_bugs').update(patch).eq('id', bug.id)
  if (error) {
    if (added.length) await db().storage.from(SHOT_BUCKET).remove(added)
    throw new Error(`บันทึกบั๊กไม่สำเร็จ: ${error.message.replace(/^.*?: /, '')}`)
  }
  const dropped = keepShots ? ownShots(bug.shots.filter((s) => !keepShots.includes(s))) : []
  if (dropped.length) await db().storage.from(SHOT_BUCKET).remove(dropped).catch(() => {})
}

/** เลขเคส UAT → id (ต้องอยู่ในโปรเจกต์เดียวกับบั๊ก) */
export async function findUatCaseId(projectId: string, no: number): Promise<string> {
  const { data, error } = await db().from('dev_uat_cases').select('id').match({ project_id: projectId, no }).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error(`ไม่พบ UAT-${String(no).padStart(4, '0')} ในโปรเจกต์นี้`)
  return (data as { id: string }).id
}

export async function assignBug(id: string, assigneeId: string | null): Promise<void> {
  const { error } = await db().from('dev_bugs').update({ assignee_id: assigneeId }).eq('id', id)
  if (error) throw new Error(`มอบหมายไม่สำเร็จ: ${error.message}`)
}

export async function moveBug(id: string, sortOrder: number): Promise<void> {
  const { error } = await db().from('dev_bugs').update({ sort_order: sortOrder }).eq('id', id)
  if (error) throw new Error(`ย้ายไม่สำเร็จ: ${error.message}`)
}

/** เปลี่ยนสถานะ (ผู้จัดการ: ทุกทาง · ผู้เทส: รอเทส → ปิดแล้ว / กำลังแก้) · note = สิ่งที่แก้ (→ รอเทส) · เหตุผล (ไม่แก้) · เจออะไร (ยังไม่หาย) */
export async function setBugStatus(id: string, status: BugStatus, note?: string | null, sortOrder?: number): Promise<void> {
  const { error } = await db().rpc('dev_bug_set_status', {
    p_bug_id: id,
    p_status: status,
    p_note: note?.trim() || undefined,
    p_sort_order: sortOrder,
  })
  if (error) throw new Error(error.message.replace(/^.*?: /, ''))
}

export async function deleteBug(bug: Pick<DevBug, 'id' | 'shots'>): Promise<void> {
  const { error } = await db().from('dev_bugs').delete().eq('id', bug.id)
  if (error) throw new Error(`ลบบั๊กไม่สำเร็จ: ${error.message}`)
  const own = ownShots(bug.shots)
  if (own.length) await db().storage.from(SHOT_BUCKET).remove(own).catch(() => {})
}

export async function getBugEvents(bugId: string): Promise<BugEvent[]> {
  const { data, error } = await db()
    .from('dev_bug_events')
    .select('id, actor_name, kind, from_status, to_status, note, created_at')
    .eq('bug_id', bugId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`ดึงประวัติไม่สำเร็จ: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    actorName: r.actor_name as string | null,
    kind: r.kind as BugEvent['kind'],
    fromStatus: r.from_status as BugStatus | null,
    toStatus: r.to_status as BugStatus | null,
    note: r.note as string | null,
    createdAt: r.created_at as string,
  }))
}

/** รูป → signed URL (path → url) */
export async function signBugShots(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data } = await db().storage.from(SHOT_BUCKET).createSignedUrls(paths, SIGNED_TTL)
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]))
}
