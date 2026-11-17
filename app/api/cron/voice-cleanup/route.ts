// app/api/cron/voice-cleanup/route.ts
//
// Daily (cron-job.org, GET or POST, CRON_SECRET): queue `voice.cleanup` and return at once.
// The job (lib/voice/pipeline.ts) deletes audio older than 90 days (transcripts/drafts stay) and re-queues
// recordings stuck > 1 h with no live queue job.
import { after, NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { enqueue, kickQueue } from '@/lib/queue/queue'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const db = createAdminClient() as unknown as SupabaseClient
    const { count } = await db
      .from('queue_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'voice.cleanup')
      .in('status', ['queued', 'running'])
    if (!count) await enqueue(db, [{ kind: 'voice.cleanup', label: 'ล้างไฟล์เสียงเก่า', groupKey: 'voice:cleanup' }])
    const origin = request.nextUrl.origin
    after(() => kickQueue(origin))
    return NextResponse.json({ success: true, queued: !count })
  } catch (error) {
    console.error('[voice-cleanup] failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ไม่ทราบสาเหตุ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
