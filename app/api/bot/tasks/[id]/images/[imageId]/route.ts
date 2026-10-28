// DELETE /api/bot/tasks/{id}/images/{imageId} — ลบรูป (แถว + ไฟล์)
//   สิทธิ์เท่าหน้าเว็บ: แอดมิน · คนสร้าง · ผู้รับผิดชอบ (task_images_delete)
import type { NextRequest } from 'next/server'
import { UUID, apiError, apiJson, authBotApi } from '@/lib/services/bot/botApi'
import { listTaskImages, removeTaskImages } from '@/lib/services/bot/botImages'
import { canEditTask, getTaskRow } from '@/lib/services/bot/botTasks'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const { id, imageId } = await params
  if (!UUID.test(id) || !UUID.test(imageId)) return apiError(404, 'ไม่พบรูปนี้')
  const row = await getTaskRow(caller.sb, id)
  if (!row) return apiError(404, 'ไม่พบงานนี้')
  if (!canEditTask(caller, row)) return apiError(403, 'ลบรูปได้เฉพาะแอดมิน คนสร้างงาน หรือผู้รับผิดชอบ')

  const { data: img } = await caller.sb.from('task_images').select('id, path').eq('id', imageId).eq('task_id', id).maybeSingle()
  if (!img) return apiError(404, 'ไม่พบรูปนี้')
  try {
    await removeTaskImages(caller.sb, [img])
  } catch (e) {
    return apiError(500, (e as Error).message)
  }
  return apiJson({ deleted: imageId, images: await listTaskImages(caller.sb, id) })
}
