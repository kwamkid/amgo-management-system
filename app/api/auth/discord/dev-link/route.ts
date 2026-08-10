// app/api/auth/discord/dev-link/route.ts
//
// ผูก Discord แบบหลอก ๆ สำหรับตอนพัฒนา
//
// กติกาบริษัทคือทุกคนต้องผูก Discord แต่ตอนนั่งพัฒนาไม่มีใครอยากกด
// OAuth จริงทุกครั้งที่ล้างฐานข้อมูลหรือสลับบัญชีทดสอบ
//
// ปิดตายในโปรดักชันแบบเดียวกับ /api/auth/dev-login
//
// id ที่ใส่ขึ้นต้นด้วย "dev:" เสมอ เพื่อให้ที่อื่นแยกออกว่าไม่ใช่บัญชีจริง
// — ตัวส่งแจ้งเตือนจะได้ไม่ mention ไปยัง id ที่ไม่มีอยู่จริงใน Discord

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'

/** id ปลอมสำหรับตอนพัฒนา — ที่อื่นเช็คด้วย prefix นี้ */
export const DEV_DISCORD_PREFIX = 'dev:'

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'ใช้ได้เฉพาะตอนพัฒนา' }, { status: 403 })
  }

  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 })

  const { error } = await createAdminClient()
    .from('users')
    .update({
      // ต้องไม่ซ้ำกับใคร เพราะระบบบังคับว่า 1 Discord = 1 พนักงาน
      discord_user_id: `${DEV_DISCORD_PREFIX}${me.profile.id}`,
      discord_username: 'ทดสอบ (ไม่ใช่บัญชีจริง)',
    })
    .eq('id', me.profile.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
