// app/api/cron/tick/route.ts
//
// Every cron group at once (owner 2026-11-20 → split into groups 2026-11-23).
// cron-job.org now calls /api/cron/<group> per group (app/api/cron/[group]); tick stays for manual
// runs and the switch-over — the cron_runs lock stops a job running twice if both fire.
// ?dry=1[&at=<ISO>] = which jobs are due then, without claiming or running.

import { NextRequest } from 'next/server'
import { handleCron } from '@/lib/cron/dispatch'

export const maxDuration = 60

export const GET = (request: NextRequest) => handleCron(request, 'tick')
// some schedulers send POST by default
export const POST = GET
