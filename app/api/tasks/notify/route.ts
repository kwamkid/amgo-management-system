// app/api/tasks/notify/route.ts
//
// เว็บบอกว่า "เพิ่งมอบงาน / อัปเดต / ปิดงาน" → server ตัดสินผู้รับ + ข้อความ แล้วยิง push (lib/tasks/notify.ts)
//
// กันปลอม: ชื่อคนกดอ่านจากบัญชีที่ล็อกอิน · ต้องเป็นแอดมิน คนสร้าง หรือผู้รับผิดชอบงานนั้น ·
// "มอบงาน" ส่งได้เฉพาะคนที่เป็นผู้รับผิดชอบอยู่จริงตอนนี้ · "ปิดงาน" ต้องปิดภายใน 2 นาที
// (หน้าต่างแก้งานส่งสถานะทุกครั้งที่กดบันทึก — กันแจ้งซ้ำตอนแก้งานที่เสร็จไปนานแล้ว)
import { NextRequest, NextResponse, after } from 'next/server'
import { createServerSupabase, verifiedUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTaskEvent } from '@/lib/tasks/notify'
import type { TaskActionEvent } from '@/lib/tasks/reminders'

export const maxDuration = 15

const EVENTS: readonly TaskActionEvent[] = ['assigned', 'task_updated', 'task_done']
const DONE_WINDOW_MS = 2 * 60 * 1000

export async function POST(request: NextRequest) {
  const user = await verifiedUser(await createServerSupabase())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { event?: string; taskId?: string; userIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const event = body.event as TaskActionEvent
  if (!EVENTS.includes(event) || typeof body.taskId !== 'string') {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const [{ data: actor }, { data: task }] = await Promise.all([
    admin.from('users').select('nickname, full_name, role').eq('id', user.id).single(),
    admin.from('tasks').select('id, created_by, status, done_at, task_assignees(user_id)').eq('id', body.taskId).maybeSingle(),
  ])
  if (!actor || !task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const assignees = task.task_assignees.map((a) => a.user_id)
  const allowed = actor.role === 'admin' || task.created_by === user.id || assignees.includes(user.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let newAssigneeIds: string[] | undefined
  if (event === 'assigned') {
    const asked = Array.isArray(body.userIds) ? body.userIds.filter((x): x is string => typeof x === 'string') : []
    newAssigneeIds = asked.filter((id) => assignees.includes(id))
    if (!newAssigneeIds.length) return NextResponse.json({ sent: 0 })
  }
  if (event === 'task_done') {
    const fresh = task.status === 'done' && task.done_at && Date.now() - new Date(task.done_at).getTime() < DONE_WINDOW_MS
    if (!fresh) return NextResponse.json({ sent: 0 })
  }

  const name = actor.nickname || actor.full_name
  after(() => sendTaskEvent(event, task.id, { id: user.id, name }, { newAssigneeIds }))
  return NextResponse.json({ ok: true })
}
