// lib/tasks/reminders.ts
//
// แจ้งเตือนงานของทีม — วันไหนเตือนเรื่องอะไร ใครได้รับ ข้อความว่าอะไร
// กติกาล้วน ไม่แตะฐานข้อมูล (ทดสอบด้วย node ตรง ๆ ได้ → ห้ามใช้ '@/' alias, import ต้องมี .ts)
// ตัวส่งจริงอยู่ที่ lib/tasks/notify.ts (server) — ยังไม่ผูก cron/ปุ่มไหน (เจ้าของ 28 ต.ค. 69: "ทำเตรียมไว้")
//
// ── สองแบบ ──────────────────────────────────────────────────────────
// รายวัน (cron วันละครั้งตอนเช้า → planDailyReminders):
//   follow_up_today      ⏳ ถึงวันตามแล้ว — งานที่ "รอเขา" อยู่และวันตาม = วันนี้
//   appointment_tomorrow 📅 พรุ่งนี้มีนัด
//   appointment_today    📅 วันนี้มีนัด
//   due_today            งานอื่นที่ครบกำหนดวันนี้
//   overdue              เลยกำหนด — เตือนวันที่ 1 · 3 · 7 แล้วทุก 7 วัน (ไม่งั้นคนปิดแจ้งเตือนทิ้งทั้งแอป)
// ตามเหตุการณ์ (ยิงตอนมีคนกด → eventReminder):
//   assigned             ถูกมอบงานใหม่
//   task_updated         คนอื่นเพิ่มอัปเดตในงานที่เรารับผิดชอบ
//   task_done            งานที่เราสร้าง/รับผิดชอบร่วม ถูกปิดแล้ว
//
// ผู้รับ = ผู้รับผิดชอบทุกคน · งานลอย (ไม่มีคนรับ) → คนสร้าง · ไม่ส่งหาคนที่เป็นคนกดเอง

import { statusLineText, thaiDay, shortTime, addDaysYmd, type TaskStatusLine } from './updates.ts'

export type TaskDailyEvent =
  | 'follow_up_today'
  | 'appointment_tomorrow'
  | 'appointment_today'
  | 'due_today'
  | 'overdue'

export type TaskActionEvent = 'assigned' | 'task_updated' | 'task_done'

export type TaskReminderEvent = TaskDailyEvent | TaskActionEvent

export interface ReminderTask {
  id: string
  title: string
  brand: string | null
  /** yyyy-mm-dd */
  dueDate: string | null
  status: 'todo' | 'doing' | 'done'
  assigneeIds: string[]
  createdBy: string | null
  statusLine: TaskStatusLine | null
}

export interface TaskReminderMessage {
  title: string
  body: string
  /** หน้าที่เปิดเมื่อกดแจ้งเตือน */
  url: string
  /** tag เดียวกันแทนที่กัน — งานเดียวกันวันเดียวกันไม่ซ้อนหลายใบ */
  tag: string
}

export interface PlannedReminder {
  event: TaskReminderEvent
  taskId: string
  userIds: string[]
  message: TaskReminderMessage
}

/** เลยกำหนดแล้วกี่วันถึงเตือน */
export function shouldNagOverdue(daysLate: number): boolean {
  return daysLate === 1 || daysLate === 3 || (daysLate >= 7 && daysLate % 7 === 0)
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.UTC(...(fromYmd.split('-').map(Number) as [number, number, number]))
  const b = Date.UTC(...(toYmd.split('-').map(Number) as [number, number, number]))
  // เดือนใน Date.UTC เริ่มที่ 0 แต่ทั้งสองฝั่งเลื่อนเท่ากัน ผลต่างจึงถูก
  return Math.round((b - a) / 86_400_000)
}

/** งานนี้ วันนี้ต้องเตือนเรื่องอะไร (ไม่มี = null) — งานละไม่เกินหนึ่งเรื่องต่อวัน */
export function dailyEventFor(task: ReminderTask, today: string): TaskDailyEvent | null {
  if (task.status === 'done') return null
  const line = task.statusLine

  // นัดดูจากวันนัดของรายการ ไม่ใช่วันครบกำหนด — มีคนเลื่อนวันงานทีหลังก็ยังเตือนนัดถูก
  if (line?.kind === 'appointment' && line.eventDate) {
    if (line.eventDate === today) return 'appointment_today'
    if (line.eventDate === addDaysYmd(today, 1)) return 'appointment_tomorrow'
  }

  if (!task.dueDate) return null
  const late = daysBetween(task.dueDate, today)
  if (late === 0) {
    return line && (line.kind === 'waiting' || line.kind === 'follow_up') ? 'follow_up_today' : 'due_today'
  }
  if (late > 0 && shouldNagOverdue(late)) return 'overdue'
  return null
}

