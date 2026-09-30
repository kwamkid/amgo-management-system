// app/api/cron/checkout-reminder/route.ts
//
// เตือนให้เช็คเอาท์ด้วย push — ครั้งเดียวต่อกะ
//
// ตั้งเวลาเรียกที่ cron-job.org ทุก 15 นาที · ส่ง Authorization: Bearer <CRON_SECRET>
//
// ใครถึงเวลาเตือนตัดสินใน SQL (checkout_reminders_due — migration 20260930130000):
// เลยทั้งเวลาเลิกงานปกติ และเวลาที่คนนี้มักเช็คเอาท์ (มัธยฐาน 30 วัน) ไปแล้ว
// 30 นาที — "ให้ดูจาก personal stat" (เจ้าของ 30 ก.ย. 69) PC ที่อยู่ทำ OT ถึง
// ห้างปิดเป็นประจำจึงไม่โดนเตือนตอนหกโมงเย็นทุกวัน
//
// ข้อยกเว้นของกติกา "เช็คอิน/เอาท์ไม่ยิง push" (lib/push/events.ts): อันนั้นคือ
// แจ้งหัวหน้าทุกครั้งที่มีคนเข้า-ออก · อันนี้เตือนเจ้าตัวครั้งเดียวต่อกะ และ
// เฉพาะคนที่ยังไม่กด — ลืมแล้วโดนปิดที่เวลาเลิกงาน เสีย OT ที่ทำจริง

import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push/send'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', hint: 'ต้องส่ง Authorization: Bearer <CRON_SECRET>' },
      { status: 401 }
    )
  }

  const sb = createAdminClient()
  const { data: due, error } = await sb.rpc('checkout_reminders_due', {})
  if (error) {
    console.error('[เตือนเช็คเอาท์] หาใบที่ถึงเวลาไม่สำเร็จ:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let reminded = 0
  let delivered = 0
  for (const row of due ?? []) {
    // ตีตราก่อนส่ง — ส่งพลาดก็ไม่วนเตือนซ้ำทุก 15 นาที (เครื่องที่ไม่เปิดแจ้งเตือนส่งไม่ถึงอยู่แล้ว)
    const { data: claimed } = await sb
      .from('checkins')
      .update({ checkout_reminded_at: new Date().toISOString() })
      .eq('id', row.checkin_id)
      .is('checkout_reminded_at', null)
      .eq('status', 'checked-in')
      .select('id')
    if (!claimed?.length) continue // เพิ่งเช็คเอาท์ หรือรอบอื่นเตือนไปแล้ว

    reminded++
    delivered += await sendPushToUsers([row.user_id], {
      title: 'ยังไม่ได้เช็คเอาท์',
      body: 'เลิกงานแล้วอย่าลืมกดเช็คเอาท์ — ไม่งั้นระบบจะปิดให้ที่เวลาเลิกงานปกติ ไม่มี OT',
      url: '/checkin',
      tag: `checkout-reminder-${row.checkin_id}`,
    })
  }

  return NextResponse.json({
    success: true,
    due: due?.length ?? 0,
    reminded,
    delivered,
    timestamp: new Date().toISOString(),
  })
}

// cron-job.org ส่ง GET เป็นมาตรฐาน — POST เผื่อทดสอบด้วย curl
export async function POST(request: NextRequest) {
  return GET(request)
}
