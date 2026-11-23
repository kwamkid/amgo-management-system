// lib/monitor/heartbeat.ts
//
// Heartbeats of background jobs — "when did this job last succeed" (table system_heartbeats, 1 row per job).
// Same design as aoocommerce lib/monitor/heartbeat.ts (owner 2026-11-23).
//   dispatch: /api/cron/[group] records the group call (key cron:<group>) and each job it reached
//   start/finish: trackJob(<CronJob.key>, fn) around the real work · queue:<kind> from drainQueue
// Board: /settings/system (lib/monitor/health.ts).
//
// ⚠️ Failing to record must never fail the real job — every call swallows its error and logs.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export interface HeartbeatEvent {
  key: string
  event: 'dispatch' | 'start' | 'finish'
  ok?: boolean
  status?: number
  error?: string | null
  duration_ms?: number
  summary?: unknown
}

/** system_heartbeats is not in types/database.ts yet */
const db = () => createAdminClient() as unknown as SupabaseClient

export async function recordHeartbeats(events: HeartbeatEvent[]): Promise<void> {
  if (!events.length) return
  try {
    const { error } = await db().rpc('record_heartbeats', {
      p_events: events.map((e) => ({ ...e, error: e.error ? String(e.error).slice(0, 500) : null })),
    })
    if (error) console.error('[heartbeat] record failed:', error.message)
  } catch (e) {
    console.error('[heartbeat] record failed:', (e as Error).message)
  }
}

/** Keep summaries small — they are shown on the board, not stored as history */
export function shortSummary(v: unknown): unknown {
  const s = JSON.stringify(v ?? null)
  return s.length > 2000 ? { truncated: s.slice(0, 2000) } : v ?? null
}

export interface JobOutcome {
  ok: boolean
  result?: unknown
  error?: string
}

/**
 * Wrap the real work of a job so the board sees start, finish, error and duration.
 * throw = failed (recorded, then returned as { ok: false } — nobody catches inside after()).
 */
export async function trackJob(key: string, fn: () => Promise<JobOutcome>): Promise<JobOutcome> {
  const started = Date.now()
  await recordHeartbeats([{ key, event: 'start' }])
  let out: JobOutcome
  try {
    out = await fn()
  } catch (e) {
    out = { ok: false, error: (e as Error).message }
  }
  const error = out.ok ? null : out.error ?? errorOf(out.result)
  await recordHeartbeats([
    { key, event: 'finish', ok: out.ok, error, duration_ms: Date.now() - started, summary: shortSummary(out.result) },
  ])
  return out
}

/** pull a readable error out of a route's JSON answer ({ status, body: { error } }) */
function errorOf(result: unknown): string {
  const r = result as { status?: number; body?: { error?: string } | null; error?: string } | null
  return r?.body?.error ?? r?.error ?? (r?.status ? `HTTP ${r.status}` : 'ล้มเหลว')
}
