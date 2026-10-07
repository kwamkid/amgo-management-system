// lib/queue/queue.ts
//
// คิวงานกลาง — ฝั่งเซิร์ฟเวอร์เท่านั้น (ใช้ service role)
//
// ── ใช้ยังไง ─────────────────────────────────────────────────────────────
//   await enqueue(sb, [{ kind: 'seo.gsc', payload: { siteId }, groupKey, label }])
//   kickQueue(origin)   ← ปลุกตัวรันทันที (ไม่ต้องรอ cron) · เรียกใน after() ของ route
// งานชนิดใหม่: เพิ่มตัวทำงานใน lib/queue/handlers.ts แค่นั้น
//
// ── ตัวรัน (/api/queue/run) ──────────────────────────────────────────────
// ตอบ 202 ทันที แล้วใน after(): หยิบงาน (queue_claim) ทีละไม่เกิน 6 ทำพร้อมกัน วนจนใกล้ 45 วิ
// ยังเหลืองาน = เรียกตัวเองต่อ (function ใหม่ ได้ 60 วิ ใหม่) · งานฟลีต (web_jobs) ปลุกตัวรันของมันด้วย
// cron-job.org ทุก 2 นาที (/api/web/jobs/next) เป็นตัวสำรอง เผื่อการปลุกหลุด
//
// ── งานพัง ─────────────────────────────────────────────────────────────
// throw = ลองใหม่ (รอ 1, 2, 4 … นาที) จนครบ max_attempts แล้วเป็น failed
// คืน { retryAfterMs } = ยังไม่พร้อม รอแล้วทำใหม่ (ไม่นับว่าพัง เช่น รอผลจาก DataForSEO)

import type { SupabaseClient } from '@supabase/supabase-js'
import { QUEUE_HANDLERS } from './handlers'

export type QueueJobInput = {
  kind: string
  payload?: Record<string, unknown>
  groupKey?: string
  label?: string
  priority?: number
  maxAttempts?: number
  /** เริ่มได้เมื่อไหร่ (ค่าเริ่มต้น = ทันที) */
  runAfter?: Date
  createdBy?: string | null
}

export type QueueJob = {
  id: number
  kind: string
  group_key: string | null
  label: string | null
  payload: Record<string, unknown>
  attempts: number
  max_attempts: number
}

/** ผลของตัวทำงาน — result เก็บลงแถว (โชว์/สรุปทีหลังได้) */
export type HandlerResult = { result?: unknown; retryAfterMs?: number } | void

export type QueueHandler = (sb: SupabaseClient, job: QueueJob) => Promise<HandlerResult>

export async function enqueue(sb: SupabaseClient, jobs: QueueJobInput[]) {
  if (!jobs.length) return 0
  const { error } = await sb.from('queue_jobs').insert(
    jobs.map((j) => ({
      kind: j.kind,
      payload: j.payload ?? {},
      group_key: j.groupKey ?? null,
      label: j.label ?? null,
      priority: j.priority ?? 5,
      max_attempts: j.maxAttempts ?? 3,
      run_after: (j.runAfter ?? new Date()).toISOString(),
      created_by: j.createdBy ?? null,
    }))
  )
  if (error) throw new Error(`ลงคิวไม่ได้: ${error.message}`)
  return jobs.length
}

/**
 * ปลุกตัวรัน — รอแค่ให้ตัวรันรับงาน (ตอบ 202 ใน ~1 วิ) · ส่ง secret ทาง header เท่านั้น
 * origin = request.nextUrl.origin ของ route ที่เรียก
 */
export async function kickQueue(origin: string, path = '/api/queue/run') {
  await fetch(new URL(path, origin), {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
    signal: AbortSignal.timeout(10_000),
  }).catch((e) => console.error('[queue] kick', path, (e as Error).message))
}

const CLAIM = 6
/** หยุดหยิบงานใหม่หลังวินาทีนี้ (งานหนึ่งไม่ควรเกิน ~15 วิ — ไม่ทันก็ถูกตัดแล้วกลับเข้าคิวเอง) */
const RUN_BUDGET_MS = 40_000

/** ทำงานในคิวจนใกล้หมดเวลา · คืน { ran, left } — left = ยังมีงานที่ถึงเวลาเหลือไหม */
export async function drainQueue(sb: SupabaseClient) {
  const started = Date.now()
  let ran = 0
  while (Date.now() - started < RUN_BUDGET_MS) {
    const { data, error } = await sb.rpc('queue_claim', { p_limit: CLAIM })
    if (error) throw new Error(error.message)
    const jobs = (data ?? []) as QueueJob[]
    if (!jobs.length) break
    await Promise.all(jobs.map((j) => runOne(sb, j)))
    ran += jobs.length
  }
  const { count } = await sb
    .from('queue_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued')
    .lte('run_after', new Date().toISOString())
  return { ran, left: (count ?? 0) > 0 }
}

async function runOne(sb: SupabaseClient, job: QueueJob) {
  const handler = QUEUE_HANDLERS[job.kind]
  const done = (patch: Record<string, unknown>) => sb.from('queue_jobs').update(patch).eq('id', job.id)
  if (!handler) {
    await done({ status: 'failed', finished_at: new Date().toISOString(), error: `ไม่รู้จักงานชนิด ${job.kind}` })
    return
  }
  try {
    const r = (await handler(sb, job)) || {}
    if (r.retryAfterMs != null) {
      // ยังไม่พร้อม — กลับเข้าคิว ไม่นับครั้งนี้
      await done({
        status: 'queued',
        attempts: Math.max(0, job.attempts - 1),
        run_after: new Date(Date.now() + r.retryAfterMs).toISOString(),
        result: r.result ?? null,
      })
      return
    }
    await done({ status: 'done', finished_at: new Date().toISOString(), result: r.result ?? null, error: null })
  } catch (e) {
    const msg = (e as Error).message.slice(0, 1000)
    const last = job.attempts >= job.max_attempts
    console.error('[queue]', job.kind, job.id, msg)
    await done(
      last
        ? { status: 'failed', finished_at: new Date().toISOString(), error: msg }
        : {
            status: 'queued',
            error: msg,
            run_after: new Date(Date.now() + 60_000 * 2 ** (job.attempts - 1)).toISOString(),
          }
    )
  }
}
