import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSessionToken, emailForLine } from '@/lib/supabase/line-auth'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

/**
 * เข้าระบบเป็น admin สำหรับตอนพัฒนา — ไม่ต้องผ่าน LINE
 * ปิดตายในโปรดักชัน
 */
const DEV_LINE_ID = 'dev-admin-user'

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'ใช้ได้เฉพาะตอนพัฒนา' }, { status: 403 })
  }

  try {
    const sb = createAdminClient()
    const email = emailForLine(DEV_LINE_ID)

    let { data: user } = await sb
      .from('users')
      .select('id')
      .eq('line_user_id', DEV_LINE_ID)
      .maybeSingle()

    if (!user) {
      // อาจมี auth user ค้างอยู่จากรอบก่อนแต่แถวใน users หาย — หาก่อนค่อยสร้าง
      const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 })
      let uid = list?.users.find((u) => u.email === email)?.id

      if (!uid) {
        const { data: created, error } = await sb.auth.admin.createUser({
          email,
          email_confirm: true,
          app_metadata: { line_user_id: DEV_LINE_ID, role: 'admin' },
        })
        if (error || !created.user) {
          return NextResponse.json({ error: error?.message }, { status: 500 })
        }
        uid = created.user.id
      }

      const { error: insErr } = await sb.from('users').insert({
        id: uid,
        line_user_id: DEV_LINE_ID,
        line_display_name: 'Dev Admin',
        full_name: 'Dev Admin',
        role: 'admin',
        employment_status: 'active',
        needs_approval: false,
        allow_checkin_outside_location: true,
      })
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
      user = { id: uid }
    }

    // เผื่อ role ถูกแก้ไปตอนทดสอบ — ดันกลับเป็น admin ทุกครั้ง
    await sb.auth.admin.updateUserById(user.id, {
      app_metadata: { line_user_id: DEV_LINE_ID, role: 'admin' },
    })
    await sb.from('users').update({ role: 'admin', employment_status: 'active' }).eq('id', user.id)

    const tokenHash = await createSessionToken(user.id, email)

    // ── ชั่วคราว: session ฝั่ง Firebase ให้หน้าที่ยังไม่ได้ย้ายอ่าน Firestore ได้
    let firebaseToken: string | null = null
    try {
      try {
        await adminAuth.getUser(DEV_LINE_ID)
      } catch {
        await adminAuth.createUser({ uid: DEV_LINE_ID, displayName: 'Dev Admin' })
      }
      await adminAuth.setCustomUserClaims(DEV_LINE_ID, { role: 'admin', isActive: true })

      const ref = adminDb.collection('users').doc(DEV_LINE_ID)
      if (!(await ref.get()).exists) {
        await ref.set({
          lineUserId: DEV_LINE_ID,
          lineDisplayName: 'Dev Admin',
          linePictureUrl: '',
          fullName: 'Dev Admin',
          phone: '',
          role: 'admin',
          isActive: true,
          needsApproval: false,
          permissionGroupId: null,
          allowedLocationIds: [],
          allowCheckInOutsideLocation: true,
        })
      }
      firebaseToken = await adminAuth.createCustomToken(DEV_LINE_ID, {
        lineUserId: DEV_LINE_ID,
        role: 'admin',
      })
    } catch (e) {
      console.warn('เตรียม Firebase session ไม่สำเร็จ:', e)
    }

    return NextResponse.json({ tokenHash, firebaseToken })
  } catch (err) {
    console.error('dev-login error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
