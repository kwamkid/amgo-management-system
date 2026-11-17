// app/api/cron/voice-cleanup/route.ts
//
// Manual trigger only (GET or POST, CRON_SECRET). The daily run piggybacks on /api/cron/cleanup-photos,
// so no separate cron-job.org entry is needed. Queues `voice.cleanup` (lib/voice/pipeline.ts): deletes audio
// older than 90 days (transcripts/drafts stay) and re-queues recordings stuck > 1 h with no live queue job.
import { after, NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { kickQueue } from '@/lib/queue/queue'
import { queueVoiceCleanup } from '@/lib/voice/pipeline'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const queued = await queueVoiceCleanup(createAdminClient() as unknown as SupabaseClient)
    const origin = request.nextUrl.origin
    after(() => kickQueue(origin))
    return NextResponse.json({ success: true, queued })
  } catch (error) {
    console.error('[voice-cleanup] failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ไม่ทราบสาเหตุ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
