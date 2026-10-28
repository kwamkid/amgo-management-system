// งานของทีม (tasks + task_assignees) — สิทธิ์อยู่ที่ RLS ทั้งหมด
// ทุกคนเห็นทุกงาน · แก้ได้: แอดมิน · คนสร้าง · ผู้รับผิดชอบ (สถานะ/โน้ต) · มอบงานคนอื่นได้เฉพาะแอดมิน

import { createClient } from '@/lib/supabase/client'
import { getImageUrls } from '@/lib/supabase/storage'
import { resizeImage } from '@/lib/utils/resizeImage'
import type { Database } from '@/types/database'
import type { ManualUpdateKind, TaskStatusLine, TaskUpdateKind } from '@/lib/tasks/updates'

export type TaskStatus = 'todo' | 'doing' | 'done'

export const TASK_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'ต้องทำ' },
  { status: 'doing', label: 'กำลังทำ' },
  { status: 'done', label: 'เสร็จแล้ว' },
]

/** คนในทีม — โชว์ด้วยรูป + ชื่อเล่น (ที่ทำงานเรียกกันด้วยชื่อเล่น) */
export interface TaskPerson {
  userId: string
  name: string
}

/** พนักงานที่ใช้งานอยู่ — ใช้ทั้งตัวกรองและช่องเลือกผู้รับผิดชอบ */
export async function getTaskPeople(): Promise<TaskPerson[]> {
  const { data, error } = await createClient()
    .from('users')
    .select('id, nickname, full_name')
    .eq('is_active', true)
    .eq('is_system', false)
    .is('deleted_at', null)
  if (error) throw error
  return (data ?? [])
    .map((u) => ({ userId: u.id, name: u.nickname || u.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))
}

export interface Task {
  id: string
  title: string
  notes: string
  brand: string | null
  sourceRef: string | null
  dueDate: string | null
  status: TaskStatus
  sortOrder: number
  doneAt: string | null
  createdBy: string | null
  createdAt: string
  assignees: TaskPerson[]
  imageCount: number
  /** รูปแรกของงาน (ลากเรียงได้) — โชว์เป็นปกบนการ์ด */
  coverUrl: string | null
  /** งานติดอยู่ตรงไหน — รายการล่าสุดในไทม์ไลน์ (ไม่นับเลื่อนวัน) */
  statusLine: TaskStatusLine | null
}

interface TaskRow {
  id: string
  title: string
  notes: string
  brand: string | null
  source_ref: string | null
  due_date: string | null
  status: TaskStatus
  sort_order: number
  done_at: string | null
  created_by: string | null
  created_at: string
  task_assignees: { user_id: string }[]
  task_images: { count: number }[]
}

export async function getTasks(people: TaskPerson[]): Promise<Task[]> {
  const sb = createClient()
  const [{ data, error }, lines, covers] = await Promise.all([
    sb
      .from('tasks')
      .select('id, title, notes, brand, source_ref, due_date, status, sort_order, done_at, created_by, created_at, task_assignees(user_id), task_images(count)')
      .order('sort_order')
      .order('created_at', { ascending: false }),
    getStatusLines(),
    getCoverUrls(),
  ])
  if (error) throw error

  const rows = (data ?? []) as TaskRow[]
  const names = new Map(people.map((p) => [p.userId, p.name]))
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    notes: r.notes,
    brand: r.brand,
    sourceRef: r.source_ref,
    dueDate: r.due_date,
    status: r.status,
    sortOrder: r.sort_order,
    doneAt: r.done_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    assignees: r.task_assignees.map((a) => ({ userId: a.user_id, name: names.get(a.user_id) ?? '?' })),
    imageCount: r.task_images[0]?.count ?? 0,
    coverUrl: covers.get(r.id) ?? null,
    statusLine: lines.get(r.id) ?? null,
  }))
}

/** แบรนด์เก็บเป็นตัวพิมพ์เล็ก ตรงกับชื่อโฟลเดอร์ใน AGD (hape · abcthebaby …) */
export const normalizeBrand = (b: string | null | undefined) => b?.trim().toLowerCase() || null

/**
 * สร้างงาน + ผู้รับผิดชอบ — พนักงานมอบได้แค่ตัวเอง (RLS) จึงส่ง [ตัวเอง] มาเสมอ
 * แอดมินเลือกใครก็ได้ หรือไม่เลือกเลยก็ได้ (งานลอย เห็นตอนกรอง "ทุกคน")
 */
