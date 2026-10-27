import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createSessionToken,
  emailForLine,
  ensureAuthUser,
  fetchLineProfile,
} from '@/lib/supabase/line-auth'
import { createRegisterTicket } from '@/lib/supabase/register-ticket'
import { parseLineState, handoffQuery } from '@/lib/auth/pwaState'
import { signInLineUser } from '@/lib/auth/lineSignIn'

/**
 * LINE Login callback → Supabase session
 *
 * ออก token_hash ของ Supabase
 * แล้วให้หน้า /auth/verify แลกเป็น session (เก็บใน cookie ฝั่ง client)
 *
 * ── ล็อกอินจากแอปที่ติดตั้ง (PWA) ───────────────────────────────────
 * แอป LINE ยิง callback นี้ไปที่เบราว์เซอร์หลักของเครื่อง ไม่ใช่แอปที่กด
 * (Android=Chrome · iOS=Safari ซึ่งคนละถังคุกกี้กับแอป) · state จึงพก nonce มา
 * แล้วส่งต่อให้หน้า verify (`&pwa=1&nonce=`) ให้มันฝาก token ไว้ที่
 * /api/auth/handoff แทนการแลกเอง — แอปที่ยังเปิดอยู่จะมาหยิบไปแลกเป็น session เอง
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code')
  const error = params.get('error')
  const state = params.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (error) return NextResponse.redirect(new URL('/login?error=access_denied', appUrl))
  if (!code) return NextResponse.redirect(new URL('/login?error=no_code', appUrl))

  const lineState = parseLineState(state)
  const handoff = handoffQuery(lineState)
  // ไว้ไล่ปัญหา "ล็อกอินจากแอปแล้วไปโผล่เบราว์เซอร์" — ดูใน Vercel logs ว่าธงมาถึงไหม
  console.log('[line-callback]', lineState.pwa ? 'จากแอป (handoff)' : 'จากเบราว์เซอร์', 'nonce:', lineState.nonce ? 'มี' : 'ไม่มี')

  try {
    const profile = await fetchLineProfile(code)
    const sb = createAdminClient()

    const result = await signInLineUser(profile)

    /* ── ยังไม่มีในระบบ ──────────────────────────────────────────── */
    if (result.kind === 'not_found') {
      // คนแรกของระบบได้เป็น admin อัตโนมัติ (ตอนตั้งระบบใหม่)
      const { count } = await sb.from('users').select('id', { count: 'exact', head: true })

      if (!count) {
        const uid = await ensureAuthUser(profile, 'admin')
        await sb.from('users').insert({
          id: uid,
          line_user_id: profile.userId,
          line_display_name: profile.displayName,
          line_picture_url: profile.pictureUrl,
          full_name: profile.displayName,
          role: 'admin',
          employment_status: 'active',
          needs_approval: false,
        })
        const hash = await createSessionToken(uid, emailForLine(profile.userId))
        return NextResponse.redirect(
          new URL(
            `/auth/verify?token_hash=${hash}&firstLogin=true${handoff}`,
            appUrl
          )
        )
      }

      // คนทั่วไป → ไปหน้าสมัคร พร้อมโค้ดเชิญถ้ามี
      //
      // ticket คือหลักฐานว่า "เพิ่งยืนยันกับ LINE มาจริง" — /api/auth/register
      // เชื่อเฉพาะค่าในตั๋วนี้ ส่วน 3 ตัวข้างล่างมีไว้ให้หน้าจอโชว์เฉย ๆ
      const q = new URLSearchParams({
        ticket: createRegisterTicket(profile),
        lineUserId: profile.userId,
        lineDisplayName: profile.displayName,
        ...(profile.pictureUrl && { linePictureUrl: profile.pictureUrl }),
      })

      const inviteCode =
        request.headers.get('cookie')?.match(/invite_code=([^;]+)/)?.[1] ?? lineState.inviteCode ?? null

      if (inviteCode) q.append('invite', inviteCode)
      // สมัครจากแอปที่ติดตั้ง → หน้าสมัครต้องรู้ด้วย จะได้ส่ง session กลับเข้าแอปหลังสมัครเสร็จ
      if (lineState.pwa && lineState.nonce) {
        q.append('pwa', '1')
        q.append('nonce', lineState.nonce)
      }
      return NextResponse.redirect(new URL(`/register?${q}`, appUrl))
    }

    /* ── มีอยู่แล้ว (กติกาอยู่ใน lib/auth/lineSignIn.ts) ───────────── */
    if (result.kind === 'blocked') {
      return NextResponse.redirect(new URL(`/login?error=${result.error}`, appUrl))
    }

    const next = result.next ? `&next=${result.next}` : ''
    return NextResponse.redirect(
      new URL(`/auth/verify?token_hash=${result.tokenHash}${next}${handoff}`, appUrl)
    )
  } catch (err) {
    console.error('LINE callback error:', err)
    return NextResponse.redirect(new URL('/login?error=auth_failed', appUrl))
  }
}
