// app/api/auth/liff/route.ts
//
// ล็อกอินผ่าน LIFF (หน้า /liff ที่เปิดอยู่ในแอป LINE) — ไม่มีหน้า login ของ LINE
//
// POST {accessToken, nonce?}
//   ไม่มี nonce → เปิดจากเมนู LINE OA ตรง ๆ: คืน {tokenHash, next} ให้แลก session ในแอป LINE เลย
//   มี nonce    → เริ่มจากปุ่ม LINE ในหน้า /login บนมือถือ (แอปที่ติดตั้ง/Safari/Chrome):
//                 ฝาก token ไว้ที่ auth_handoffs ให้หน้านั้นมาหยิบเอง (เหมือน /api/auth/handoff)
//                 token ไม่ผ่านแอป LINE เลย · คืน {handedOff: true}
//   ยังไม่มีในระบบ → {register: '/register?…'} · เข้าไม่ได้ → {error}
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchLineProfileFromLiff } from '@/lib/supabase/line-auth'
import { signInLineUser } from '@/lib/auth/lineSignIn'
import { createRegisterTicket } from '@/lib/supabase/register-ticket'
import { NONCE_RE } from '@/lib/auth/pwaState'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let body: { accessToken?: unknown; nonce?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'auth_failed' }, { status: 400 })
  }
  const accessToken = typeof body.accessToken === 'string' && body.accessToken.length <= 1000 ? body.accessToken : null
  const nonce = typeof body.nonce === 'string' && NONCE_RE.test(body.nonce) ? body.nonce : null
  if (!accessToken) return NextResponse.json({ error: 'auth_failed' }, { status: 400 })

  try {
    const profile = await fetchLineProfileFromLiff(accessToken)
    const result = await signInLineUser(profile)

    if (result.kind === 'blocked') return NextResponse.json({ error: result.error }, { status: 403 })

    if (result.kind === 'not_found') {
      // ticket = หลักฐานว่าเพิ่งยืนยันกับ LINE มาจริง (ดู LINE callback)
      const q = new URLSearchParams({
        ticket: createRegisterTicket(profile),
        lineUserId: profile.userId,
        lineDisplayName: profile.displayName,
        ...(profile.pictureUrl && { linePictureUrl: profile.pictureUrl }),
      })
      if (nonce) {
        q.append('pwa', '1')
        q.append('nonce', nonce)
      }
      return NextResponse.json({ register: `/register?${q}` })
    }

    if (!nonce) return NextResponse.json({ tokenHash: result.tokenHash, next: result.next })

    const sb = createAdminClient()
    const { error } = await sb
      .from('auth_handoffs')
      .upsert(
        { nonce, token_hash: result.tokenHash, next: result.next, created_at: new Date().toISOString() },
        { onConflict: 'nonce' }
      )
    if (error) throw new Error(`ฝาก session ไม่สำเร็จ: ${error.message}`)
    return NextResponse.json({ handedOff: true })
  } catch (err) {
    console.error('[liff] ล็อกอินไม่สำเร็จ:', err)
    return NextResponse.json({ error: 'auth_failed' }, { status: 500 })
  }
}
