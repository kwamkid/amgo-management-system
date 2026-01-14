// app/api/cron/auto-checkout/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { autoCheckoutPendingRecords } from '@/lib/services/autoCheckoutService'

/**
 * Auto-Checkout Cron Job
 *
 * This endpoint should be called daily at 23:59 to automatically
 * checkout employees who forgot to checkout.
 *
 * Setup with:
 * - Vercel Cron Jobs
 * - GitHub Actions
 * - External cron service (like cron-job.org)
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/auto-checkout",
 *     "schedule": "59 23 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    // Skip authentication in development mode for easy testing
    const isDevelopment = process.env.NODE_ENV === 'development'
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!isDevelopment && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized', hint: 'Include Authorization header with Bearer token' },
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
