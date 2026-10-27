// app/api/auth/discord/start/route.ts
//
// เริ่มขั้นตอนผูกบัญชี Discord — พาไปหน้าอนุญาตของ Discord
//
// ปกติต้องล็อกอิน LINE มาก่อน เพราะเราผูก Discord "เข้ากับพนักงานคนไหน"
//
// `?mode=login` = ใช้ Discord ที่ผูกไว้แล้วล็อกอินแทน LINE (สำรองให้คนที่ LINE
// เข้าไม่ได้ เช่น iPhone บางเครื่อง · เพิ่ม 28 ต.ค. 69) — ไม่ต้องมี session
// `&nonce=` มาด้วยเมื่อกดจากแอปที่ติดตั้ง ให้ callback ส่ง session กลับเข้าแอป

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { createLoginState, createOAuthState } from '@/lib/discord/oauth-state'
import { NONCE_RE } from '@/lib/auth/pwaState'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const clientId = process.env.DISCORD_CLIENT_ID
  const loginMode = request.nextUrl.searchParams.get('mode') === 'login'

  if (!clientId) {
    return NextResponse.redirect(
      new URL(loginMode ? '/login?error=discord_off' : '/setup?error=not_configured', appUrl)
    )
  }

  // กัน CSRF — state เซ็นชื่อไว้ในตัว ไม่ต้องฝาก cookie ให้เบราว์เซอร์ส่งกลับ
  // (ของเดิมใช้ cookie แล้วเจอ bad_state เพราะขากลับเป็นการข้ามเว็บ)
  let state: string
  if (loginMode) {
    const nonce = request.nextUrl.searchParams.get('nonce')
    state = createLoginState(nonce && NONCE_RE.test(nonce) ? nonce : undefined)
  } else {
    const me = await getCurrentUser()
    if (!me) return NextResponse.redirect(new URL('/login', appUrl))
    state = createOAuthState(me.profile.id)
  }

  const authorize = new URL('https://discord.com/api/oauth2/authorize')
  authorize.searchParams.set('client_id', clientId)
  authorize.searchParams.set('redirect_uri', `${appUrl}/api/auth/discord/callback`)
  authorize.searchParams.set('response_type', 'code')
  // ขอแค่ข้อมูลบัญชีพื้นฐาน — ไม่ขอสิทธิ์อ่านข้อความหรืออะไรเกินจำเป็น
  authorize.searchParams.set('scope', 'identify')
  authorize.searchParams.set('state', state)
  // ล็อกอิน: เคยอนุญาตตอนผูกแล้ว ไม่ต้องถามซ้ำ
  authorize.searchParams.set('prompt', loginMode ? 'none' : 'consent')

  return NextResponse.redirect(authorize)
}
