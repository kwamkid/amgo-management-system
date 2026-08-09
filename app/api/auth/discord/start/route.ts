// app/api/auth/discord/start/route.ts
//
// เริ่มขั้นตอนผูกบัญชี Discord — พาไปหน้าอนุญาตของ Discord
//
// ต้องล็อกอิน LINE มาก่อน เพราะเราผูก Discord "เข้ากับพนักงานคนไหน"
// ไม่ใช่ใช้ Discord ล็อกอินแทน LINE

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const clientId = process.env.DISCORD_CLIENT_ID

  if (!clientId) {
    return NextResponse.redirect(new URL('/link-discord?error=not_configured', appUrl))
  }

  const me = await getCurrentUser()
  if (!me) return NextResponse.redirect(new URL('/login', appUrl))

  // กัน CSRF — ค่าสุ่มที่ต้องตรงกันตอนกลับมา
  const state = crypto.randomUUID()

  const authorize = new URL('https://discord.com/api/oauth2/authorize')
  authorize.searchParams.set('client_id', clientId)
  authorize.searchParams.set('redirect_uri', `${appUrl}/api/auth/discord/callback`)
  authorize.searchParams.set('response_type', 'code')
  // ขอแค่ข้อมูลบัญชีพื้นฐาน — ไม่ขอสิทธิ์อ่านข้อความหรืออะไรเกินจำเป็น
  authorize.searchParams.set('scope', 'identify')
  authorize.searchParams.set('state', state)
  authorize.searchParams.set('prompt', 'consent')

  const res = NextResponse.redirect(authorize)
  res.cookies.set('discord_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 นาที
    path: '/',
  })
  return res
}
