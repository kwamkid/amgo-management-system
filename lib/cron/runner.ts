// lib/cron/runner.ts
//
// ตัวรันของ cron กลาง (server เท่านั้น) — จองรอบใน cron_runs แล้วทำงาน แล้วจดผล
// ตารางเวลาอยู่ที่ lib/cron/schedule.ts · ทางเข้าคือ app/api/cron/tick
//
// inline: เรียก handler ของ route เดิมตรง ๆ ในโปรเซสเดียวกัน (ส่ง CRON_SECRET ไปเหมือน cron-job.org)
//         → route เดิมยังเรียกมือได้เหมือนเดิม ไม่ต้องแยกโค้ดออกมา
// http:   ยิงไปที่ route (มี maxDuration ของตัวเอง) รอผลไม่เกิน 55 วิ แล้วจดผล

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDailyTaskReminders } from '@/lib/tasks/notify'
import { GET as autoCheckout } from '@/app/api/cron/auto-checkout/route'
import { GET as checkoutReminder } from '@/app/api/cron/checkout-reminder/route'
import { GET as birthday } from '@/app/api/cron/birthday/route'
import { GET as payrollCutoff } from '@/app/api/cron/payroll-cutoff/route'
import { currentSlots, type CronJob } from './schedule'

const HTTP_TIMEOUT_MS = 55_000
const KEEP_DAYS = 30

type Outcome = { ok: boolean; result: unknown }

const authHeaders = () => ({ Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` })

async function readResponse(res: Response): Promise<Outcome> {
  let body: unknown = null
  try {
    body = await res.json()
  } catch {}
  return { ok: res.ok, result: { status: res.status, body } }
}

/** route เดิมเรียกในโปรเซส — ทำ NextRequest ปลอมที่มีรหัส cron */
const viaRoute = (handler: (r: NextRequest) => Promise<Response>, path: string) => async (origin: string) =>
  readResponse(await handler(new NextRequest(new URL(path, origin), { headers: authHeaders() })))

const INLINE: Record<string, (origin: string) => Promise<Outcome>> = {
  'auto-checkout': viaRoute(autoCheckout, '/api/cron/auto-checkout'),
  'checkout-reminder': viaRoute(checkoutReminder, '/api/cron/checkout-reminder'),
  birthday: viaRoute(birthday, '/api/cron/birthday'),
  'payroll-cutoff': viaRoute(payrollCutoff, '/api/cron/payroll-cutoff'),
  'task-reminders': async () => ({ ok: true, result: await sendDailyTaskReminders() }),
}

/** ตาราง cron_runs ยังไม่อยู่ใน types/database.ts */
const db = () => createAdminClient() as unknown as SupabaseClient

/** มีงานค้างในคิวเว็บ/คิวกลางไหม — ไม่มีก็ไม่ต้องปลุก jobs/next (ประหยัด invocation) */
async function hasQueuedWork(sb: SupabaseClient): Promise<boolean> {
  const [web, central] = await Promise.all([
    sb.from('web_jobs').select('id', { count: 'exact', head: true }).in('status', ['queued', 'running']),
    sb.from('queue_jobs').select('id', { count: 'exact', head: true }).in('status', ['queued', 'running']).lte('run_after', new Date().toISOString()),
  ])
  return (web.count ?? 0) + (central.count ?? 0) > 0
}

/** งานที่ถึงรอบตอนนี้ และจองรอบได้ (คืนเฉพาะที่ tick นี้ต้องทำ) */
export async function claimDue(now = new Date()): Promise<{ job: CronJob; slot: string }[]> {
  const sb = db()
  const out: { job: CronJob; slot: string }[] = []
  for (const s of currentSlots(now)) {
    if (s.job.whenQueued && !(await hasQueuedWork(sb))) continue
    const { data, error } = await sb
      .from('cron_runs')
      .upsert({ job: s.job.key, slot: s.slot }, { onConflict: 'job,slot', ignoreDuplicates: true })
      .select('job')
    if (error) {
      console.error('[cron] จองรอบไม่สำเร็จ', s.job.key, error.message)
      continue
    }
    if (data?.length) out.push(s)
  }
  return out
}

async function runOne(job: CronJob, origin: string): Promise<Outcome> {
  try {
    if (job.run === 'inline') {
      const fn = INLINE[job.key]
      if (!fn) return { ok: false, result: { error: `ไม่มีตัวรัน inline ของ ${job.key}` } }
      return await fn(origin)
    }
    const res = await fetch(new URL(job.run.http, origin), {
      headers: authHeaders(),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    })
    return await readResponse(res)
  } catch (e) {
    return { ok: false, result: { error: (e as Error).message } }
  }
}

/** ทำงานที่จองไว้ — inline ทีละงาน (เบา) · http พร้อมกัน · จดผลทุกงาน · ลบประวัติเก่า */
export async function runClaimed(claimed: { job: CronJob; slot: string }[], origin: string): Promise<void> {
  const sb = db()
  const finish = async ({ job, slot }: { job: CronJob; slot: string }, o: Outcome) => {
    const result = JSON.stringify(o.result ?? null)
    await sb
      .from('cron_runs')
      .update({
        finished_at: new Date().toISOString(),
        ok: o.ok,
        // ผลบางงานยาว (รายชื่อเว็บ/รายงาน) — เก็บแค่พอดู
        result: result.length > 4000 ? { truncated: result.slice(0, 4000) } : o.result ?? null,
      })
      .eq('job', job.key)
      .eq('slot', slot)
    if (!o.ok) console.error('[cron] งานล้ม', job.key, slot, result.slice(0, 500))
  }

  const inline = claimed.filter((c) => c.job.run === 'inline')
  const http = claimed.filter((c) => c.job.run !== 'inline')
  await Promise.allSettled([
    (async () => {
      for (const c of inline) await finish(c, await runOne(c.job, origin))
    })(),
    ...http.map(async (c) => finish(c, await runOne(c.job, origin))),
  ])

  await sb.from('cron_runs').delete().lt('started_at', new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString())
}
