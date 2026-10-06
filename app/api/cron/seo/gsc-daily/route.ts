// app/api/cron/seo/gsc-daily/route.ts
//
// งาน SEO รายวัน (ชื่อ path เดิมคงไว้ — cron-job.org ตั้งไว้แล้ว)
//
//   GET — cron-job.org ทุกวัน 04:00 ส่ง Authorization: Bearer <CRON_SECRET>
//         = GSC + อันดับ + AEO + Bing + แจ้งเตือน (ดู seoDaily.ts)
//   ไม่มีปุ่มกดเองแล้ว (เจ้าของสั่งเอาออก 6 ต.ค. 69 — มี cron อยู่แล้ว กดแล้วงง)
//
// รอบเดียวอาจ backfill 16 เดือนไม่จบ — จดความคืบหน้าไว้ รอบถัดไปทำต่อเอง

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { runSeoDaily } from '@/lib/services/seo/seoDaily'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json({ success: true, ...(await runSeoDaily(createAdminClient())) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
