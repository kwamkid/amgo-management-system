// app/api/system/health/route.ts — admin only · board /settings/system
// GET            → { at, groups, jobs, queue } status lights (lib/monitor/health.ts)
// GET ?job=<key> → last 30 cron_runs of that cron job · ?queue=<kind> → last 30 finished queue jobs

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { getCronRuns, getHealth, getQueueRuns } from '@/lib/monitor/health'

export async function GET(req: NextRequest) {
  const cur = await getCurrentUser()
  if (!cur) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  if (cur.profile.role !== 'admin') return NextResponse.json({ error: 'เฉพาะแอดมิน' }, { status: 403 })
  try {
    const job = req.nextUrl.searchParams.get('job')
    const kind = req.nextUrl.searchParams.get('queue')
    if (job) return NextResponse.json({ runs: await getCronRuns(job) })
    if (kind) return NextResponse.json({ runs: await getQueueRuns(kind) })
    return NextResponse.json(await getHealth())
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
