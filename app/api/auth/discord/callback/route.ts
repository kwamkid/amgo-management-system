// app/api/auth/discord/callback/route.ts
//
// Discord ส่งกลับมาพร้อม code → แลกเป็นข้อมูลบัญชี → ผูกกับพนักงานคนนี้
//
// เก็บ discord_user_id ไว้เพื่อ mention ได้จริงใน Discord
// (แจ้งวันเกิด · เตือนลืมเช็คเอาท์ · ผลอนุมัติลา)

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'
import { verifyOAuthState } from '@/lib/discord/oauth-state'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/setup?error=${reason}`, appUrl))

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')

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
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${appUrl}/api/auth/discord/callback`,
      }),
    })
    if (!tokenRes.ok) return fail('token_failed')

    const { access_token } = await tokenRes.json()

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!userRes.ok) return fail('profile_failed')

    const discord = await userRes.json()
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
