// app/api/users/sync-avatar/route.ts
//
// ดึงรูปโปรไฟล์ใหม่ — ลบสำเนาที่เก็บไว้ทิ้ง แล้วให้ /api/avatar ไปดึงมาใหม่
//
// ⚠️ ของเดิมล้าง line_picture_url ทิ้ง ซึ่งเป็น "ต้นทาง" ของรูป
//    ผลคือไม่เหลืออะไรให้ดึงเลย รูปหายถาวรจนกว่าจะล็อกอิน LINE ใหม่
//    ตัวนี้ลบเฉพาะสำเนา ต้นทางยังอยู่
//
// ── ข้อจำกัดที่ต้องรู้ ────────────────────────────────────────────────
// เราเก็บได้แค่ "ลิงก์รูปตอนที่ล็อกอินครั้งล่าสุด" ไม่ได้เก็บ token ของ LINE
// ไว้เรียกโปรไฟล์ใหม่ ถ้าเปลี่ยนรูปใน LINE แล้วกดปุ่มนี้ จะได้รูปเดิมกลับมา
// ต้องออกจากระบบแล้วเข้าใหม่ครั้งหนึ่ง ระบบถึงจะรู้จักลิงก์รูปใหม่

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

  const sb = createAdminClient()

  const { data: user } = await sb
    .from('users')
    .select('photo_url')
    .eq('id', userId)
    .maybeSingle()

  if (user?.photo_url) {
    await sb.storage.from('avatars').remove([user.photo_url])
  }

  const { error } = await sb.from('users').update({ photo_url: null }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
