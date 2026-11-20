// GET /api/bot/tasks/chase — งานเลยกำหนดที่ยังไม่เสร็จ + งานที่ถูกถามวันนี้ (แม้เสร็จ/เลื่อนแล้ว)
//   สำหรับสคริปต์ตามงานของ Edith (superadmin เท่านั้น) · overdue: false = ไม่เลยกำหนดแล้ว (ตอบเสร็จ/เลื่อนวัน)
//   14:00 TH: DM ผู้รับผิดชอบแต่ละงาน แล้ว POST /tasks/{id}/updates { kind: "chase", body } ทีละงาน
//   17:30 TH: สรุปให้เจ้าของ — ใช้ chasedToday / repliedToday / lastReply
// owner 2026-11-18 (project/jobs/plans/tasks-edith.md)
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi } from '@/lib/services/bot/botApi'
import { TASK_COLS, peopleMap, toBotTasks, todayBkk, type TaskRow } from '@/lib/services/bot/botTasks'
import { bangkokDayKey, bangkokStartOfDay } from '@/lib/services/workingHoursService'
import { richTextToPlain } from '@/lib/utils/richText'

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  if (caller.scope !== 'superadmin') return apiError(403, 'ใช้ได้เฉพาะกุญแจ superadmin')
  const today = todayBkk()

  const { data, error } = await caller.sb
    .from('tasks')
    .select(TASK_COLS)
    .neq('status', 'done')
    .lt('due_date', today)
    .order('due_date')
    .order('created_at')
  if (error) return apiError(500, error.message)
  const rows = (data ?? []) as TaskRow[]

  // งานที่ Edith ถามวันนี้แต่ตอบ "เสร็จ" หรือเลื่อนวันไปแล้ว → ไม่เลยกำหนดแล้ว แต่สรุป 17:30 ยังต้องเห็น
  const { data: chasedNow, error: cErr } = await caller.sb
    .from('task_updates')
    .select('task_id')
    .eq('kind', 'chase')
    .gte('created_at', bangkokStartOfDay(new Date()).toISOString())
  if (cErr) return apiError(500, cErr.message)
  const have = new Set(rows.map((r) => r.id))
  const extraIds = [...new Set((chasedNow ?? []).map((u) => u.task_id))].filter((id) => !have.has(id))
  if (extraIds.length) {
    const { data: extra, error: eErr } = await caller.sb.from('tasks').select(TASK_COLS).in('id', extraIds)
    if (eErr) return apiError(500, eErr.message)
    rows.push(...((extra ?? []) as TaskRow[]))
  }
  if (!rows.length) return apiJson({ today, count: 0, tasks: [] })

  const { data: ups, error: uErr } = await caller.sb
    .from('task_updates')
    .select('task_id, kind, body, created_by, created_at')
    .in('task_id', rows.map((r) => r.id))
    .neq('kind', 'due_change')
    .order('created_at', { ascending: false })
  if (uErr) return apiError(500, uErr.message)

  const [tasks, people] = await Promise.all([
    toBotTasks(caller.sb, rows),
    peopleMap(caller.sb, (ups ?? []).map((u) => u.created_by ?? '')),
  ])
  const dayOf = (iso: string) => bangkokDayKey(new Date(iso))

  return apiJson({
    today,
    count: tasks.length,
    tasks: tasks.map((t) => {
      const mine = (ups ?? []).filter((u) => u.task_id === t.id)
      const chases = mine.filter((u) => u.kind === 'chase')
      const lastChase = chases[0]
      // คำตอบ = รายการที่คนบันทึกหลัง Edith ถามครั้งล่าสุด
      const reply = mine.find((u) => u.kind !== 'chase' && (!lastChase || u.created_at > lastChase.created_at))
      return {
        ...t,
        overdue: t.status !== 'done' && !!t.due && t.due < today,
        chases: chases.length,
        lastChaseAt: lastChase?.created_at ?? null,
        chasedToday: !!lastChase && dayOf(lastChase.created_at) === today,
        repliedToday: !!reply && dayOf(reply.created_at) === today,
        lastReply: reply
          ? { kind: reply.kind, body: richTextToPlain(reply.body), by: people.get(reply.created_by ?? '')?.name ?? null, at: reply.created_at }
          : null,
      }
    }),
  })
}
