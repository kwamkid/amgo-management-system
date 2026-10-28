// lib/tasks/notify.ts
//
// ส่งแจ้งเตือนงานของทีม (server เท่านั้น — ห้าม import ฝั่งเบราว์เซอร์)
// กติกาว่าเตือนอะไร/ใคร อยู่ที่ lib/tasks/reminders.ts — ไฟล์นี้แค่อ่านข้อมูลกับส่ง
//
// ── ยังไม่ผูกกับอะไร (เจ้าของ 28 ต.ค. 69: "ทำเตรียมไว้ เดี๋ยวทำทีหลัง") ─────
// ตอนเปิดใช้:
//   1. รายวัน: app/api/cron/task-reminders/route.ts → isAuthorizedCron แล้วเรียก
//      sendDailyTaskReminders() · ตั้ง cron-job.org วันละครั้ง ~08:30 เวลาไทย (ดู CRON_SETUP.md)
//   2. ตามเหตุการณ์: route POST ที่อ่านผู้ใช้จาก session แล้วเรียก sendTaskEvent()
//      (แบบ lib/push/notify.ts → /api/push/notify) — อย่ารับชื่อคนกดจากเบราว์เซอร์
//   3. Discord: เพิ่มช่องทางใน deliver() ด้านล่าง (DM/ช่องทีม) — ตอนนี้ส่ง push อย่างเดียว
//
// ไม่ throw: แจ้งเตือนพลาดต้องไม่ทำให้การบันทึกงานล้มตาม

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push/send'
import { bangkokDayKey } from '@/lib/services/workingHoursService'
import type { ManualUpdateKind, TaskStatusLine } from './updates'
import {
  eventReminder,
  planDailyReminders,
  type PlannedReminder,
  type ReminderTask,
  type TaskActionEvent,
} from './reminders'

/** งานที่ยังไม่เสร็จ (หรืองานที่ระบุ) พร้อมผู้รับผิดชอบและสถานะล่าสุด */
export async function loadReminderTasks(taskIds?: string[]): Promise<ReminderTask[]> {
  const sb = createAdminClient()
  let q = sb
    .from('tasks')
    .select('id, title, brand, due_date, status, created_by, task_assignees(user_id)')
  q = taskIds ? q.in('id', taskIds) : q.neq('status', 'done')
  const { data: tasks, error } = await q
  if (error || !tasks?.length) return []

  const { data: lines } = await sb
    .from('task_status_line')
    .select('task_id, kind, waiting_for, waiting_on, body, event_date, event_time, follow_ups, created_at')
    .in('task_id', tasks.map((t) => t.id))
  const byTask = new Map((lines ?? []).map((l) => [l.task_id, l]))

  return tasks.map((t) => {
    const l = byTask.get(t.id)
    const statusLine: TaskStatusLine | null = l
      ? {
          kind: l.kind as ManualUpdateKind,
          waitingFor: l.waiting_for,
          waitingOn: l.waiting_on,
          body: l.body ?? '',
          eventDate: l.event_date,
          eventTime: l.event_time,
          followUps: l.follow_ups ?? 0,
          createdAt: l.created_at ?? '',
        }
      : null
    return {
      id: t.id,
      title: t.title,
      brand: t.brand,
      dueDate: t.due_date,
      status: t.status as ReminderTask['status'],
      createdBy: t.created_by,
      assigneeIds: t.task_assignees.map((a) => a.user_id),
      statusLine,
    }
  })
}

async function deliver(plans: PlannedReminder[]): Promise<number> {
  let delivered = 0
  for (const p of plans) {
    delivered += await sendPushToUsers(p.userIds, p.message)
    // TODO(discord): ส่งช่องทางที่สองตรงนี้เมื่อเจ้าของตกลงรูปแบบ (DM รายคน หรือสรุปในช่องทีม)
  }
  return delivered
}

/** เตือนรายวัน — คืนจำนวนเรื่องที่วางแผนและจำนวนเครื่องที่ส่งถึง */
export async function sendDailyTaskReminders(now = new Date()): Promise<{ planned: number; delivered: number }> {
  try {
    const plans = planDailyReminders(await loadReminderTasks(), bangkokDayKey(now))
    return { planned: plans.length, delivered: await deliver(plans) }
  } catch (e) {
    console.error('[เตือนงาน] ส่งไม่สำเร็จ:', e)
    return { planned: 0, delivered: 0 }
  }
}

/** แจ้งตอนมีคนกด (มอบงาน · อัปเดต · ปิดงาน) */
export async function sendTaskEvent(
  event: TaskActionEvent,
  taskId: string,
  actor: { id: string; name: string },
  opts: { newAssigneeIds?: string[] } = {}
): Promise<number> {
  try {
    const [task] = await loadReminderTasks([taskId])
    if (!task) return 0
    const plan = eventReminder(event, task, actor, opts)
    return plan ? await deliver([plan]) : 0
  } catch (e) {
    console.error('[แจ้งงาน] ส่งไม่สำเร็จ:', e)
    return 0
  }
}
