import { createAdminClient } from './admin'

/**
 * สะพานเชื่อม LINE Login → Supabase session
 *
 * Supabase ไม่มี LINE เป็น provider ในตัว เราจึงทำเอง 3 ขั้น:
 *   1. ยืนยันตัวตนกับ LINE เอง (แลก code → profile)
 *   2. หา/สร้าง auth user ที่ผูกกับ line_user_id
 *   3. ขอ magic link แล้วดึงเฉพาะ token_hash ส่งให้ฝั่ง client
 *      แลกเป็น session (ไม่ได้ส่งอีเมลจริง — ใช้ generateLink เฉย ๆ)
 *
 * ⚠️ ข้อสำคัญที่พิสูจน์แล้วตอน Phase 0:
 *    role กับ line_user_id ต้องอยู่ใน app_metadata เท่านั้น
 *    user_metadata ผู้ใช้แก้เองได้จากเบราว์เซอร์ = ยกระดับตัวเองเป็น admin ได้
 */

/** อีเมลปลอมที่ผูกกับ LINE id — โดเมน .invalid สงวนไว้ ไม่มีทางชนของจริง */
export const emailForLine = (lineUserId: string) =>
  `${lineUserId.toLowerCase()}@line.invalid`

export type LineProfile = {
  userId: string
  displayName: string
  pictureUrl?: string
}

/** แลก authorization code จาก LINE เป็นโปรไฟล์ผู้ใช้ */
export async function fetchLineProfile(code: string): Promise<LineProfile> {
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/line/callback`,
      client_id: process.env.NEXT_PUBLIC_LINE_CHANNEL_ID!,
      client_secret: process.env.LINE_CHANNEL_SECRET!,
    }),
  })

  if (!tokenRes.ok) {
    throw new Error(`LINE token exchange ล้มเหลว: ${await tokenRes.text()}`)
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string }

  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!profileRes.ok) {
    throw new Error(`ดึงโปรไฟล์ LINE ไม่ได้: ${await profileRes.text()}`)
  }
  return (await profileRes.json()) as LineProfile
}

/**
 * สร้าง token_hash สำหรับแลกเป็น session ฝั่ง client
 *
 * generateLink คืนลิงก์ยืนยันอีเมลมาให้ เราเอาแค่ token_hash ไปใช้
 * ไม่มีอีเมลถูกส่งออกไปจริง (ไม่ได้เรียก signInWithOtp)
 */
export async function createSessionToken(userId: string, email: string) {
  const sb = createAdminClient()

  const { data, error } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (error) throw new Error(`ออก session token ไม่ได้: ${error.message}`)

  const hash = data.properties?.hashed_token
  if (!hash) throw new Error('generateLink ไม่คืน hashed_token กลับมา')

  return hash
}

/**
 * หา auth user จาก line_user_id — ถ้าไม่มีก็สร้างให้
 * คืน id ของ auth user (ซึ่งเป็น id เดียวกับ public.users)
 */
export async function ensureAuthUser(
  profile: LineProfile,
  role: string
): Promise<string> {
  const sb = createAdminClient()
  const email = emailForLine(profile.userId)

  // มีแถวใน public.users อยู่แล้วไหม (ย้ายข้อมูลมาแล้วจะเจอตรงนี้)
  const { data: existing } = await sb
    .from('users')
    .select('id')
    .eq('line_user_id', profile.userId)
    .maybeSingle()

  if (existing) {
    // sync role ขึ้น JWT ทุกครั้งที่ล็อกอิน — เผื่อ HR เพิ่งเปลี่ยนสิทธิ์ให้
    await sb.auth.admin.updateUserById(existing.id, {
      app_metadata: { line_user_id: profile.userId, role },
    })
    return existing.id
  }

  const { data: created, error } = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { line_user_id: profile.userId, role },
  })
  if (error || !created.user) {
    throw new Error(`สร้างผู้ใช้ไม่ได้: ${error?.message}`)
  }
  return created.user.id
}