export async function createTask(
  input: {
    title: string
    notes: string
    dueDate: string | null
    brand: string | null
    sortOrder: number
    assigneeIds: string[]
  },
  userId: string
): Promise<string> {
  const sb = createClient()
  const { data, error } = await sb
    .from('tasks')
    .insert({
      title: input.title,
      notes: input.notes,
      due_date: input.dueDate,
      brand: normalizeBrand(input.brand),
      sort_order: input.sortOrder,
      created_by: userId,
    })
    .select('id')
    .single()
  if (error) throw error
  if (input.assigneeIds.length) {
    const { error: aErr } = await sb
      .from('task_assignees')
      .insert(input.assigneeIds.map((user_id) => ({ task_id: data.id, user_id })))
    if (aErr) throw aErr
  }
  return data.id
}

/** ตั้งผู้รับผิดชอบใหม่ทั้งชุด — แอดมินเท่านั้น (RLS) */
export async function setTaskAssignees(taskId: string, before: string[], after: string[]): Promise<void> {
  const sb = createClient()
  const removed = before.filter((id) => !after.includes(id))
  const added = after.filter((id) => !before.includes(id))
  if (removed.length) {
    const { error } = await sb.from('task_assignees').delete().eq('task_id', taskId).in('user_id', removed)
    if (error) throw error
  }
  if (added.length) {
    const { error } = await sb.from('task_assignees').insert(added.map((user_id) => ({ task_id: taskId, user_id })))
    if (error) throw error
  }
}

export async function updateTask(
  id: string,
  patch: Partial<{
    title: string
    notes: string
    brand: string | null
    dueDate: string | null
    /** เหตุผลที่เลื่อนวัน — ส่งพร้อม dueDate ใหม่ ลงประวัติให้เอง (trigger) */
    dueReason: string
    status: TaskStatus
    sortOrder: number
  }>
): Promise<void> {
  const row: Database['public']['Tables']['tasks']['Update'] = {}
  if (patch.title !== undefined) row.title = patch.title
  if (patch.notes !== undefined) row.notes = patch.notes
  if (patch.brand !== undefined) row.brand = normalizeBrand(patch.brand)
  if (patch.dueDate !== undefined) {
    row.due_date = patch.dueDate
    // ส่งทุกครั้งที่ส่งวัน — ไม่งั้นประวัติจะได้เหตุผลค้างจากครั้งก่อน
    row.due_change_reason = patch.dueReason?.trim() ?? ''
  }
  if (patch.status !== undefined) row.status = patch.status
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder
  const { error } = await createClient().from('tasks').update(row).eq('id', id)
  if (error) throw error
}

/** วันครบกำหนด/สถานะล่าสุด — ไทม์ไลน์เปลี่ยนให้เองผ่าน trigger หน้าต่างแก้งานต้องตามให้ทัน */
export async function getTaskDueStatus(id: string): Promise<{ dueDate: string | null; status: TaskStatus }> {
  const { data, error } = await createClient().from('tasks').select('due_date, status').eq('id', id).single()
  if (error) throw error
  return { dueDate: data.due_date, status: data.status as TaskStatus }
}

/** ลบรูปในที่เก็บก่อน — ลบงานแล้วสิทธิ์ของรูปหายไปด้วย จะลบไฟล์ไม่ได้อีก */
export async function deleteTask(id: string): Promise<void> {
  const sb = createClient()
  const { data: imgs } = await sb.from('task_images').select('path').eq('task_id', id)
  if (imgs?.length) await sb.storage.from('task-images').remove(imgs.map((i) => i.path))
  const { error } = await sb.from('tasks').delete().eq('id', id)
  if (error) throw error
}

// ── รูปแนบ ──────────────────────────────────────────────────────────
// ย่อบนเครื่องก่อนส่ง (HEIC จาก iPhone แปลงเป็น JPEG ในขั้นนี้) → 1600px ≈ 200–400 KB
// 1600 ไม่ใช่ 1280 แบบรูปสต็อก — รูปในงานมักเป็นเอกสาร/แคปจอ ต้องอ่านตัวหนังสือออก

export interface TaskImage {
  id: string
  path: string
  url: string | null
}

