// app/api/cron/auto-checkout/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { autoCheckoutPendingRecords } from '@/lib/services/autoCheckoutService'
import { isAuthorizedCron } from '@/lib/cron-auth'

/**
 * ปิดกะให้คนที่ลืมเช็คเอาท์
 *
 * ตั้งเวลาเรียกที่ cron-job.org — ดู docs/cron.md
 *   ทุกวัน 23:59 น. (เวลาไทย) · ส่ง Authorization: Bearer <CRON_SECRET>
 *
 * ชั่วโมงทำงานจะถูกตั้งเป็น 0 + hours_status = 'needs_review' ไม่ได้เดาให้
 * เพราะชั่วโมงคือเงิน — ดูเหตุผลเต็มใน lib/services/autoCheckoutService.ts
 */
export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedCron(request)) {
      return NextResponse.json(
        { error: 'Unauthorized', hint: 'ต้องส่ง Authorization: Bearer <CRON_SECRET>' },
        { status: 401 }
      )
    }

    console.log('[Auto-Checkout] Starting auto-checkout process...')

    const result = await autoCheckoutPendingRecords()

    console.log(`[Auto-Checkout] Processed ${result.processed} records`)

    if (result.errors.length > 0) {
      console.error('[Auto-Checkout] Errors:', result.errors)
    }

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Auto-Checkout] Error:', error)

    return NextResponse.json(
      {
        error: 'Auto-checkout failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}
