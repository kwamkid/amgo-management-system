// app/api/users/birthdays/route.ts
//
// วันเกิดพนักงาน สำหรับปฏิทินบนหน้าแรก
//
// ── ทำไมต้องผ่าน API ไม่ query ตรง ─────────────────────────────────────
// เพื่อไม่ส่งปีเกิดออกไป — หน้าจอใช้แค่วัน/เดือน ส่วนปีบอกอายุซึ่งเป็นเรื่องส่วนตัว
//
// ── ที่แก้เรื่องความเร็ว ───────────────────────────────────────────────
// ของเดิมคุยกับ Supabase 3 รอบต่อการโหลด 1 ครั้ง:
//   1. auth.getUser()      ตรวจ token
//   2. select จาก users    ดึงโปรไฟล์คนที่เรียก (ไม่ได้ใช้เลย)
//   3. select วันเกิด
// รอบที่ 2 ตัดทิ้งได้ เพราะแค่ต้องรู้ว่า "ล็อกอินอยู่" ไม่ต้องรู้ว่าเป็นใคร
//
// แล้วใส่ cache 5 นาที — วันเกิดไม่เปลี่ยนระหว่างวัน กดเปลี่ยนเดือนไปมา
// ไม่ควรยิงใหม่ทุกครั้ง

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET() {
  const sb = await createServerSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()

  if (!user) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 })

  const { data, error } = await createAdminClient()
    .from('users')
    .select('id, full_name, nickname, display_name, line_display_name, birth_date, role')
    .eq('is_active', true)
    .eq('is_system', false)
    .is('deleted_at', null)
    .not('birth_date', 'is', null)

  if (error) {
    console.error('ดึงวันเกิดไม่สำเร็จ:', error.message)
    return NextResponse.json({ error: 'ดึงข้อมูลไม่สำเร็จ' }, { status: 500 })
  }

  const birthdays = (data ?? []).map((u) => ({
    id: u.id,
    // ปฏิทินโชว์ชื่อเดียว — เอา "ชื่อจริง (ชื่อเล่น)" ไป ชื่อ LINE อ่านแล้วไม่รู้ว่าใคร
    fullName: u.display_name || u.full_name,
    nickname: u.nickname ?? '',
    lineDisplayName: u.line_display_name,
    // ตรึงปีไว้ค่าเดียว — ส่งออกแค่วันกับเดือน
    birthDate: `2000-${u.birth_date!.slice(5, 10)}T00:00:00.000Z`,
    role: u.role,
  }))

  return NextResponse.json(
    { birthdays },
    { headers: { 'Cache-Control': 'private, max-age=300' } }
  )
}
