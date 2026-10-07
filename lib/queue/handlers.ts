// lib/queue/handlers.ts
//
// ตัวทำงานของแต่ละชนิดงานในคิวกลาง — งานละชิ้นเล็ก จบใน ~40 วิ
// เพิ่มชนิดใหม่: ใส่ฟังก์ชันใน QUEUE_HANDLERS แล้วลงคิวด้วย enqueue({ kind: '<ชื่อ>' })

import type { QueueHandler, QueueJob } from './queue'
import type { AeoEngine } from '@/lib/services/seo/aeo'
import { syncGsc } from '@/lib/services/seo/gscSync'
import { collectRanks, postDueRanks } from '@/lib/services/seo/rankSync'
import { askOne } from '@/lib/services/seo/aeoSync'
import type { AeoEvent } from '@/lib/services/seo/aeoSync'
import { syncBing } from '@/lib/services/seo/bing'
import { sendSeoDigest } from '@/lib/services/seo/seoAlerts'

const p = <T,>(job: QueueJob, key: string) => job.payload[key] as T

export const QUEUE_HANDLERS: Record<string, QueueHandler> = {
  /** ดึง Search Console 1 เว็บ (ช่วงล่าสุด + backfill ต่อเท่าที่ทัน) */
  'seo.gsc': async (sb, job) => {
    const r = await syncGsc(sb, { siteId: p<string>(job, 'siteId'), budgetMs: 35_000 })
    const bad = r.find((x) => x.status === 'error')
    if (bad) throw new Error(bad.detail)
    return { result: r }
  },

  /** ส่งคำที่ถึงรอบไปเช็คอันดับ — ผลกลับมาเองทาง pingback · ลงงานเก็บผลสำรองไว้ด้วย */
  'seo.rank.post': async (sb, job) => {
    const r = await postDueRanks(sb, { siteId: p<string>(job, 'siteId'), force: p<boolean>(job, 'force') })
    if (r.posted) {
      const { count } = await sb
        .from('queue_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('kind', 'seo.rank.collect')
        .in('status', ['queued', 'running'])
      if (!count) {
        await sb.from('queue_jobs').insert({
          kind: 'seo.rank.collect',
          label: 'เก็บผลอันดับที่ค้าง',
          group_key: job.group_key,
          max_attempts: 5,
          run_after: new Date(Date.now() + 8 * 60_000).toISOString(),
        })
      }
    }
    return { result: r }
  },

  /** สำรอง pingback — ถามผลที่ยังค้าง · ยังมีค้าง = กลับมาใหม่อีก 5 นาที */
  'seo.rank.collect': async (sb) => {
    const r = await collectRanks(sb, Date.now() + 30_000)
    if (r.events.length) await sendSeoDigest(sb, r.events, []).catch(() => {})
    const { count } = await sb
      .from('seo_rank_tasks')
      .select('task_id', { count: 'exact', head: true })
      .eq('status', 'pending')
    const result = { done: r.done, waiting: r.waiting, failed: r.failed, events: r.events.length }
    return count ? { result, retryAfterMs: 5 * 60_000 } : { result }
  },

  /** ถาม AI 1 ข้อ */
  'seo.aeo.ask': async (sb, job) => {
    const r = await askOne(sb, p<string>(job, 'promptId'), p<AeoEngine>(job, 'engine'))
    return { result: r }
  },

  'seo.bing': async (sb) => ({ result: await syncBing(sb) }),

  /**
   * สรุปเข้า Discord หลังงานในชุดเดียวกันจบ — ยังมีงานในชุดค้าง = รอ 10 นาที (สูงสุด 3 ชม. แล้วส่งเท่าที่มี)
   * รวม event ของการถาม AI ในชุดนี้ (อันดับแจ้งเองตอนผลกลับมา)
   */
  'seo.digest': async (sb, job) => {
    const group = job.group_key
    const { data: rows } = await sb
      .from('queue_jobs')
      .select('kind, status, result, created_at')
      .eq('group_key', group ?? '')
      .neq('kind', 'seo.digest')
    const pending = (rows ?? []).filter((r) => r.status === 'queued' || r.status === 'running')
    const oldest = Math.min(...(rows ?? []).map((r) => new Date(r.created_at).getTime()), Date.now())
    if (pending.length && Date.now() - oldest < 3 * 3600_000) return { retryAfterMs: 10 * 60_000 }
    const events = (rows ?? [])
      .filter((r) => r.kind === 'seo.aeo.ask' && r.status === 'done')
      .map((r) => (r.result as { event?: AeoEvent | null } | null)?.event)
      .filter((e): e is AeoEvent => !!e)
    return { result: await sendSeoDigest(sb, [], events) }
  },

  /** ล้างประวัติคิวเก่ากว่า 30 วัน */
  'queue.prune': async (sb) => {
    const { error } = await sb.rpc('queue_prune')
    if (error) throw new Error(error.message)
  },
}
