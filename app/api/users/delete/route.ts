// app/api/users/delete/route.ts
//
// ลบพนักงาน — ต้องทำฝั่ง server เพราะต้องแตะบัญชีใน auth ด้วย
//
// ⚠️ ของเดิมมีช่องโหว่: ถ้าตรวจ token ไม่ผ่าน มีคอมเมนต์ปิดการปฏิเสธไว้ว่า
//    "For now, allow deletion without auth (you can change this)"
//    แปลว่าใครก็ยิง DELETE เข้ามาลบพนักงานพร้อมเช็คอินและใบลาทั้งหมดได้
//    รอบนี้ไม่มีทางลัดนั้น — ไม่ใช่ admin คือจบ
//
// อีกอย่างที่เปลี่ยน: ของเดิมลบเช็คอินกับใบลาทิ้งด้วย ซึ่งทำลายหลักฐาน
// การจ่ายค่าแรงย้อนหลัง รอบนี้ลบเฉพาะบัญชี ถ้ามีประวัติผูกอยู่จะให้ปิดใช้งานแทน

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 })
  if (me.profile.role !== 'admin') {
    return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, { status: 403 })
  }

  const { userId } = await request.json().catch(() => ({}))
  if (!userId) return NextResponse.json({ error: 'ไม่ได้ระบุพนักงาน' }, { status: 400 })
  if (userId === me.profile.id) {
    return NextResponse.json({ error: 'ลบบัญชีตัวเองไม่ได้' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: target } = await admin
    .from('users')
    .select('id, full_name, line_display_name')
    .eq('id', userId)
    .maybeSingle()

  if (!target) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 })

  // มีประวัติผูกอยู่ไหม — ลบแล้วรายงานย้อนหลังจะหาย
  const [{ count: checkins }, { count: leaves }] = await Promise.all([
    admin.from('checkins').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('leave_requests').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  if ((checkins ?? 0) > 0 || (leaves ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          `ลบไม่ได้เพราะมีประวัติเช็คอิน ${checkins} รายการ · ใบลา ${leaves} ใบ ` +
          `ผูกอยู่ — ให้เปลี่ยนสถานะเป็นลาออกแทน ข้อมูลย้อนหลังจะได้ไม่หาย`,
        checkins,
        leaves,
      },
      { status: 409 }
    )
  }

  const { error: delErr } = await admin.from('users').delete().eq('id', userId)
  if (delErr) {
    return NextResponse.json({ error: `ลบไม่สำเร็จ: ${delErr.message}` }, { status: 500 })
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(userId)
  if (authErr) console.warn('ลบบัญชีใน auth ไม่สำเร็จ:', authErr.message)

  return NextResponse.json({
    success: true,
    deletedUser: { id: userId, name: target.full_name || target.line_display_name },
  })
}

/** ปิดใช้งาน / กู้คืน */
export async function PATCH(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 })
  if (!['admin', 'hr'].includes(me.profile.role)) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
  }

  const { userId, action } = await request.json().catch(() => ({}))
  if (!userId || !action) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const admin = createAdminClient()

  const patch =
    action === 'soft-delete'
      ? { is_active: false, deleted_at: new Date().toISOString(), deleted_by: me.profile.id }
      : action === 'restore'
        ? { is_active: true, deleted_at: null, deleted_by: null }
        : null

  if (!patch) return NextResponse.json({ error: 'คำสั่งไม่ถูกต้อง' }, { status: 400 })

  const { error } = await admin.from('users').update(patch).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
