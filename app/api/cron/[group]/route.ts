// app/api/cron/[group]/route.ts — cron-job.org calls one URL per group every 10 min
//   https://app.amgovenger.com/api/cron/people · /web · /data   (Authorization: Bearer <CRON_SECRET>)
// Groups + jobs: lib/cron/schedule.ts · contract: lib/cron/dispatch.ts · board: /settings/system

import { NextRequest, NextResponse } from 'next/server'
import { handleCron } from '@/lib/cron/dispatch'
import { isCronGroup } from '@/lib/cron/schedule'

export const maxDuration = 60

type Ctx = { params: Promise<{ group: string }> }

async function handle(request: NextRequest, { params }: Ctx) {
  const { group } = await params
  if (!isCronGroup(group)) return NextResponse.json({ error: `ไม่รู้จักกลุ่ม ${group}` }, { status: 404 })
  return handleCron(request, group)
}

export const GET = handle
export const POST = handle
