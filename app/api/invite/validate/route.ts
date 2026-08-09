// app/api/invite/validate/route.ts
//
// ตรวจลิงก์เชิญก่อนสมัคร
//
// ต้องผ่าน server เพราะคนสมัครยังไม่ได้ล็อกอิน จึงยังไม่มีสิทธิ์อ่าน invite_links
// ใช้ peek_invite_link() ที่ตรวจอย่างเดียวไม่นับการใช้งาน
// (ตัวนับเพิ่มตอนสมัครจริงด้วย consume_invite_link ในคำสั่งเดียว)

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.json({ valid: false, error: 'ไม่พบรหัส invite link' }, { status: 400 })
  }

  const { data, error } = await createAdminClient().rpc('peek_invite_link', { p_code: code })

  if (error) {
    console.error('ตรวจลิงก์เชิญไม่สำเร็จ:', error.message)
    return NextResponse.json(
      { valid: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบลิงก์' },
      { status: 500 }
    )
  }

  const link = data?.[0]
  if (!link || !link.is_active) {
    return NextResponse.json({ valid: false, error: 'ลิงก์ไม่ถูกต้องหรือถูกปิดใช้งานแล้ว' })
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: 'ลิงก์หมดอายุแล้ว' })
  }

  if (link.max_uses && link.used_count >= link.max_uses) {
    return NextResponse.json({ valid: false, error: 'ลิงก์ถูกใช้งานครบจำนวนแล้ว' })
  }

  return NextResponse.json({
    valid: true,
    link: {
      id: link.id,
      code: link.code,
      defaultRole: link.default_role,
      defaultLocationIds: link.default_location_ids ?? [],
      allowCheckInOutsideLocation: link.allow_checkin_outside_location,
      requireApproval: link.require_approval,
      maxUses: link.max_uses,
      usedCount: link.used_count,
      expiresAt: link.expires_at,
      isActive: link.is_active,
    },
  })
}
