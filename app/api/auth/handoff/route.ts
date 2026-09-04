// app/api/auth/handoff/route.ts
//
// ตู้ฝากของ session สำหรับล็อกอินจากแอปที่ติดตั้ง (ดู lib/auth/pwaHandoff.ts)
//
// POST {nonce, tokenHash, next}  — เบราว์เซอร์ที่ LINE ยิงกลับฝาก token ไว้
// GET  ?nonce=                    — แอปมาหยิบ · 200 = ได้ token (แถวถูกลบ) · 404 = ยังไม่มา
//
// ไม่ต้องล็อกอิน (ทั้งสองฝั่งยังไม่มี session) · ความปลอดภัยอยู่ที่ nonce 128 บิต
// ที่เดาไม่ได้ + แถวอายุ 10 นาที + หยิบได้ครั้งเดียว · token_hash เองก็ใช้ได้ครั้งเดียว
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NONCE_RE } from '@/lib/auth/pwaState'

const MAX_AGE_MS = 10 * 60 * 1000

function expiredBefore() {
  return new Date(Date.now() - MAX_AGE_MS).toISOString()
}

export async function POST(request: NextRequest) {
  let body: { nonce?: unknown; tokenHash?: unknown; next?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const nonce = typeof body.nonce === 'string' && NONCE_RE.test(body.nonce) ? body.nonce : null
  const tokenHash = typeof body.tokenHash === 'string' && body.tokenHash.length <= 200 ? body.tokenHash : null
  const next = typeof body.next === 'string' && body.next.startsWith('/') && body.next.length <= 100 ? body.next : null
  if (!nonce || !tokenHash) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const sb = createAdminClient()
  // เก็บกวาดแถวเก่าไปด้วยเลย — ไม่ต้องมี cron
  await sb.from('auth_handoffs').delete().lt('created_at', expiredBefore())

  const { error } = await sb
    .from('auth_handoffs')
    .upsert({ nonce, token_hash: tokenHash, next, created_at: new Date().toISOString() }, { onConflict: 'nonce' })
  if (error) {
    console.error('[handoff] ฝากไม่สำเร็จ:', error.message)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function GET(request: NextRequest) {
  const nonce = request.nextUrl.searchParams.get('nonce')
  if (!nonce || !NONCE_RE.test(nonce)) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const sb = createAdminClient()
  // ลบแล้วคืนค่าในคำสั่งเดียว — สองคนถามพร้อมกันได้แค่คนเดียว
  const { data, error } = await sb
    .from('auth_handoffs')
    .delete()
    .eq('nonce', nonce)
    .gte('created_at', expiredBefore())
    .select('token_hash, next')
    .maybeSingle()
  if (error) {
    console.error('[handoff] หยิบไม่สำเร็จ:', error.message)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ pending: true }, { status: 404 })
  return NextResponse.json({ tokenHash: data.token_hash, next: data.next })
}
