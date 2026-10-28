// lib/services/bot/botTasks.ts
//
// อ่าน/เขียนงานของทีมสำหรับ API บอท — service role จึงต้องตรวจสิทธิ์เองให้ตรงกับ DB:
//   อ่าน     : ทุกคนเห็นทุกงาน (20261027222208_tasks_visible_to_all — "ไม่มีอะไรต้องปิดบัง")
//   แก้      : แอดมิน · คนสร้าง · ผู้รับผิดชอบ (tasks_update_own)
//              คนที่ไม่ใช่แอดมิน/คนสร้าง แก้ได้แค่ สถานะ · วันครบกำหนด · โน้ต (tasks_before_write)
//   ผู้รับผิดชอบ: แอดมินตั้งใครก็ได้ · พนักงานเพิ่ม/ถอด "ตัวเอง" ได้เฉพาะงานที่ตัวเองสร้าง
//              (task_assignees_self / _self_delete)
//   ไทม์ไลน์ : ใครแก้งานได้ = เพิ่มรายการได้ (task_updates_insert · ห้าม kind due_change)
//   เลื่อนวัน : ผ่าน rpc bot_set_task_due → ลงไทม์ไลน์ due_change พร้อมชื่อคนเลื่อน
// สถานะ done: ส่ง done_by เอง (trigger ใช้ auth.uid() ซึ่ง service role ไม่มี)

import { bangkokDayKey } from '@/lib/services/workingHoursService'
import { personName, type AdminDb, type BotCaller, type BotPerson } from './botApi'

export type TaskStatus = 'todo' | 'doing' | 'done'
export const STATUSES: TaskStatus[] = ['todo', 'doing', 'done']

/** ประเภทรายการไทม์ไลน์ที่บอทเพิ่มได้ — ตรงกับ check ใน 20261028014843_task_updates */
export const UPDATE_KINDS = ['note', 'waiting', 'follow_up', 'appointment'] as const
export type BotUpdateKind = (typeof UPDATE_KINDS)[number]
export const DATE_REQUIRED: Record<BotUpdateKind, boolean> = { note: false, waiting: true, follow_up: true, appointment: true }

export const YMD = /^\d{4}-\d{2}-\d{2}$/
export const isYmd = (v: unknown): v is string => typeof v === 'string' && YMD.test(v) && !isNaN(Date.parse(v))

export const todayBkk = () => bangkokDayKey(new Date())

/** 'yyyy-mm-dd' + n วัน (คิดแบบ UTC ล้วน ไม่มีเรื่อง timezone) */
export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

export const normalizeBrand = (b: unknown) => (typeof b === 'string' ? b.trim().toLowerCase() || null : null)

export interface TaskRow {
  id: string
  title: string
  notes: string
  brand: string | null
  due_date: string | null
  status: string
  done_at: string | null
  created_by: string | null
  created_at: string
  task_assignees: { user_id: string }[]
}

export const TASK_COLS = 'id, title, notes, brand, due_date, status, done_at, created_by, created_at, task_assignees(user_id)'

/** งานแบบย่อที่ส่งให้บอท */
export interface BotTask {
  id: string
  title: string
  brand: string | null
  status: TaskStatus
  due: string | null
  /** เลยกำหนดกี่วัน (เฉพาะงานยังไม่เสร็จที่เลยวัน) */
  daysLate?: number
  /** อีกกี่วันถึงกำหนด (0 = วันนี้) — เฉพาะงานยังไม่เสร็จที่ยังไม่เลยวัน */
  daysLeft?: number
  assignees: BotPerson[]
  createdBy: BotPerson | null
  notes?: string
  doneAt?: string
}

/** โหลดชื่อคนที่เกี่ยวข้องทีเดียว */
export async function peopleMap(sb: AdminDb, ids: string[]): Promise<Map<string, BotPerson>> {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (!uniq.length) return new Map()
  const { data } = await sb.from('users').select('id, nickname, full_name, discord_user_id').in('id', uniq)
  return new Map((data ?? []).map((u) => [u.id, { id: u.id, name: personName(u), discordId: u.discord_user_id }]))
}

export async function toBotTasks(sb: AdminDb, rows: TaskRow[], opts: { notes?: 'full' | 'short' } = {}): Promise<BotTask[]> {
  const people = await peopleMap(sb, rows.flatMap((r) => [r.created_by ?? '', ...r.task_assignees.map((a) => a.user_id)]))
  const today = todayBkk()
  const who = (id: string) => people.get(id) ?? { id, name: '?', discordId: null }
  return rows.map((r) => {
    const t: BotTask = {
      id: r.id,
      title: r.title,
      brand: r.brand,
      status: r.status as TaskStatus,
      due: r.due_date,
      assignees: r.task_assignees.map((a) => who(a.user_id)),
      createdBy: r.created_by ? who(r.created_by) : null,
    }
    if (r.status !== 'done' && r.due_date) {
      const d = daysBetween(today, r.due_date)
      if (d < 0) t.daysLate = -d
      else t.daysLeft = d
    }
    const notes = r.notes?.trim()
    if (notes) t.notes = opts.notes === 'full' || notes.length <= 200 ? notes : notes.slice(0, 200) + '…'
    if (r.done_at) t.doneAt = r.done_at
    return t
  })
}

export async function getTaskRow(sb: AdminDb, id: string): Promise<TaskRow | null> {
  const { data } = await sb.from('tasks').select(TASK_COLS).eq('id', id).maybeSingle()
  return (data as TaskRow | null) ?? null
}

/** แก้งานนี้ได้ไหม (tasks_update_own) */
export const canEditTask = (c: BotCaller, t: Pick<TaskRow, 'created_by' | 'task_assignees'>) =>
  c.isAdmin || t.created_by === c.user.id || t.task_assignees.some((a) => a.user_id === c.user.id)

/** แก้ชื่อ/แบรนด์ได้ไหม — แอดมินหรือคนสร้างเท่านั้น (tasks_before_write) */
export const canEditDetails = (c: BotCaller, t: Pick<TaskRow, 'created_by'>) => c.isAdmin || t.created_by === c.user.id

/** ตรวจการเปลี่ยนผู้รับผิดชอบ — คืนข้อความ error หรือ null */
export function assigneeChangeError(c: BotCaller, createdBy: string | null, before: string[], after: string[]): string | null {
  if (c.isAdmin) return null
  const changed = [...after.filter((x) => !before.includes(x)), ...before.filter((x) => !after.includes(x))]
  if (!changed.length) return null
  if (createdBy !== c.user.id || changed.some((x) => x !== c.user.id))
    return 'มอบงานให้คนอื่นได้เฉพาะแอดมิน — พนักงานเพิ่ม/ถอดได้แค่ตัวเองในงานที่ตัวเองสร้าง'
  return null
}

/** ตั้งผู้รับผิดชอบใหม่ทั้งชุด */
export async function setAssignees(sb: AdminDb, taskId: string, before: string[], after: string[]) {
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
