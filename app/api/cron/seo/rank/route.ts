// app/api/cron/seo/rank/route.ts
//
// อันดับคำเป้าหมาย (DataForSEO) — เก็บผลที่ค้าง แล้วส่งคำที่ถึงรอบ
//
//   GET  — ไม่ได้ตั้ง cron แยก (งานรายวันอยู่ใน /api/cron/seo/gsc-daily แล้ว) · ยิงเองได้ด้วย CRON_SECRET
//          เก็บผลที่ค้าง แล้วส่งเฉพาะคำที่ผลเก่ากว่า 7 วัน
//   POST — เจ้าของกดจากหน้าเว็บ · body { siteId, action: 'check' | 'collect' }
//          check = ส่งเช็คทั้งเว็บเดี๋ยวนี้ · collect = เก็บผลที่ค้างอยู่

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { hasDataForSeoCredentials } from '@/lib/services/seo/dataforseo'
import { collectRanks, postDueRanks, RANK_BUDGET_MS } from '@/lib/services/seo/rankSync'
import { requireWebOwner } from '@/lib/services/seo/owner'
import { sendSeoDigest } from '@/lib/services/seo/seoAlerts'

export const maxDuration = 60

async function run(opts: { siteId?: string; post: boolean; force?: boolean }) {
  if (!hasDataForSeoCredentials()) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้ง DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD' }, { status: 500 })
  }
  const sb = createAdminClient()
  const deadline = Date.now() + RANK_BUDGET_MS
  try {
    const collected = await collectRanks(sb, deadline)
    // ผลที่หน้าเว็บเก็บก่อน cron = cron ไม่เห็นความเปลี่ยนแปลงแล้ว → แจ้งจากตรงนี้แทน
    if (collected.events.length) await sendSeoDigest(sb, collected.events, []).catch(() => {})
    const posted = opts.post ? await postDueRanks(sb, { siteId: opts.siteId, force: opts.force }) : null
    return NextResponse.json({ success: true, collected: { ...collected, events: collected.events.length }, posted })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return run({ post: true })
}

export async function POST(request: NextRequest) {
  if (isAuthorizedCron(request)) return run({ post: true })
  if (!(await requireWebOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  return run({ siteId: body?.siteId, post: body?.action === 'check', force: true })
}
