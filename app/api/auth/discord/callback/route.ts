// app/api/auth/discord/callback/route.ts
//
// Discord ส่งกลับมาพร้อม code → แลกเป็นข้อมูลบัญชี → ผูกกับพนักงานคนนี้
//
// state แบบ login (ดู createLoginState) = ใช้ Discord ที่ผูกไว้แล้วล็อกอินแทน LINE
// → หาพนักงานจาก discord_user_id แล้วออก session แบบเดียวกับ LINE callback
//
// เก็บ discord_user_id ไว้เพื่อ mention ได้จริงใน Discord
// (แจ้งวันเกิด · เตือนลืมเช็คเอาท์ · ผลอนุมัติลา)

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'
import { readLoginState, verifyOAuthState } from '@/lib/discord/oauth-state'
import { createSessionToken } from '@/lib/supabase/line-auth'

type DiscordUser = { id: string; username: string; global_name?: string | null }

async function fetchDiscordUser(code: string, appUrl: string): Promise<DiscordUser | 'token_failed' | 'profile_failed'> {
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${appUrl}/api/auth/discord/callback`,
    }),
  })
  if (!tokenRes.ok) return 'token_failed'

  const { access_token } = await tokenRes.json()

  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!userRes.ok) return 'profile_failed'

  return userRes.json()
}

/** ล็อกอินด้วย Discord — เฉพาะคนที่ผูกไว้แล้ว ยังทำงานอยู่ */
async function loginWithDiscord(code: string, nonce: string | null, appUrl: string) {
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, appUrl))
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) return fail('discord_off')

  try {
    const discord = await fetchDiscordUser(code, appUrl)
    if (typeof discord === 'string') return fail('discord_failed')

    const sb = createAdminClient()
    const { data: users } = await sb
      .from('users')
      .select('id, is_active, employment_status, deleted_at')
      .eq('discord_user_id', discord.id)

    // ผูกได้คนเดียวที่ยังทำงานอยู่ (ดูทางผูกด้านล่าง) · ที่ปิดแล้วอาจยังค้างชื่อเดิม
    const user = (users ?? []).find((u) => !u.deleted_at && u.is_active) ?? users?.[0]
    if (!user) return fail('discord_not_linked')
    if (user.deleted_at) return fail('account_deleted')
    if (!user.is_active) {
      const ended = ['resigned', 'terminated', 'retired'].includes(user.employment_status)
      return fail(ended ? 'account_ended' : 'account_inactive')
    }

    // อีเมลของบัญชี auth ตั้งตอนล็อกอิน LINE ครั้งแรก (emailForLine) — ใช้ตัวนั้นเลย
    const { data: authUser } = await sb.auth.admin.getUserById(user.id)
    const email = authUser?.user?.email
    if (!email) return fail('discord_not_linked')

    await sb.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)
    const hash = await createSessionToken(user.id, email)
    const handoff = nonce ? `&pwa=1&nonce=${nonce}` : ''
    return NextResponse.redirect(new URL(`/auth/verify?token_hash=${hash}${handoff}`, appUrl))
  } catch (err) {
    console.error('ล็อกอินด้วย Discord ไม่สำเร็จ:', err)
    return fail('discord_failed')
  }
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/setup?error=${reason}`, appUrl))

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')

  const login = readLoginState(state)
  if (login.ok || login.reason === 'expired') {
    // reason 'expired' ตรงนี้มาจาก state ของการล็อกอินเท่านั้น (ดู readLoginState)
    if (!login.ok) return NextResponse.redirect(new URL('/login?error=invalid_token', appUrl))
    // prompt=none แล้ว Discord ไม่ยอม (ยังไม่เคยอนุญาต) ก็มาทางนี้
    if (request.nextUrl.searchParams.get('error') || !code) {
      return NextResponse.redirect(new URL('/login?error=discord_failed', appUrl))
    }
    return loginWithDiscord(code, login.nonce, appUrl)
  }

  if (request.nextUrl.searchParams.get('error')) return fail('denied')
  if (!code) return fail('no_code')

  const me = await getCurrentUser()
  if (!me) return NextResponse.redirect(new URL('/login', appUrl))

  // state ต้องเป็นของที่เราออกให้ "คนที่กำลังล็อกอินอยู่" เท่านั้น
  const check = verifyOAuthState(state, me.profile.id)
  if (!check.ok) return fail(check.reason === 'expired' ? 'expired' : 'bad_state')

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  if (!clientId || !clientSecret) return fail('not_configured')

  try {
    const discord = await fetchDiscordUser(code, appUrl)
    if (typeof discord === 'string') return fail(discord)

    const admin = createAdminClient()

    // บัญชี Discord เดียวผูกได้กับพนักงานที่ยังทำงานอยู่คนเดียว ไม่งั้น mention ผิดคน
    //
    // แต่ถ้าเจ้าของเดิม "ปิดใช้งานไปแล้ว" ให้ย้ายมาผูกกับคนที่กำลังผูกแทน —
    // ของเดิมบล็อกทุกกรณี ทำให้ Discord ค้างอยู่กับบัญชีที่ปิดไปตลอดกาล
    // (เจอจริง 3 ก.ย. 69: เท็มสมัครซ้ำด้วย LINE คนละอัน บัญชีแรกผูก Discord ไว้
    //  แล้วถูกปิด บัญชีใหม่จึงผูกไม่ได้เลย วนอยู่ที่ "ถูกผูกกับคนอื่นไปแล้ว")
    // เคสเดียวกันเกิดกับพนักงานที่ลาออกแล้วกลับมาใหม่ด้วย
    const { data: holders } = await admin
      .from('users')
      .select('id, is_active, deleted_at')
      .eq('discord_user_id', discord.id)
      .neq('id', me.profile.id)

    const activeHolder = (holders ?? []).find((h) => h.is_active && !h.deleted_at)
    if (activeHolder) return fail('already_linked')

    // ปลดของเจ้าของเดิมที่ปิดใช้งานแล้ว — ปล่อยค้างไว้จะบล็อกคนถัดไปอีก
    const stale = (holders ?? []).map((h) => h.id)
    if (stale.length) {
      await admin
        .from('users')
        .update({ discord_user_id: null, discord_username: null })
        .in('id', stale)
    }

    const { error } = await admin
      .from('users')
      .update({
        discord_user_id: discord.id,
        // username ใหม่ของ Discord ไม่มี #1234 แล้ว — global_name คือชื่อที่โชว์
        discord_username: discord.global_name || discord.username,
      })
      .eq('id', me.profile.id)

    if (error) return fail('save_failed')

    return NextResponse.redirect(new URL('/setup?discord=linked', appUrl))
  } catch (err) {
    console.error('ผูก Discord ไม่สำเร็จ:', err)
    return fail('unknown')
  }
}
