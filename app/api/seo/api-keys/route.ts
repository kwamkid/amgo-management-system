// app/api/seo/api-keys/route.ts — จัดการกุญแจ API ของ SEO (เจ้าของเมนูเท่านั้น)
//
//   GET                              → รายการกุญแจ (ไม่มีตัวกุญแจ — เก็บแค่ hash)
//   POST { label, siteIds? }         → สร้างใหม่ คืนตัวกุญแจเต็ม "ครั้งเดียว"
//   DELETE ?id=                      → เพิกถอน (ใช้ไม่ได้ทันที)
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase, verifiedUser } from '@/lib/supabase/server'
import { newApiKey } from '@/lib/services/seo/seoApi'

async function requireOwner() {
  const sb = await createServerSupabase()
  const user = await verifiedUser(sb)
  if (!user) return null
  const { data } = await sb.from('web_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  return data ? user : null
}

export async function GET() {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await createAdminClient()
    .from('seo_api_keys')
    .select('id, label, key_prefix, site_ids, created_at, last_used_at, revoked_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ keys: data })
}

export async function POST(request: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 100) : ''
  if (!label) return NextResponse.json({ error: 'ต้องตั้งชื่อกุญแจ (ใช้ทำอะไร)' }, { status: 400 })
  const siteIds = Array.isArray(body.siteIds) && body.siteIds.length
    ? body.siteIds.filter((s: unknown) => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s))
    : null
  const k = newApiKey()
  const { data, error } = await createAdminClient()
    .from('seo_api_keys')
    .insert({ label, key_hash: k.hash, key_prefix: k.prefix, site_ids: siteIds })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, key: k.key })
}

export async function DELETE(request: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 })
  const { error } = await createAdminClient().from('seo_api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
