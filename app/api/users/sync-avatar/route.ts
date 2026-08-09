// app/api/users/sync-avatar/route.ts
//
// ล้างรูปโปรไฟล์ที่เก็บไว้ เพื่อให้ดึงใหม่จาก LINE ตอนเข้าสู่ระบบครั้งถัดไป

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 })

  const { userId } = await request.json().catch(() => ({}))
  if (!userId) return NextResponse.json({ error: 'ไม่ได้ระบุพนักงาน' }, { status: 400 })

  // ล้างรูปตัวเองได้เสมอ · ล้างของคนอื่นต้องเป็นระดับจัดการ
  const canManage = ['admin', 'hr', 'manager'].includes(me.profile.role)
  if (userId !== me.profile.id && !canManage) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
  }

  const { error } = await createAdminClient()
    .from('users')
    .update({ line_picture_url: '' })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
