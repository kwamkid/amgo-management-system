// app/api/cron/task-reminders/route.ts
//
// เตือนงานรายวันด้วย push (ครบกำหนดวันนี้ · ถึงวันตาม · มีนัดวันนี้/พรุ่งนี้ · เลยกำหนดวันที่ 1/3/7/ทุก 7 วัน)
// กติกาอยู่ที่ lib/tasks/reminders.ts · ตั้งเวลาเรียกที่ cron-job.org วันละครั้ง 08:30 เวลาไทย
// ส่ง Authorization: Bearer <CRON_SECRET> (docs/cron.md)
// Discord DM ตอนเช้าเป็นของ Edith บน VPS แยกกัน — อันนี้ไปที่มือถือที่เปิดแจ้งเตือนไว้

import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { sendDailyTaskReminders } from '@/lib/tasks/notify'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', hint: 'ต้องส่ง Authorization: Bearer <CRON_SECRET>' },
      { status: 401 }
    )
  }
  return NextResponse.json(await sendDailyTaskReminders())
}
