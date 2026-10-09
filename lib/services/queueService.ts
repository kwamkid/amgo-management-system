// lib/services/queueService.ts
//
// ฝั่งหน้าเว็บ: ดูความคืบหน้าของชุดงานในคิวกลาง (queue_jobs) — อ่านอย่างเดียว (RLS: เจ้าของเว็บ)
// ไว้ป้อน <QueueFloat> · ลงคิว/รันงานทำฝั่งเซิร์ฟเวอร์เท่านั้น (lib/queue)

import { createClient } from '@/lib/supabase/client'
import type { TrackedQueue } from '@/lib/queue/tracker'
import { getRankQueue } from '@/lib/services/seo/seoService'

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

// ── สถานะของคิวที่ติดตาม (แผงคิวลอยทั้งแอป — components/shared/GlobalQueue) ──


export type TrackedStatus = QueueGroupStatus & {
  /** เพิ่งสั่ง งานยังไม่โผล่ (กำลังส่งเข้าคิว) */
  starting: boolean
  note?: string
}

/** รองานโผล่หลังกดสั่งได้นานเท่านี้ — เกินแล้วถือว่าไม่มีงาน (เช่น ทุกคำเพิ่งเช็คไปแล้ววันนี้) */
const START_WAIT_MS = 3 * 60_000

export async function getTrackedStatus(q: TrackedQueue): Promise<TrackedStatus> {
  if (q.kind === 'group') return { ...(await getQueueGroup(q.ref)), starting: false }

  if (q.kind === 'rank') {
    const r = await getRankQueue(q.ref)
    // ชุดที่เห็นเก่ากว่าตอนกดสั่ง = งานยังไม่ถูกส่ง (ตัวรันคิวกำลังทำ seo.rank.post)
    const fresh = r && new Date(r.postedAt).getTime() >= q.startedAt - 10_000
    if (!fresh) {
      const waiting = Date.now() - q.startedAt < START_WAIT_MS
      return {
        total: 0,
        done: 0,
        failed: 0,
        active: waiting,
        running: [],
        starting: waiting,
        note: waiting ? 'กำลังส่งคำเข้าคิว DataForSEO…' : 'ไม่มีคำที่ต้องเช็ค (เช็คไปแล้ววันนี้ หรือติดเพดานงบ)',
      }
    }
    return {
      total: r!.total,
      done: r!.done + r!.failed,
      failed: r!.failed,
      active: r!.pending > 0,
      running: [],
      starting: false,
      note: r!.pending ? 'ผลแต่ละคำกลับมาเองเมื่อ Google ค้นเสร็จ (ปกติ 5–30 นาที)' : undefined,
    }
  }

  // fleet — ชุดงาน web_run_batches
  const { data, error } = await createClient()
    .from('web_run_batches')
    .select('total_jobs, done_jobs, failed_jobs, finished_at')
    .eq('id', q.ref)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return { total: 0, done: 0, failed: 0, active: false, running: [], starting: false, note: 'ไม่พบชุดงานนี้แล้ว' }
  return {
    total: data.total_jobs,
    done: data.done_jobs + data.failed_jobs,
    failed: data.failed_jobs,
    active: !data.finished_at,
    running: [],
    starting: false,
    note: data.finished_at ? undefined : 'โฮสต์ละ 1 งาน ระบบเดินต่อเองจนหมด',
  }
}
