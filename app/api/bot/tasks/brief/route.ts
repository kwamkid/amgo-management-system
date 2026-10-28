// GET /api/bot/tasks/brief — สรุปงานประจำวัน: เลยกำหนด + ครบกำหนดใน 7 วัน (ยังไม่เสร็จ)
//   ?user=me (ค่าเริ่มต้น) | <discord id> | <user id> → งานที่คนนั้นเป็นผู้รับผิดชอบ
//   ?user=team → ทั้งทีม (superadmin เท่านั้น) · ?days=7 (1–30)
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi, resolvePeople } from '@/lib/services/bot/botApi'
import { TASK_COLS, addDays, toBotTasks, todayBkk, type TaskRow } from '@/lib/services/bot/botTasks'

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const p = request.nextUrl.searchParams
  const userRef = p.get('user')?.trim() || 'me'
  const days = Math.min(Math.max(Number(p.get('days')) || 7, 1), 30)
  const today = todayBkk()
  const until = addDays(today, days)

  let who = null
  if (userRef === 'team') {
    if (caller.scope !== 'superadmin') return apiError(403, 'สรุปทั้งทีมใช้ได้เฉพาะกุญแจ superadmin')
  } else {
    const { found } = await resolvePeople(caller.sb, [userRef], caller.user)
    if (!found.length) return apiError(400, `ไม่พบพนักงาน: ${userRef}`)
    who = found[0]
  }

  const { data, error } = await caller.sb
    .from('tasks')
    .select(TASK_COLS)
    .neq('status', 'done')
    .not('due_date', 'is', null)
    .lte('due_date', until)
    .order('due_date')
    .order('created_at')
  if (error) return apiError(500, error.message)
  let rows = (data ?? []) as TaskRow[]
  if (who) rows = rows.filter((r) => r.task_assignees.some((x) => x.user_id === who.id))

  const tasks = await toBotTasks(caller.sb, rows)
  const overdue = tasks.filter((t) => t.daysLate !== undefined)
  const dueSoon = tasks.filter((t) => t.daysLeft !== undefined)
  return apiJson({
    today,
    until,
    user: who ?? 'team',
    counts: { overdue: overdue.length, dueToday: dueSoon.filter((t) => t.daysLeft === 0).length, dueSoon: dueSoon.length },
    overdue,
    dueSoon,
  })
}
