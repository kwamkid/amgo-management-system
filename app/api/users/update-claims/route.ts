// app/api/users/update-claims/route.ts
//
// ซิงก์ role จากตาราง users ลง app_metadata ของบัญชี auth
//
// ปกติไม่ต้องเรียกแล้ว — trigger users_sync_role_claim ทำให้อัตโนมัติทุกครั้ง
// ที่ role เปลี่ยน  เก็บ route นี้ไว้เป็นปุ่มซ่อมมือ เผื่อ claim หลุดจากกัน
// (หน้า /settings/fix-claims เรียกใช้)

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'

async function requireAdmin() {
  const me = await getCurrentUser()
  if (!me) return { error: NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 }) }
  if (me.profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 }) }
  }
  return { me }
}

/** ซ่อมทีละคน */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (gate.error) return gate.error

  const { userId } = await request.json().catch(() => ({}))
  if (!userId) return NextResponse.json({ error: 'ไม่ได้ระบุพนักงาน' }, { status: 400 })

  const admin = createAdminClient()

  const { data: user } = await admin
    .from('users')
    .select('role, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (!user) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 })

  // ⚠️ ต้องเป็น app_metadata เท่านั้น — user_metadata ผู้ใช้แก้เองได้
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: user.role },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, claims: { role: user.role } })
}

/** ซ่อมทั้งบริษัท */
export async function PUT() {
  const gate = await requireAdmin()
  if (gate.error) return gate.error

  const admin = createAdminClient()

  const { data: users, error } = await admin.from('users').select('id, role')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let updated = 0
  const failed: string[] = []

  for (const u of users ?? []) {
    const { error: e } = await admin.auth.admin.updateUserById(u.id, {
      app_metadata: { role: u.role },
    })
    if (e) failed.push(`${u.id}: ${e.message}`)
    else updated++
  }

  return NextResponse.json({ success: true, updated, failed })
}
