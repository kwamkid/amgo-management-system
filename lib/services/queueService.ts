// lib/services/queueService.ts
//
// ฝั่งหน้าเว็บ: ดูความคืบหน้าของชุดงานในคิวกลาง (queue_jobs) — อ่านอย่างเดียว (RLS: เจ้าของเว็บ)
// ไว้ป้อน <QueueFloat> · ลงคิว/รันงานทำฝั่งเซิร์ฟเวอร์เท่านั้น (lib/queue)

import { createClient } from '@/lib/supabase/client'

/** งานเบื้องหลังของชุด (สรุป/ล้างประวัติ) ไม่นับเป็นความคืบหน้าที่คนรอดู */
const META_KINDS = ['seo.digest', 'seo.alerts.flush', 'queue.prune']

export type QueueGroupStatus = {
  total: number
  /** จบแล้ว (สำเร็จ + ล้มเหลว) */
  done: number
  failed: number
  active: boolean
  /** งานที่กำลังทำ — โชว์ว่าทำอะไรอยู่ */
  running: string[]
}

export async function getQueueGroup(groupKey: string): Promise<QueueGroupStatus> {
  const { data, error } = await createClient()
    .from('queue_jobs')
    .select('kind, status, label')
    .eq('group_key', groupKey)
    .limit(1000)
  if (error) throw new Error(error.message)
  const rows = (data ?? []).filter((r) => !META_KINDS.includes(r.kind))
  const failed = rows.filter((r) => r.status === 'failed').length
  const done = rows.filter((r) => r.status === 'done').length + failed
  return {
    total: rows.length,
    done,
    failed,
    active: done < rows.length,
    running: rows.filter((r) => r.status === 'running').map((r) => r.label ?? r.kind),
  }
}
