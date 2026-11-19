// app/api/cron/tick/route.ts
//
// cron กลาง (เจ้าของ 20 พ.ย. 69) — cron-job.org เหลืองานเดียว: GET ทุก 10 นาที
//   Authorization: Bearer <CRON_SECRET> · Timezone ไม่สำคัญ (คิดเวลาไทยในโค้ด)
// ตารางงานอยู่ที่ lib/cron/schedule.ts · ประวัติการรันอยู่ในตาราง cron_runs
//
// ตอบทันทีว่าจองงานไหนได้ แล้วทำงานใน after() (cron-job.org รอได้แค่ 30 วิ)
// ?dry=1[&at=<ISO>] = ดูว่าตอนนั้นมีงานไหนถึงรอบ ไม่จอง ไม่รัน (ไว้ทดสอบตาราง)

import { after, NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { currentSlots } from '@/lib/cron/schedule'
import { claimDue, runClaimed } from '@/lib/cron/runner'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized', hint: 'ต้องส่ง Authorization: Bearer <CRON_SECRET>' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  if (params.get('dry') === '1') {
    const at = params.get('at') ? new Date(params.get('at')!) : new Date()
    if (Number.isNaN(at.getTime())) return NextResponse.json({ error: 'at ต้องเป็นวันเวลา ISO' }, { status: 400 })
    return NextResponse.json({ at: at.toISOString(), slots: currentSlots(at).map((s) => ({ job: s.job.key, slot: s.slot })) })
  }

  const claimed = await claimDue()
  if (claimed.length) {
    const origin = request.nextUrl.origin
    after(() => runClaimed(claimed, origin))
  }
  return NextResponse.json({ claimed: claimed.map((c) => `${c.job.key}@${c.slot}`) }, { status: claimed.length ? 202 : 200 })
}

// บางบริการตั้งเวลาส่ง POST เป็นค่าเริ่มต้น
export async function POST(request: NextRequest) {
  return GET(request)
}
