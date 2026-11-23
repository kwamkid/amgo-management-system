// lib/monitor/health.ts — server only
//
// Status light per background job for /settings/system (owner 2026-11-23, like aoocommerce superadmin ops).
//   group  cron:<group>  late = cron-job.org has not called it for 25 min · failing = last call answered 502
//   job    CronJob.key   late = its last due slot passed without a success · failing = last run failed
//   queue  queue:<kind>  failing = last final outcome failed (retries are not counted)

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { bangkokNow, CRON_GROUPS, CRON_JOBS, type CronGroup, type CronJob } from '@/lib/cron/schedule'

export type Light = 'ok' | 'running' | 'late' | 'failing' | 'never'

interface HeartbeatRow {
  key: string
  last_dispatch_at: string | null
  last_dispatch_ok_at: string | null
  last_dispatch_error: string | null
  dispatch_failures: number
  last_started_at: string | null
  last_finished_at: string | null
  last_ok_at: string | null
  last_error_at: string | null
  last_error: string | null
  last_duration_ms: number | null
  last_summary: unknown
  work_failures: number
}

export interface HealthItem {
  key: string
  label: string
  light: Light
  /** short Thai reason under the label */
  note: string
  group?: CronGroup
  schedule?: string
  lastAt: string | null
  lastOkAt: string | null
  lastError: string | null
  failures: number
  durationMs: number | null
}

export interface Health {
  at: string
  groups: HealthItem[]
  jobs: HealthItem[]
  queue: HealthItem[]
}

/** a group is called every 10 min — allow two misses */
const GROUP_LATE_MS = 25 * 60_000
/** a job stuck "started" this long is treated as died, not running */
const RUNNING_MAX_MS = 10 * 60_000
const BKK_OFFSET_MS = 7 * 3_600_000

const db = () => createAdminClient() as unknown as SupabaseClient
const ms = (iso: string | null) => (iso ? Date.parse(iso) : 0)
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function scheduleText(job: CronJob): string {
  if ('every' in job.when) {
    const n = job.when.every
    const every = n % 60 === 0 ? `ทุก ${n / 60} ชม.` : `ทุก ${n} นาที`
    return job.whenQueued ? `${every} (เฉพาะตอนมีงานในคิว)` : every
  }
  return `ทุกวัน ${job.when.daily}${job.when.until ? `–${job.when.until}` : ''} น.`
}

/** start of the most recent window that should have produced a success by now (ms) — null = never late */
function lastDueStart(job: CronJob, now: Date): number | null {
  if (job.whenQueued) return null
  const { date, min } = bangkokNow(now)
  const midnight = Date.parse(`${date}T00:00:00Z`) - BKK_OFFSET_MS
  if ('every' in job.when) {
    // the slot before the current one must be done (current may still be waiting for its tick)
    const start = Math.floor(min / job.when.every) * job.when.every - job.when.every
    return midnight + start * 60_000
  }
  const from = toMin(job.when.daily)
  // a day's window counts once it has closed (until) — or 1 h after start when there is no until
  const closes = job.when.until ? toMin(job.when.until) : from + 60
  const day = min > closes ? midnight : midnight - 86_400_000
  return day + from * 60_000
}

function workLight(hb: HeartbeatRow | undefined, now: number, dueStart: number | null): { light: Light; note: string } {
  if (!hb || (!hb.last_finished_at && !hb.last_started_at)) return { light: 'never', note: 'ยังไม่เคยทำงาน' }
  if (ms(hb.last_started_at) > ms(hb.last_finished_at) && now - ms(hb.last_started_at) < RUNNING_MAX_MS)
    return { light: 'running', note: 'กำลังทำงาน' }
  if (hb.work_failures > 0) return { light: 'failing', note: `ล้มติดกัน ${hb.work_failures} ครั้ง` }
  if (dueStart != null && ms(hb.last_ok_at) < dueStart) return { light: 'late', note: 'เลยรอบแล้วยังไม่ได้ทำ' }
  return { light: 'ok', note: 'ปกติ' }
}

const item = (key: string, label: string, hb: HeartbeatRow | undefined, l: { light: Light; note: string }) => ({
  key,
  label,
  ...l,
  lastAt: hb?.last_finished_at ?? hb?.last_dispatch_at ?? null,
  lastOkAt: hb?.last_ok_at ?? hb?.last_dispatch_ok_at ?? null,
  lastError: hb?.last_error ?? hb?.last_dispatch_error ?? null,
  failures: hb ? Math.max(hb.work_failures, hb.dispatch_failures) : 0,
  durationMs: hb?.last_duration_ms ?? null,
})

export async function getHealth(now = new Date()): Promise<Health> {
  const { data, error } = await db().from('system_heartbeats').select('*').limit(500)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as HeartbeatRow[]
  const by = new Map(rows.map((r) => [r.key, r]))
  const t = now.getTime()

  const groups = (Object.keys(CRON_GROUPS) as CronGroup[]).map((g) => {
    const hb = by.get(`cron:${g}`)
    let l: { light: Light; note: string }
    if (!hb?.last_dispatch_at) l = { light: 'never', note: 'cron-job.org ยังไม่เคยเรียก' }
    else if (t - ms(hb.last_dispatch_at) > GROUP_LATE_MS) l = { light: 'late', note: 'cron-job.org ไม่ได้เรียกเกิน 25 นาที' }
    else if (hb.dispatch_failures > 0) l = { light: 'failing', note: `งานที่ล้ม: ${hb.last_dispatch_error ?? '-'}` }
    else l = { light: 'ok', note: 'เรียกตามรอบปกติ' }
    return { ...item(`cron:${g}`, CRON_GROUPS[g], hb, l), group: g, lastAt: hb?.last_dispatch_at ?? null }
  })

  const jobs = CRON_JOBS.map((j) => {
    const hb = by.get(j.key)
    return { ...item(j.key, j.label, hb, workLight(hb, t, lastDueStart(j, now))), group: j.group, schedule: scheduleText(j) }
  })

  const queue = rows
    .filter((r) => r.key.startsWith('queue:'))
    .map((hb) => item(hb.key, hb.key.slice(6), hb, workLight(hb, t, null)))
    .sort((a, b) => a.label.localeCompare(b.label))

  return { at: now.toISOString(), groups, jobs, queue }
}

export interface CronRun {
  slot: string
  startedAt: string
  finishedAt: string | null
  ok: boolean | null
  result: unknown
}

/** last runs of one cron job (cron_runs keeps 30 days) */
export async function getCronRuns(job: string, limit = 30): Promise<CronRun[]> {
  const { data, error } = await db()
    .from('cron_runs')
    .select('slot, started_at, finished_at, ok, result')
    .eq('job', job)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({ slot: r.slot, startedAt: r.started_at, finishedAt: r.finished_at, ok: r.ok, result: r.result }))
}

/** last finished jobs of one queue kind (queue_jobs) */
export async function getQueueRuns(kind: string, limit = 30): Promise<CronRun[]> {
  const { data, error } = await db()
    .from('queue_jobs')
    .select('label, status, created_at, finished_at, result, error')
    .eq('kind', kind)
    .in('status', ['done', 'failed'])
    .order('finished_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    slot: r.label ?? '',
    startedAt: r.created_at,
    finishedAt: r.finished_at,
    ok: r.status === 'done',
    result: r.status === 'failed' ? { error: r.error } : r.result,
  }))
}
