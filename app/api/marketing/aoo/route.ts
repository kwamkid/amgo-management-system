// app/api/marketing/aoo/route.ts — admin only
// GET  → aoo brand names + marketplace shops (pickers on /marketing/settings)
// POST { brand, from, to } → "ดึงยอดตอนนี้": queue a re-sync of that brand's aoo sales (≤ 400 days)
//      → { groupKey } — the page follows it with getQueueGroup

import { after, NextRequest, NextResponse } from 'next/server'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { getCurrentUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enqueue, kickQueue } from '@/lib/queue/queue'
import { aooMcp, type AooOverview } from '@/lib/aoo/mcp'
import { aooSalesJob } from '@/lib/marketing/aooSales'

const DATE = /^\d{4}-\d{2}-\d{2}$/

async function admin(): Promise<{ id: string } | NextResponse> {
  const cur = await getCurrentUser()
  if (!cur) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  if (cur.profile.role !== 'admin') return NextResponse.json({ error: 'เฉพาะแอดมิน' }, { status: 403 })
  return { id: cur.profile.id }
}

export async function GET() {
  const me = await admin()
  if (me instanceof NextResponse) return me
  try {
    const o = await aooMcp<AooOverview>('company_overview')
    return NextResponse.json({
      brands: o.brands,
      shops: o.marketplace_shops.filter((s) => s.is_active).map((s) => ({ name: s.shop_name, platform: s.platform })),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const me = await admin()
  if (me instanceof NextResponse) return me
  const { brand, from, to } = (await req.json().catch(() => ({}))) as { brand?: string; from?: string; to?: string }
  if (!brand || !from || !to || !DATE.test(from) || !DATE.test(to) || to < from)
    return NextResponse.json({ error: 'ต้องมี brand, from, to (YYYY-MM-DD)' }, { status: 400 })
  if (differenceInCalendarDays(parseISO(to), parseISO(from)) > 400)
    return NextResponse.json({ error: 'ช่วงยาวเกิน 400 วัน' }, { status: 400 })
  const groupKey = `marketing-sales:${brand}:${Date.now()}`
  await enqueue(createAdminClient(), [{ ...aooSalesJob(brand, from, to, groupKey), priority: 2, createdBy: me.id }])
  const origin = req.nextUrl.origin
  after(() => kickQueue(origin))
  return NextResponse.json({ groupKey })
}