export async function getTaskImages(taskId: string): Promise<TaskImage[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('task_images')
    .select('id, path')
    .eq('task_id', taskId)
    .is('update_id', null) // รูปในอัปเดตโชว์ในไทม์ไลน์
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  const urls = await getImageUrls('task-images', (data ?? []).map((r) => r.path))
  return (data ?? []).map((r) => ({ id: r.id, path: r.path, url: urls.get(r.path) ?? null }))
}

export async function addTaskImage(
  taskId: string,
  file: File,
  userId: string,
  opts: { updateId?: string; sortOrder?: number } = {}
): Promise<void> {
  const blob = await resizeImage(file, { maxSide: 1600, quality: 0.8 })
  const sb = createClient()
  const path = `${taskId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
  const { error: upErr } = await sb.storage
    .from('task-images')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (upErr) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${upErr.message}`)
  const { error } = await sb.from('task_images').insert({
    task_id: taskId,
    path,
    created_by: userId,
    update_id: opts.updateId ?? null,
    // ไม่ระบุ = ต่อท้าย (เวลาเป็นตัวเลขที่โตขึ้นเรื่อย ๆ)
    sort_order: opts.sortOrder ?? Date.now(),
  })
  if (error) {
    await sb.storage.from('task-images').remove([path])
    throw error
  }
}

export async function deleteTaskImage(img: { id: string; path: string }): Promise<void> {
  const sb = createClient()
  const { error } = await sb.from('task_images').delete().eq('id', img.id)
  if (error) throw error
  await sb.storage.from('task-images').remove([img.path])
}

/** ลากเรียงรูปใหม่ — ตั้ง 1..n ตามลำดับที่ส่งมา (รูปแรกของงาน = ปก) */
export async function reorderTaskImages(orderedIds: string[]): Promise<void> {
  const sb = createClient()
  const results = await Promise.all(
    orderedIds.map((id, i) => sb.from('task_images').update({ sort_order: i + 1 }).eq('id', id))
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}

/** ปกของทุกงาน = รูปแรกตามลำดับ (เฉพาะรูปของงาน ไม่นับรูปในอัปเดต) */
async function getCoverUrls(): Promise<Map<string, string>> {
  const { data, error } = await createClient()
    .from('task_images')
    .select('task_id, path')
    .is('update_id', null)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  const first = new Map<string, string>()
  for (const r of data ?? []) if (!first.has(r.task_id)) first.set(r.task_id, r.path)
  const urls = await getImageUrls('task-images', [...first.values()])
  const out = new Map<string, string>()
  for (const [taskId, path] of first) {
    const u = urls.get(path)
    if (u) out.set(taskId, u)
  }
  return out
}

/** ลำดับใหม่ = ค่ากลางระหว่างการ์ดบน/ล่าง — แก้แถวเดียวต่อการลากหนึ่งครั้ง */
export function sortOrderBetween(above: number | undefined, below: number | undefined): number {
  if (above === undefined && below === undefined) return 0
  if (above === undefined) return below! - 1
  if (below === undefined) return above + 1
  return (above + below) / 2
}

// ── ไทม์ไลน์ความคืบหน้า ──────────────────────────────────────────────
// วันในรายการ (ตาม/นัด/ขั้นถัดไป) กลายเป็นวันครบกำหนดของงานเอง — trigger ใน DB
// แก้/ลบของตัวเองได้ 24 ชม. · แก้วัน/ประเภทได้เฉพาะรายการล่าสุด (กันที่ trigger)

type StatusLineRow = Database['public']['Views']['task_status_line']['Row']

const toStatusLine = (l: StatusLineRow): TaskStatusLine => ({
  kind: l.kind as ManualUpdateKind,
  waitingFor: l.waiting_for,
  waitingOn: l.waiting_on,
  body: l.body ?? '',
  eventDate: l.event_date,
  eventTime: l.event_time,
  followUps: l.follow_ups ?? 0,
  createdAt: l.created_at ?? '',
})

async function getStatusLines(): Promise<Map<string, TaskStatusLine>> {
  const { data, error } = await createClient().from('task_status_line').select('*')
  if (error) throw error
  return new Map((data ?? []).map((l) => [l.task_id!, toStatusLine(l)]))
}

export interface TaskUpdate {
  id: string
  kind: TaskUpdateKind
  waitingFor: string | null
  waitingOn: string | null
  body: string
  eventDate: string | null
  eventTime: string | null
  oldDue: string | null
  newDue: string | null
  createdBy: string | null
  createdAt: string
  images: TaskImage[]
}

/** ใหม่สุดก่อน */
export async function getTaskUpdates(taskId: string): Promise<TaskUpdate[]> {
  const sb = createClient()
  const [{ data, error }, { data: imgs }] = await Promise.all([
    sb
      .from('task_updates')
      .select('id, kind, waiting_for, waiting_on, body, event_date, event_time, old_due, new_due, created_by, created_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false }),
    sb.from('task_images').select('id, path, update_id').eq('task_id', taskId).not('update_id', 'is', null).order('sort_order').order('created_at'),
  ])
  if (error) throw error
  const urls = await getImageUrls('task-images', (imgs ?? []).map((i) => i.path))
  const byUpdate = new Map<string, TaskImage[]>()
  for (const i of imgs ?? []) {
    const list = byUpdate.get(i.update_id!) ?? []
    list.push({ id: i.id, path: i.path, url: urls.get(i.path) ?? null })
    byUpdate.set(i.update_id!, list)
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind as TaskUpdateKind,
    waitingFor: r.waiting_for,
    waitingOn: r.waiting_on,
    body: r.body,
    eventDate: r.event_date,
    eventTime: r.event_time,
    oldDue: r.old_due,
    newDue: r.new_due,
    createdBy: r.created_by,
    createdAt: r.created_at,
    images: byUpdate.get(r.id) ?? [],
  }))
}

