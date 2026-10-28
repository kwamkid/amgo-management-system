// GET   /api/bot/tasks/{id} — งานเดียว + ไทม์ไลน์ 10 รายการล่าสุด (ใหม่สุดก่อน)
//
// PATCH /api/bot/tasks/{id} — แก้งาน (ส่งเฉพาะช่องที่จะเปลี่ยน)
//   { status?: "todo"|"doing"|"done", due_date?: "YYYY-MM-DD"|null, due_reason?: "เหตุผลที่เลื่อน",
//     notes?, title?, brand?, assignees?: ["me" | discord id | user id] (ทั้งชุดใหม่) }
//   แก้ได้: แอดมิน · คนสร้าง · ผู้รับผิดชอบ — ผู้รับผิดชอบที่ไม่ได้สร้างงาน แก้ได้แค่ status / due_date / notes
//   เลื่อนวัน → ลงไทม์ไลน์ "เลื่อนวัน" พร้อมเหตุผลและชื่อคนเลื่อน (เหมือนหน้าเว็บ)
import type { NextRequest } from 'next/server'
import { UUID, apiError, apiJson, authBotApi, readJson, resolvePeople, untyped } from '@/lib/services/bot/botApi'
import {
  STATUSES,
  assigneeChangeError,
  canEditDetails,
  canEditTask,
  getTaskRow,
  isYmd,
  normalizeBrand,
  peopleMap,
  setAssignees,
  toBotTasks,
  type TaskStatus,
} from '@/lib/services/bot/botTasks'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { sb } = a.caller
  const id = (await params).id
  if (!UUID.test(id)) return apiError(404, 'ไม่พบงานนี้')
  const row = await getTaskRow(sb, id)
  if (!row) return apiError(404, 'ไม่พบงานนี้')

  const { data: ups } = await sb
    .from('task_updates')
    .select('id, kind, waiting_for, waiting_on, body, event_date, event_time, old_due, new_due, created_by, created_at')
    .eq('task_id', id)
    .order('created_at', { ascending: false })
    .limit(10)
  const people = await peopleMap(sb, (ups ?? []).map((u) => u.created_by ?? ''))
  const [task] = await toBotTasks(sb, [row], { notes: 'full' })
  return apiJson({
    task: { ...task, canEdit: canEditTask(a.caller, row) },
    updates: (ups ?? []).map((u) => ({
      id: u.id,
      kind: u.kind,
      body: u.body || undefined,
      waitingFor: u.waiting_for ?? undefined,
      waitingOn: u.waiting_on ?? undefined,
      date: u.event_date ?? undefined,
      time: u.event_time?.slice(0, 5) ?? undefined,
      dueChange: u.kind === 'due_change' || u.new_due ? { from: u.old_due, to: u.new_due } : undefined,
      by: u.created_by ? (people.get(u.created_by)?.name ?? '?') : null,
      at: u.created_at,
    })),
  })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const { sb } = caller
  const id = (await params).id
  if (!UUID.test(id)) return apiError(404, 'ไม่พบงานนี้')
  const row = await getTaskRow(sb, id)
  if (!row) return apiError(404, 'ไม่พบงานนี้')
  if (!canEditTask(caller, row)) return apiError(403, 'แก้ได้เฉพาะแอดมิน คนสร้างงาน หรือผู้รับผิดชอบ')

  const body = await readJson(request)
  if (!body) return apiError(400, 'body ต้องเป็น JSON object')

  const patch: { status?: TaskStatus; done_by?: string; notes?: string; title?: string; brand?: string | null } = {}
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as TaskStatus)) return apiError(400, 'status ต้องเป็น todo / doing / done')
    patch.status = body.status as TaskStatus
    // trigger ตั้ง done_by จาก auth.uid() ซึ่ง service role ไม่มี — ส่งเอง
    if (patch.status === 'done' && row.status !== 'done') patch.done_by = caller.user.id
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string') return apiError(400, 'notes ต้องเป็นข้อความ')
    patch.notes = body.notes.trim().slice(0, 5000)
  }
  if (body.title !== undefined || body.brand !== undefined) {
    if (!canEditDetails(caller, row)) return apiError(403, 'แก้ชื่องาน/แบรนด์ได้เฉพาะแอดมินหรือคนสร้างงาน — ผู้รับผิดชอบแก้ได้แค่สถานะ วันครบกำหนด และโน้ต')
    if (body.title !== undefined) {
      const t = typeof body.title === 'string' ? body.title.replace(/\s+/g, ' ').trim().slice(0, 300) : ''
      if (!t) return apiError(400, 'title ว่างไม่ได้')
      patch.title = t
    }
    if (body.brand !== undefined) patch.brand = normalizeBrand(body.brand)
  }

  let due: { value: string | null; reason: string } | null = null
  if (body.due_date !== undefined) {
    if (body.due_date !== null && !isYmd(body.due_date)) return apiError(400, 'due_date ต้องเป็น YYYY-MM-DD หรือ null')
    if (body.due_date !== row.due_date)
      due = { value: body.due_date as string | null, reason: typeof body.due_reason === 'string' ? body.due_reason.trim().slice(0, 500) : '' }
  }

  let newAssignees: string[] | null = null
  const before = row.task_assignees.map((x) => x.user_id)
  if (body.assignees !== undefined) {
    if (!Array.isArray(body.assignees)) return apiError(400, 'assignees ต้องเป็น array')
    const { found, missing } = await resolvePeople(sb, body.assignees.map(String), caller.user)
    if (missing.length) return apiError(400, `ไม่พบพนักงาน: ${missing.join(', ')}`)
    newAssignees = found.map((f) => f.id)
    const err = assigneeChangeError(caller, row.created_by, before, newAssignees)
    if (err) return apiError(403, err)
  }

  if (!Object.keys(patch).length && !due && !newAssignees) return apiError(400, 'ไม่มีช่องที่จะแก้')

  // ตรวจครบแล้วค่อยเขียน — เลื่อนวันก่อน (ลงไทม์ไลน์ในนามผู้เรียก) แล้วช่องอื่น
  if (due) {
    const { error } = await untyped(sb).rpc('bot_set_task_due', {
      p_task_id: id,
      p_due: due.value,
      p_reason: due.reason,
      p_actor: caller.user.id,
    })
    if (error) return apiError(500, `เลื่อนวันไม่สำเร็จ: ${error.message}`)
  }
  if (Object.keys(patch).length) {
    const { error } = await sb.from('tasks').update(patch).eq('id', id)
    if (error) return apiError(500, error.message)
  }
  if (newAssignees) {
    try {
      await setAssignees(sb, id, before, newAssignees)
    } catch (e) {
      return apiError(500, `ตั้งผู้รับผิดชอบไม่สำเร็จ: ${(e as Error).message}`)
    }
  }

  const fresh = await getTaskRow(sb, id)
  const [task] = await toBotTasks(sb, fresh ? [fresh] : [], { notes: 'full' })
  return apiJson({ task })
}
