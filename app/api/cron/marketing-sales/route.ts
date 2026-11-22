// app/api/cron/marketing-sales/route.ts
//
// Daily (row 'marketing-sales' in lib/cron/schedule.ts): queue one job per brand that re-syncs
// its aoo sell-out for the last 7 days (orders get cancelled / edited a few days late).
// The work itself runs in the central queue — handler 'marketing.aoo.sales'.
// ?days=N (max 400) backfills further, e.g. once after linking a new brand.

import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { enqueue, kickQueue } from '@/lib/queue/queue'
import { BRANDS } from '@/lib/constants/brands'
import { aooSalesJob, periodBack } from '@/lib/marketing/aooSales'

async function run(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')) || 7, 1), 400)
  const { from, to } = periodBack(days)
  const db = createAdminClient()
  const { data, error } = await db.from('marketing_brand_links').select('brand')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const brands = [...new Set([...BRANDS.map((b) => b.slug), ...(data ?? []).map((l) => l.brand)])]
  const groupKey = `marketing-sales:${to}`
  await enqueue(db, brands.map((b) => aooSalesJob(b, from, to, groupKey)))
  const origin = req.nextUrl.origin
  after(() => kickQueue(origin))
  return NextResponse.json({ ok: true, queued: brands.length, from, to })
}

export const GET = run
export const POST = run
