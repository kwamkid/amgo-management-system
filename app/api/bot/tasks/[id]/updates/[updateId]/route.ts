// PATCH  /api/bot/tasks/{id}/updates/{updateId} — แก้รายการในไทม์ไลน์ (ส่งเฉพาะช่องที่จะเปลี่ยน)
//   { body?, kind?, date?: "YYYY-MM-DD"|null, time?: "HH:MM"|null, waiting_for?, waiting_on? }
// DELETE /api/bot/tasks/{id}/updates/{updateId} — ลบรายการ (รูปในรายการหายด้วย)
//
// กติกาเดียวกับหน้าเว็บ (RLS task_updates_update/_delete + trigger task_updates_before_update):
//   · แก้/ลบได้: แอดมิน (ตลอด) · คนบันทึกเอง ภายใน 24 ชม.
//   · ประเภท/วันที่ แก้ได้เฉพาะรายการล่าสุด → วันครบกำหนดของงานเปลี่ยนตาม
//   · ลบรายการล่าสุด → วันครบกำหนดกลับเป็นวันก่อนบันทึก
//   · รายการ "เลื่อนวัน" (due_change) แก้ได้แค่เหตุผล (body)
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/database'
import { UUID, apiError, apiJson, authBotApi, readJson, type BotCaller } from '@/lib/services/bot/botApi'
import { removeTaskImages } from '@/lib/services/bot/botImages'
import { DATE_REQUIRED, UPDATE_KINDS, isYmd, type BotUpdateKind } from '@/lib/services/bot/botTasks'

type Ctx = { params: Promise<{ id: string; updateId: string }> }

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000

async function loadOwned(caller: BotCaller, taskId: string, updateId: string) {
  if (!UUID.test(taskId) || !UUID.test(updateId)) return { error: apiError(404, 'ไม่พบรายการนี้') }
  const { data: u } = await caller.sb
    .from('task_updates')
    .select('id, kind, event_date, created_by, created_at')
    .eq('id', updateId)
    .eq('task_id', taskId)
    .maybeSingle()
  if (!u) return { error: apiError(404, 'ไม่พบรายการนี้') }
  const fresh = Date.now() - new Date(u.created_at).getTime() < EDIT_WINDOW_MS
  if (!caller.isAdmin && !(u.created_by === caller.user.id && fresh))
    return { error: apiError(403, 'แก้/ลบได้เฉพาะรายการของตัวเองภายใน 24 ชม. (แอดมินได้ตลอด)') }
  return { u }
}

async function taskState(caller: BotCaller, id: string) {
  const { data: t } = await caller.sb.from('tasks').select('status, due_date').eq('id', id).single()
  return { id, status: t?.status, due: t?.due_date ?? null }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const { id, updateId } = await params
  const r = await loadOwned(caller, id, updateId)
  if ('error' in r) return r.error
  const { u } = r

  const body = await readJson(request)
  if (!body) return apiError(400, 'body ต้องเป็น JSON object')
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null)

  const patch: Database['public']['Tables']['task_updates']['Update'] = {}
  if (body.body !== undefined) patch.body = str(body.body, 5000) ?? ''
  if (u.kind === 'due_change') {
    if (Object.keys(body).some((k) => k !== 'body')) return apiError(400, 'รายการเลื่อนวันแก้ได้แค่เหตุผล (body)')
  } else {
    const kind = (body.kind ?? u.kind) as BotUpdateKind
    if (!UPDATE_KINDS.includes(kind)) return apiError(400, `kind ต้องเป็น ${UPDATE_KINDS.join(' / ')}`)
    if (body.kind !== undefined) patch.kind = kind
    if (body.date !== undefined) {
      if (body.date !== null && !isYmd(body.date)) return apiError(400, 'date ต้องเป็น YYYY-MM-DD หรือ null')
      patch.event_date = body.date as string | null
    }
    const date = patch.event_date !== undefined ? patch.event_date : u.event_date
    if (DATE_REQUIRED[kind] && !date) return apiError(400, `${kind} ต้องมี date`)
    if (body.time !== undefined) {
      if (body.time !== null && !(typeof body.time === 'string' && /^\d{2}:\d{2}$/.test(body.time)))
        return apiError(400, 'time ต้องเป็น HH:MM หรือ null')
      patch.event_time = kind === 'appointment' ? (body.time as string | null) : null
    }
    if (body.waiting_for !== undefined) patch.waiting_for = kind === 'waiting' ? str(body.waiting_for, 200) : null
    if (body.waiting_on !== undefined) patch.waiting_on = kind === 'waiting' ? str(body.waiting_on, 200) : null
  }
  if (!Object.keys(patch).length) return apiError(400, 'ไม่มีอะไรให้แก้')

  const { data, error } = await caller.sb
    .from('task_updates')
    .update(patch)
    .eq('id', updateId)
    .select('id, kind, body, waiting_for, waiting_on, event_date, event_time, old_due, new_due, updated_at')
    .single()
  // trigger ปฏิเสธ (แก้วันของรายการเก่า ฯลฯ) — ข้อความไทยจาก DB ตอบกลับตรง ๆ
  if (error) return apiError(error.code === 'P0001' ? 400 : 500, error.message)

  return apiJson({
    update: {
      id: data.id,
      kind: data.kind,
      body: data.body || undefined,
      waitingFor: data.waiting_for ?? undefined,
      waitingOn: data.waiting_on ?? undefined,
      date: data.event_date ?? undefined,
      time: data.event_time?.slice(0, 5) ?? undefined,
      dueChange: data.new_due ? { from: data.old_due, to: data.new_due } : undefined,
      editedAt: data.updated_at,
    },
    task: await taskState(caller, id),
  })
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const { id, updateId } = await params
  const r = await loadOwned(caller, id, updateId)
  if ('error' in r) return r.error

  // ไฟล์รูปต้องลบเอง — แถวรูปหายตาม cascade แต่ไฟล์ใน storage ไม่หาย
  const { data: imgs } = await caller.sb.from('task_images').select('id, path').eq('update_id', updateId)
  try {
    await removeTaskImages(caller.sb, imgs ?? [])
  } catch (e) {
    return apiError(500, (e as Error).message)
  }
  const { error } = await caller.sb.from('task_updates').delete().eq('id', updateId)
  if (error) return apiError(500, error.message)
  return apiJson({ deleted: updateId, task: await taskState(caller, id) })
}
