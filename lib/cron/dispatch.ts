// lib/cron/dispatch.ts
//
// Shared handler of /api/cron/<group> and /api/cron/tick (= every group).
// Same contract as aoocommerce app/api/cron/[group]: claim due jobs (cron_runs lock), start them,
// wait ≤ 25 s (cron-job.org waits 30 s). A job that finished failed → 502 so cron-job.org e-mails
// ("Notify on failure" on every group). Jobs still running finish in after() and record their own
// heartbeat + cron_runs row. ?dry=1[&at=<ISO>] = show due jobs without claiming.

import { after, NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { CRON_JOBS, currentSlots, type CronGroup } from './schedule'
import { claimDue, pruneRuns, recordDispatch, settleWithin, startClaimed } from './runner'

const WAIT_MS = 25_000

export async function handleCron(request: NextRequest, group: CronGroup | 'tick') {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized', hint: 'ต้องส่ง Authorization: Bearer <CRON_SECRET>' }, { status: 401 })
  }
  const only = group === 'tick' ? undefined : group

  const params = request.nextUrl.searchParams
  if (params.get('dry') === '1') {
    const at = params.get('at') ? new Date(params.get('at')!) : new Date()
    if (Number.isNaN(at.getTime())) return NextResponse.json({ error: 'at ต้องเป็นวันเวลา ISO' }, { status: 400 })
    const jobs = only ? CRON_JOBS.filter((j) => j.group === only) : CRON_JOBS
    return NextResponse.json({ group, at: at.toISOString(), slots: currentSlots(at, jobs).map((s) => ({ job: s.job.key, slot: s.slot })) })
  }

  const claimed = await claimDue(new Date(), only)
  const started = startClaimed(claimed, request.nextUrl.origin)
  const settled = await settleWithin(started, WAIT_MS)
  const failed = await recordDispatch(group, settled)
  after(async () => {
    await Promise.allSettled(started.map((s) => s.done))
    await pruneRuns()
  })

  const ran = settled.map((s) => ({
    job: `${s.key}@${s.slot}`,
    state: s.state === 'running' ? 'running' : s.state.ok ? 'ok' : 'failed',
  }))
  return NextResponse.json({ group, ran, failed }, { status: failed.length ? 502 : 200 })
}
