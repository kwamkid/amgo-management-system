// app/api/cron/seo/gsc-daily/route.ts
//
// งาน SEO รายวัน (ชื่อ path เดิมคงไว้ — cron-job.org ตั้งไว้แล้ว)
//
//   GET  — cron-job.org ทุกวัน 04:00 ส่ง Authorization: Bearer <CRON_SECRET>
//          = GSC ของทุกเว็บ + อันดับคำเป้าหมาย (ดู seoDaily.ts)
//   POST — เจ้าของกด "ดึงข้อมูลตอนนี้" (ต้องอยู่ใน web_owners) · body { siteId? } — GSC อย่างเดียว
//
// รอบเดียวอาจ backfill 16 เดือนไม่จบ — จดความคืบหน้าไว้ รอบถัดไปทำต่อเอง
// (กดปุ่มซ้ำได้ ไม่ต้องรอ cron)

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { syncGsc } from '@/lib/services/seo/gscSync'
import { runSeoDaily } from '@/lib/services/seo/seoDaily'
import { requireWebOwner } from '@/lib/services/seo/owner'

export const maxDuration = 60

async function run(siteId?: string) {
  try {
    const results = await syncGsc(createAdminClient(), { siteId })
    return NextResponse.json({ success: true, results })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

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

export async function POST(request: NextRequest) {
  if (isAuthorizedCron(request)) return run()
  if (!(await requireWebOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let siteId: string | undefined
  try {
    siteId = (await request.json())?.siteId
  } catch {
    /* ไม่ส่ง body = ทุกเว็บ */
  }
  return run(siteId)
}
