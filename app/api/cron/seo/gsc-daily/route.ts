// app/api/cron/seo/gsc-daily/route.ts
//
// งาน SEO รายวัน (ชื่อ path เดิมคงไว้ — cron-job.org ตั้งไว้แล้ว)
//
//   GET/POST — cron-job.org ทุกวัน 04:00 ส่ง Authorization: Bearer <CRON_SECRET>
//              ลงคิวกลางทั้งชุด (ดู lib/services/seo/seoDaily.ts) แล้วปลุกตัวรัน · ตอบใน ~2 วิ
//
// ประวัติ: 7 ต.ค. 69 timeout (cron-job.org รอได้ 30 วิ งานจริงใช้ ~50 วิ)
//          8 ต.ค. 69 405 (cron-job.org ส่ง POST แต่ route รับแค่ GET) → รับทั้งคู่ + ลงคิวแทนการทำเอง

import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { enqueueSeoDaily } from '@/lib/services/seo/seoDaily'
import { kickQueue } from '@/lib/queue/queue'

export const maxDuration = 30

async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const r = await enqueueSeoDaily(createAdminClient())
    const origin = request.nextUrl.origin
    after(() => kickQueue(origin))
    return NextResponse.json({ success: true, ...r })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
