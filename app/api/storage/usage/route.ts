// app/api/storage/usage/route.ts
//
// GET  — พื้นที่ storage ใช้ไปเท่าไหร่ (hr/admin/manager) สำหรับการ์ดสถานะบนหน้ารายงานรูป
// POST — ตั้งโควตา (admin) เมื่ออัปเกรดแพลน Supabase · {quotaMb}
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readStorageUsage, setQuotaMb } from '@/lib/services/storageUsageService'

async function callerRole(): Promise<string | null> {
  const sb = await createServerSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await createAdminClient().from('users').select('role').eq('id', user.id).maybeSingle()
  return data?.role ?? null
}

export async function GET() {
  const role = await callerRole()
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['hr', 'admin', 'manager'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    return NextResponse.json(await readStorageUsage(createAdminClient()))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const role = await callerRole()
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  let body: { quotaMb?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const mb = Number(body.quotaMb)
  if (!Number.isFinite(mb) || mb < 100 || mb > 1_000_000) {
    return NextResponse.json({ error: 'โควตาต้องอยู่ระหว่าง 100 – 1,000,000 MB' }, { status: 400 })
  }
  const sb = createAdminClient()
  await setQuotaMb(sb, mb)
  return NextResponse.json(await readStorageUsage(sb))
}
