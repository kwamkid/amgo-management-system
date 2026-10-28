// GET   /api/bot/tasks/{id}/images — รูปทั้งหมดของงาน (รูปของงาน + รูปในไทม์ไลน์) พร้อมลิงก์ 1 ชม.
//
// POST  /api/bot/tasks/{id}/images — เพิ่มรูป (ครั้งละไม่เกิน 5)
//   JSON { url | urls: [...], update_id?: "<รายการไทม์ไลน์>" }  — ลิงก์ไฟล์แนบ Discord
//   หรือ multipart/form-data  file=<รูป> (หลายไฟล์ได้) · update_id=<...>
//   ต่อท้ายลำดับเดิม · งานที่ยังไม่มีรูป รูปแรกที่ส่งมาเป็นปก
//
// PATCH /api/bot/tasks/{id}/images — เรียงใหม่ { order: ["<image id>", ...] }
//   ส่งเฉพาะรูปของงาน (เปลี่ยนปก) หรือเฉพาะรูปของรายการเดียวกัน — ห้ามปนกัน
//
// สิทธิ์: ดูได้ทุกคน · เพิ่ม/เรียง/ลบ = แอดมิน · คนสร้าง · ผู้รับผิดชอบ (can_access_task)
import type { NextRequest } from 'next/server'
import { UUID, apiError, apiJson, authBotApi, readJson } from '@/lib/services/bot/botApi'
import { collectImages, listTaskImages, saveTaskImage } from '@/lib/services/bot/botImages'
import { canEditTask, getTaskRow } from '@/lib/services/bot/botTasks'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const id = (await params).id
  if (!UUID.test(id) || !(await getTaskRow(a.caller.sb, id))) return apiError(404, 'ไม่พบงานนี้')
  return apiJson({ images: await listTaskImages(a.caller.sb, id) })
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const id = (await params).id
  if (!UUID.test(id)) return apiError(404, 'ไม่พบงานนี้')
  const row = await getTaskRow(caller.sb, id)
  if (!row) return apiError(404, 'ไม่พบงานนี้')
  if (!canEditTask(caller, row)) return apiError(403, 'เพิ่มรูปได้เฉพาะแอดมิน คนสร้างงาน หรือผู้รับผิดชอบ')

  const isForm = request.headers.get('content-type')?.includes('multipart/form-data')
  const form = isForm ? await request.formData().catch(() => null) : null
  const json = isForm ? null : await readJson(request)
  if (!form && !json) return apiError(400, 'body ต้องเป็น JSON หรือ multipart/form-data')

  const updateId = String((form ? form.get('update_id') : json?.update_id) ?? '').trim() || null
  if (updateId) {
    if (!UUID.test(updateId)) return apiError(400, 'update_id ไม่ถูกต้อง')
    const { data: u } = await caller.sb.from('task_updates').select('id').eq('id', updateId).eq('task_id', id).maybeSingle()
    if (!u) return apiError(404, 'ไม่พบรายการไทม์ไลน์นี้ในงาน')
  }

  const imgs = await collectImages({ form, json })
  if (typeof imgs === 'string') return apiError(400, imgs)

  // ต่อท้ายลำดับเดิมของกลุ่มเดียวกัน
  let q = caller.sb.from('task_images').select('sort_order').eq('task_id', id).order('sort_order', { ascending: false }).limit(1)
  q = updateId ? q.eq('update_id', updateId) : q.is('update_id', null)
  const { data: last } = await q.maybeSingle()
  const base = (last?.sort_order ?? 0) + 1

  const ids: string[] = []
  try {
    for (const [i, jpeg] of imgs.entries())
      ids.push(await saveTaskImage(caller.sb, id, jpeg, caller.user.id, { updateId, sortOrder: base + i }))
  } catch (e) {
    return apiError(500, (e as Error).message)
  }
  const all = await listTaskImages(caller.sb, id)
  return apiJson({ added: all.filter((x) => ids.includes(x.id)), images: all }, 201)
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const id = (await params).id
  if (!UUID.test(id)) return apiError(404, 'ไม่พบงานนี้')
  const row = await getTaskRow(caller.sb, id)
  if (!row) return apiError(404, 'ไม่พบงานนี้')
  if (!canEditTask(caller, row)) return apiError(403, 'เรียงรูปได้เฉพาะแอดมิน คนสร้างงาน หรือผู้รับผิดชอบ')

  const body = await readJson(request)
  const order = Array.isArray(body?.order) ? [...new Set(body.order.map(String))] : null
  if (!order?.length || order.some((x) => !UUID.test(x))) return apiError(400, 'ต้องส่ง { "order": ["<image id>", ...] }')

  const { data: rows } = await caller.sb.from('task_images').select('id, update_id').eq('task_id', id).in('id', order)
  if ((rows ?? []).length !== order.length) return apiError(400, 'มีรูปที่ไม่อยู่ในงานนี้')
  if (new Set(rows!.map((r) => r.update_id ?? '')).size > 1)
    return apiError(400, 'เรียงได้ทีละกลุ่ม — รูปของงาน หรือรูปของรายการเดียวกัน ห้ามปนกัน')

  // ตัวที่ส่งมาขึ้นก่อนตามลำดับ · ตัวที่ไม่ได้ส่งต่อท้ายตามลำดับเดิม
  const group = rows![0].update_id
  let q = caller.sb.from('task_images').select('id').eq('task_id', id).order('sort_order').order('created_at')
  q = group ? q.eq('update_id', group) : q.is('update_id', null)
  const { data: current } = await q
  const finalOrder = [...order, ...(current ?? []).map((r) => r.id).filter((x) => !order.includes(x))]
  const results = await Promise.all(
    finalOrder.map((imgId, i) => caller.sb.from('task_images').update({ sort_order: i + 1 }).eq('id', imgId))
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return apiError(500, failed.error.message)
  return apiJson({ images: await listTaskImages(caller.sb, id) })
}
