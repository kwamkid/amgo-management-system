// app/api/users/birthdays/route.ts
//
// วันเกิดพนักงาน สำหรับการ์ดบนหน้าแรก
//
// ยังเป็น route ฝั่ง server อยู่ (ไม่ให้เบราว์เซอร์ query ตรง) เพราะวันเกิด
// เป็นข้อมูลส่วนตัว — ตรงนี้ส่งออกไปเฉพาะ วัน/เดือน ไม่ส่งปีเกิด

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'

export async function GET() {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 })

  const { data, error } = await createAdminClient()
    .from('users')
    .select('id, full_name, line_display_name, line_picture_url, birth_date, role')
    .eq('is_active', true)
    .is('deleted_at', null)
    .not('birth_date', 'is', null)

  if (error) {
    console.error('ดึงวันเกิดไม่สำเร็จ:', error.message)
    return NextResponse.json({ error: 'ดึงข้อมูลไม่สำเร็จ' }, { status: 500 })
  }

  const birthdays = (data ?? []).map((u) => ({
    id: u.id,
    fullName: u.full_name,
    lineDisplayName: u.line_display_name,
    linePictureUrl: u.line_picture_url || null,
    // ปีเกิดบอกอายุ — หน้าจอใช้แค่วัน/เดือน จึงตรึงปีไว้เป็นค่าเดียว
    birthDate: `2000-${u.birth_date!.slice(5, 10)}T00:00:00.000Z`,
    role: u.role,
  }))

  return NextResponse.json({ birthdays })
}
