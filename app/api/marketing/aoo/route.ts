// app/api/marketing/aoo/route.ts — admin only
// GET  → aoo brand names + marketplace shops + aoosocial accounts (pickers on /marketing/settings)
// POST { brand, from, to } → "ดึงตัวเลข": queue a re-sync of that brand's aoo sales + aoosocial post count (≤ 400 days)
//      → { groupKey } — the page follows it with getQueueGroup

import { after, NextRequest, NextResponse } from 'next/server'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { getCurrentUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enqueue, kickQueue } from '@/lib/queue/queue'
import { aooMcp, type AooOverview } from '@/lib/aoo/mcp'
import { aoosocialDb } from '@/lib/aoosocial/db'
import { aooSalesJob } from '@/lib/marketing/aooSales'
import { socialPostsJob } from '@/lib/marketing/socialPosts'
import { brandLabel } from '@/lib/constants/brands'

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
  const [o, acc] = await Promise.allSettled([
    aooMcp<AooOverview>('company_overview'),
    aoosocialDb()
      .from('social_accounts')
      .select('id, platform, display_name, status, company_id, company:companies(name)')
      .neq('status', 'revoked')
      .order('display_name')
      .limit(500),
  ])
  if (o.status === 'rejected') return NextResponse.json({ error: (o.reason as Error).message }, { status: 502 })
  type Acc = { id: string; platform: string; display_name: string; status: string; company_id: string; company: { name: string } | null }
  const accounts = acc.status === 'fulfilled' && !acc.value.error ? ((acc.value.data ?? []) as unknown as Acc[]) : []
  return NextResponse.json({
    brands: o.value.brands,
    shops: o.value.marketplace_shops.filter((s) => s.is_active).map((s) => ({ name: s.shop_name, platform: s.platform })),
    socialAccounts: accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      name: a.display_name,
      companyId: a.company_id,
      company: a.company?.name ?? '',
      needsReconnect: a.status !== 'active',
    })),
    socialError: acc.status === 'rejected' ? (acc.reason as Error).message : acc.value.error?.message ?? null,
  })
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
  await enqueue(createAdminClient(), [
    { ...aooSalesJob(brand, from, to, groupKey), priority: 2, createdBy: me.id },
    { ...socialPostsJob(brand, from, to, groupKey, brandLabel(brand)), priority: 2, createdBy: me.id },
  ])
  const origin = req.nextUrl.origin
  after(() => kickQueue(origin))
  return NextResponse.json({ groupKey })
}
