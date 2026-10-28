// POST /api/bot/tasks/{id}/updates — เพิ่มรายการในไทม์ไลน์ความคืบหน้า (บันทึก/คอมเมนต์)
//   { kind?: "note" (ค่าเริ่มต้น) | "waiting" | "follow_up" | "appointment",
//     body?: "ข้อความ", date?: "YYYY-MM-DD", time?: "HH:MM" (นัดหมายเท่านั้น),
//     waiting_for?: "รออะไร", waiting_on?: "รอใคร" (waiting เท่านั้น),
//     images?: ["<ลิงก์ไฟล์แนบ Discord>", ...] (ไม่เกิน 5) }
//   waiting / follow_up / appointment ต้องมี date · มี date แล้ววันครบกำหนดของงานเปลี่ยนเป็นวันนั้น (trigger)
//   รายการแรกของงานเปลี่ยน "ต้องทำ" → "กำลังทำ" ให้เอง
//   เพิ่มได้: แอดมิน · คนสร้าง · ผู้รับผิดชอบ (task_updates_insert)
import type { NextRequest } from 'next/server'
import { UUID, apiError, apiJson, authBotApi, readJson } from '@/lib/services/bot/botApi'
import { collectImages, saveTaskImage } from '@/lib/services/bot/botImages'
import { DATE_REQUIRED, UPDATE_KINDS, canEditTask, getTaskRow, isYmd, type BotUpdateKind } from '@/lib/services/bot/botTasks'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const id = (await params).id
  if (!UUID.test(id)) return apiError(404, 'ไม่พบงานนี้')
  const row = await getTaskRow(caller.sb, id)
  if (!row) return apiError(404, 'ไม่พบงานนี้')
  if (!canEditTask(caller, row)) return apiError(403, 'บันทึกความคืบหน้าได้เฉพาะแอดมิน คนสร้างงาน หรือผู้รับผิดชอบ')

  const body = await readJson(request)
  if (!body) return apiError(400, 'body ต้องเป็น JSON object')
  const kind = (body.kind ?? 'note') as BotUpdateKind
  if (!UPDATE_KINDS.includes(kind)) return apiError(400, `kind ต้องเป็น ${UPDATE_KINDS.join(' / ')}`)
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 5000) : ''
  const date = body.date ?? null
  if (date !== null && !isYmd(date)) return apiError(400, 'date ต้องเป็น YYYY-MM-DD')
  if (DATE_REQUIRED[kind] && !date) return apiError(400, `${kind} ต้องมี date (วันตามอีกที/วันนัด)`)
  if (kind === 'note' && !text && !date) return apiError(400, 'note ต้องมี body')
  const time = typeof body.time === 'string' && /^\d{2}:\d{2}$/.test(body.time) ? body.time : null
  const str = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 200) || null : null)

  // ตรวจ/ย่อรูปก่อนบันทึก — รูปพังจะได้ไม่เหลือรายการครึ่ง ๆ กลาง ๆ
  let images: Buffer[] = []
  if (body.images !== undefined) {
    if (!Array.isArray(body.images)) return apiError(400, 'images ต้องเป็น array ของลิงก์')
    if (body.images.length) {
      const r = await collectImages({ json: { urls: body.images } })
      if (typeof r === 'string') return apiError(400, r)
      images = r
    }
  }

  const { data, error } = await caller.sb
    .from('task_updates')
    .insert({
      task_id: id,
      kind,
      body: text,
      event_date: date as string | null,
      event_time: kind === 'appointment' ? time : null,
      waiting_for: kind === 'waiting' ? str(body.waiting_for) : null,
      waiting_on: kind === 'waiting' ? str(body.waiting_on) : null,
      created_by: caller.user.id,
    })
    .select('id, kind, body, event_date, old_due, new_due, created_at')
    .single()
  if (error) return apiError(500, error.message)

  const imageIds: string[] = []
  for (const [i, jpeg] of images.entries()) {
    try {
      imageIds.push(await saveTaskImage(caller.sb, id, jpeg, caller.user.id, { updateId: data.id, sortOrder: i + 1 }))
    } catch (e) {
      console.error('[bot] รูปในอัปเดตบันทึกไม่สำเร็จ:', e)
    }
  }

  const { data: t } = await caller.sb.from('tasks').select('status, due_date').eq('id', id).single()
  return apiJson(
    {
      update: {
        id: data.id,
        kind: data.kind,
        body: data.body || undefined,
        date: data.event_date ?? undefined,
        dueChange: data.new_due ? { from: data.old_due, to: data.new_due } : undefined,
        images: imageIds.length ? imageIds : undefined,
        at: data.created_at,
      },
      task: { id, status: t?.status, due: t?.due_date ?? null },
    },
    201
  )
}