/** ผู้รับผิดชอบ · ไม่มี → คนสร้าง · ตัดคนที่เป็นคนกดเองออก */
export function recipientsFor(task: Pick<ReminderTask, 'assigneeIds' | 'createdBy'>, actorId?: string | null): string[] {
  const base = task.assigneeIds.length ? task.assigneeIds : task.createdBy ? [task.createdBy] : []
  return [...new Set(base)].filter((id) => id && id !== actorId)
}

const taskUrl = (id: string) => `/tasks?task=${id}`

function headline(task: ReminderTask): string {
  return task.brand ? `[${task.brand}] ${task.title}` : task.title
}

export function dailyMessage(event: TaskDailyEvent, task: ReminderTask, today: string): TaskReminderMessage {
  const line = task.statusLine ? statusLineText(task.statusLine) : ''
  const tag = `task-${task.id}-${today}`
  const url = taskUrl(task.id)
  switch (event) {
    case 'follow_up_today':
      return { title: 'ถึงวันตามงานแล้ว', body: `${headline(task)}\n${line}`.trim(), url, tag }
    case 'appointment_today':
    case 'appointment_tomorrow': {
      const l = task.statusLine!
      const when = `${event === 'appointment_today' ? 'วันนี้' : 'พรุ่งนี้'} ${thaiDay(l.eventDate!)}${l.eventTime ? ` ${shortTime(l.eventTime)}` : ''}`
      return {
        title: event === 'appointment_today' ? 'วันนี้มีนัด' : 'พรุ่งนี้มีนัด',
        body: `${headline(task)}\n${when}${l.body.trim() ? ` · ${l.body.trim()}` : ''}`,
        url,
        tag,
      }
    }
    case 'due_today':
      return { title: 'งานครบกำหนดวันนี้', body: `${headline(task)}${line ? `\n${line}` : ''}`, url, tag }
    case 'overdue': {
      const late = task.dueDate ? daysBetween(task.dueDate, today) : 0
      return {
        title: `งานเลยกำหนด ${late} วัน`,
        body: `${headline(task)}\nอัปเดตความคืบหน้า หรือเลื่อนวันพร้อมเหตุผล${line ? `\n${line}` : ''}`,
        url,
        tag,
      }
    }
  }
}

/** แผนเตือนรายวันทั้งหมด — cron เรียกครั้งเดียวตอนเช้า (เวลาไทย) */
export function planDailyReminders(tasks: ReminderTask[], today: string): PlannedReminder[] {
  const out: PlannedReminder[] = []
  for (const task of tasks) {
    const event = dailyEventFor(task, today)
    if (!event) continue
    const userIds = recipientsFor(task)
    if (!userIds.length) continue
    out.push({ event, taskId: task.id, userIds, message: dailyMessage(event, task, today) })
  }
  return out
}

/** แจ้งตอนมีคนกด — actorName ให้ server ใส่จากบัญชีที่ล็อกอิน ไม่รับจากเบราว์เซอร์ */
export function eventReminder(
  event: TaskActionEvent,
  task: ReminderTask,
  actor: { id: string; name: string },
  opts: { newAssigneeIds?: string[] } = {}
): PlannedReminder | null {
  const url = taskUrl(task.id)
  let userIds: string[]
  let message: TaskReminderMessage

  switch (event) {
    case 'assigned':
      userIds = (opts.newAssigneeIds ?? []).filter((id) => id !== actor.id)
      message = {
        title: `${actor.name} มอบงานให้`,
        body: `${headline(task)}${task.dueDate ? `\nครบกำหนด ${thaiDay(task.dueDate)}` : ''}`,
        url,
        tag: `task-${task.id}-assigned`,
      }
      break
    case 'task_updated':
      userIds = recipientsFor(task, actor.id)
      message = {
        title: `${actor.name} อัปเดตงาน`,
        body: `${headline(task)}${task.statusLine ? `\n${statusLineText(task.statusLine)}` : ''}`,
        url,
        tag: `task-${task.id}-updated`,
      }
      break
    case 'task_done':
      userIds = [...new Set([...task.assigneeIds, ...(task.createdBy ? [task.createdBy] : [])])].filter(
        (id) => id !== actor.id
      )
      message = { title: `${actor.name} ปิดงานแล้ว`, body: headline(task), url, tag: `task-${task.id}-done` }
      break
  }

  return userIds.length ? { event, taskId: task.id, userIds, message } : null
}