export interface TaskUpdateInput {
  kind: ManualUpdateKind
  waitingFor?: string | null
  waitingOn?: string | null
  body: string
  eventDate: string | null
  /** 'HH:MM' — นัดหมายเท่านั้น */
  eventTime?: string | null
}

const updateRow = (i: TaskUpdateInput) => ({
  kind: i.kind,
  waiting_for: i.kind === 'waiting' ? i.waitingFor?.trim() || null : null,
  waiting_on: i.kind === 'waiting' ? i.waitingOn?.trim() || null : null,
  body: i.body.trim(),
  event_date: i.eventDate,
  event_time: i.kind === 'appointment' ? i.eventTime || null : null,
})

/** เพิ่มรายการ + รูป — รูปที่อัปไม่ผ่านไม่ทำให้รายการหาย คืนจำนวนรูปที่พลาด */
export async function addTaskUpdate(taskId: string, input: TaskUpdateInput, userId: string, files: File[] = []): Promise<number> {
  const { data, error } = await createClient()
    .from('task_updates')
    .insert({ task_id: taskId, created_by: userId, ...updateRow(input) })
    .select('id')
    .single()
  if (error) throw error
  let failed = 0
  for (const [i, f] of files.entries()) {
    try {
      await addTaskImage(taskId, f, userId, { updateId: data.id, sortOrder: i + 1 })
    } catch (e) {
      failed++
      console.error(e)
    }
  }
  return failed
}

/** follow_up สืบ "รออะไร/รอใคร" จากรายการก่อนหน้าเอง (trigger) — ไม่ต้องส่งมา */
export async function editTaskUpdate(id: string, input: TaskUpdateInput): Promise<void> {
  const row = updateRow(input)
  const patch = input.kind === 'follow_up' ? { ...row, waiting_for: undefined, waiting_on: undefined } : row
  const { data, error } = await createClient().from('task_updates').update(patch).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('แก้ไม่ได้ — แก้ได้เฉพาะรายการของตัวเองภายใน 24 ชม.')
}

/** แก้เหตุผลของรายการเลื่อนวัน */
export async function editTaskUpdateBody(id: string, body: string): Promise<void> {
  const { data, error } = await createClient().from('task_updates').update({ body: body.trim() }).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('แก้ไม่ได้ — แก้ได้เฉพาะรายการของตัวเองภายใน 24 ชม.')
}

/** ลบรูปในที่เก็บก่อน (แถวรูปหายตาม cascade) · ลบรายการล่าสุด → วันครบกำหนดกลับเป็นวันเดิม */
export async function deleteTaskUpdate(u: Pick<TaskUpdate, 'id' | 'images'>): Promise<void> {
  const sb = createClient()
  const { data, error } = await sb.from('task_updates').delete().eq('id', u.id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('ลบไม่ได้ — ลบได้เฉพาะรายการของตัวเองภายใน 24 ชม.')
  if (u.images.length) await sb.storage.from('task-images').remove(u.images.map((i) => i.path))
}
