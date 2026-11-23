// GET /api/marketing/calendar?brand=&from=&to= → the brand's aoosocial posts (ปฏิทินโพสต์ tab)
// Access = marketing_can(brand) of the signed-in user (same rule as the plan pages).

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { brandPosts } from '@/lib/marketing/socialPosts'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const brand = q.get('brand') ?? ''
  const from = q.get('from') ?? ''
  const to = q.get('to') ?? ''
  if (!brand || !DATE.test(from) || !DATE.test(to) || to < from) return NextResponse.json({ error: 'ต้องมี brand, from, to' }, { status: 400 })
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  const sb = await createServerSupabase()
  const { data: can } = await sb.rpc('marketing_can', { p_brand: brand })
  if (!can) return NextResponse.json({ error: 'ไม่มีสิทธิ์แบรนด์นี้' }, { status: 403 })
  try {
    return NextResponse.json({ posts: await brandPosts(createAdminClient(), brand, from, to) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
