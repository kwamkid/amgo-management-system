// app/api/cron/payroll-cutoff/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { runPayrollCutoff } from '@/lib/services/payrollCutoffService'
import { isAuthorizedCron } from '@/lib/cron-auth'

/**
 * ตัดยอดเงินเดือนอัตโนมัติ
 *
 * ตั้งเวลาเรียกที่ cron-job.org — ดู docs/cron.md
 *   ทุกวัน 23:30 น. (เวลาไทย) · ส่ง Authorization: Bearer <CRON_SECRET>
 *
 * รันทุกวันแต่ทำงานจริงเฉพาะวันที่เป็นวันตัดยอดของรอบใดรอบหนึ่ง
 *   c28 → ตัดวันที่ 25 ของเดือน (เงินออก 28)
 *   c4  → ตัดสิ้นเดือน (เงินออกวันที่ 4 ของเดือนถัดไป)
 * วันอื่นตอบ 200 พร้อม results ว่าง ไม่ถือเป็น error
 *
 * รันซ้ำได้ไม่พัง — แถวที่มีอยู่แล้วไม่ถูกแตะ ของที่ HR กรอกมือจึงไม่หาย
 */
export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedCron(request)) {
      return NextResponse.json(
        { error: 'Unauthorized', hint: 'ต้องส่ง Authorization: Bearer <CRON_SECRET>' },
        { status: 401 }
      )
    }

    const { results, errors } = await runPayrollCutoff()

    // มี error ต้องขึ้นแดงที่ cron-job.org — ของเดิมตอบ success: true เสมอ
    // ทำให้ตัดยอดล้มทุกคืนโดยไม่มีใครรู้ (ดู bugs.md 4 ก.ย. 69)
    return NextResponse.json(
      {
        success: errors.length === 0,
        cutoffToday: results.length > 0,
        results,
        errors,
        timestamp: new Date().toISOString(),
      },
      { status: errors.length ? 500 : 200 }
    )
  } catch (error) {
    console.error('[ตัดยอดเงินเดือน] Error:', error)
    return NextResponse.json(
      {
        error: 'Payroll cutoff failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// cron-job.org ตั้ง method เป็น GET เสมอ — รับ POST ไว้ด้วยเผื่อเรียกจากที่อื่น
export async function POST(request: NextRequest) {
  return GET(request)
}
