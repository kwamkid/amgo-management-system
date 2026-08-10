import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminAuth } from '@/lib/firebase/admin'
import {
  createSessionToken,
  emailForLine,
  ensureAuthUser,
  fetchLineProfile,
} from '@/lib/supabase/line-auth'
import { createRegisterTicket } from '@/lib/supabase/register-ticket'

/**
 * ออก custom token ของ Firebase ควบไปด้วยระหว่างช่วงย้ายระบบ
 * หน้าเก่ายังอ่าน Firestore ซึ่ง rules บังคับว่าต้องมี session
 * 🗑️ ลบทิ้งเมื่อย้าย service ครบ (ดู lib/auth/dual-session.ts)
 */
async function legacyFirebaseToken(lineUserId: string, role: string) {
  try {
    return await adminAuth.createCustomToken(lineUserId, { lineUserId, role })
  } catch (e) {
    console.warn('ออก Firebase token ไม่ได้ หน้าเก่าอาจโหลดข้อมูลไม่ขึ้น:', e)
    return null
  }
}

/**
 * LINE Login callback → Supabase session
 *
 * ของเดิมออก Firebase custom token ตัวนี้เปลี่ยนมาออก token_hash ของ Supabase
 * แล้วให้หน้า /auth/verify แลกเป็น session (เก็บใน cookie ฝั่ง client)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code')
  const error = params.get('error')
  const state = params.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (error) return NextResponse.redirect(new URL('/login?error=access_denied', appUrl))
  if (!code) return NextResponse.redirect(new URL('/login?error=no_code', appUrl))

  try {
    const profile = await fetchLineProfile(code)
    const sb = createAdminClient()

    const { data: user } = await sb
      .from('users')
      .select(
        'id, role, is_active, employment_status, deleted_at, full_name, nickname, name_verified, discord_user_id, is_system'
      )
      .eq('line_user_id', profile.userId)
      .maybeSingle()

    /* ── ยังไม่มีในระบบ ──────────────────────────────────────────── */
    if (!user) {
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
        const fb = await legacyFirebaseToken(profile.userId, 'admin')
        return NextResponse.redirect(
          new URL(
            `/auth/verify?token_hash=${hash}&firstLogin=true${fb ? `&fb=${fb}` : ''}`,
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
        request.headers.get('cookie')?.match(/invite_code=([^;]+)/)?.[1] ??
        (() => {
          try {
            return state ? JSON.parse(decodeURIComponent(state)).inviteCode : null
          } catch {
            return null
          }
        })()

      if (inviteCode) q.append('invite', inviteCode)
      return NextResponse.redirect(new URL(`/register?${q}`, appUrl))
    }

    /* ── มีอยู่แล้ว ──────────────────────────────────────────────── */
    if (user.deleted_at) {
      return NextResponse.redirect(new URL('/login?error=account_deleted', appUrl))
    }
    if (!user.is_active) {
      // แยกข้อความ "ลาออกแล้ว" กับ "รออนุมัติ" ให้ผู้ใช้รู้ว่าต้องทำอะไรต่อ
      const reason = ['resigned', 'terminated', 'retired'].includes(user.employment_status)
        ? 'account_ended'
        : 'account_inactive'
      return NextResponse.redirect(new URL(`/login?error=${reason}`, appUrl))
    }

    // อัปเดตรูป/ชื่อจาก LINE ทุกครั้งที่ล็อกอิน
    await sb
      .from('users')
      .update({
        line_display_name: profile.displayName,
        line_picture_url: profile.pictureUrl,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    await ensureAuthUser(profile, user.role)
    const hash = await createSessionToken(user.id, emailForLine(profile.userId))
    const fb = await legacyFirebaseToken(profile.userId, user.role)

    // ยังทำสิ่งที่ต้องทำก่อนใช้งานไม่ครบ ก็พาไปหน้ารายการก่อน
    // (ชื่อจริง+ชื่อเล่น · Discord — ดู lib/todo/tasks.ts)
    //
    // เรื่อง Discord บังคับได้ต่อเมื่อตั้ง DISCORD_CLIENT_ID ไว้แล้วเท่านั้น
    // ไม่งั้นจะพาคนไปหน้าที่กดเชื่อมต่อไม่ได้ = ล็อกทุกคนออกจากระบบ
    const discordReady = !!process.env.DISCORD_CLIENT_ID
    const nameDone = user.name_verified && !!user.nickname?.trim()
    const discordDone = !!user.discord_user_id || !discordReady
    // บัญชีระบบไม่ใช่คน ไม่มีชื่อเล่นและไม่มี Discord ให้ผูก
    const next = user.is_system || (nameDone && discordDone) ? '' : '&next=/setup'

    return NextResponse.redirect(
      new URL(`/auth/verify?token_hash=${hash}${fb ? `&fb=${fb}` : ''}${next}`, appUrl)
    )
  } catch (err) {
    console.error('LINE callback error:', err)
    return NextResponse.redirect(new URL('/login?error=auth_failed', appUrl))
  }
}
