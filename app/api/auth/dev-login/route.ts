import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSessionToken, emailForLine } from '@/lib/supabase/line-auth'

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
    // ผูก Discord แบบหลอกให้เลย — บัญชีสำหรับพัฒนาไม่ต้องไปกด OAuth จริง
    // ("dev:" เป็นสัญลักษณ์ว่าไม่ใช่บัญชีจริง ตัวส่งแจ้งเตือนจะไม่ mention)
    await sb
      .from('users')
      .update({
        role: 'admin',
        employment_status: 'active',
        discord_user_id: `dev:${user.id}`,
        discord_username: 'Dev Admin (ไม่ใช่บัญชีจริง)',
      })
      .eq('id', user.id)

    const tokenHash = await createSessionToken(user.id, email)


    return NextResponse.json({ tokenHash })
  } catch (err) {
    console.error('dev-login error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
