// app/api/push/test/route.ts
//
// ยิง push ทดสอบไปทุกอุปกรณ์ของ "คนที่กด" — ใช้ตรวจว่าตั้งค่าสำเร็จจริง
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push/send'

export async function POST() {
  const sb = await createServerSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // เช็คก่อนว่ามีอุปกรณ์จริงไหม — จะได้บอกได้ว่า "ยังไม่ได้เปิด" ไม่ใช่เงียบไปเฉย ๆ
  const { count } = await createAdminClient()
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if (!count) {
    return NextResponse.json({ error: 'ยังไม่มีอุปกรณ์ที่เปิดการแจ้งเตือน' }, { status: 404 })
  }

  const sent = await sendPushToUsers([user.id], {
    title: '🔔 ทดสอบการแจ้งเตือน',
    body: 'ตั้งค่าสำเร็จ! อุปกรณ์นี้จะได้รับแจ้งเตือนใบลาและใบสลับวันหยุด',
    url: '/profile',
    tag: 'push-test',
  })
  return NextResponse.json({ success: true, devices: count, sent })
}
