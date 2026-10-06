// app/api/cron/seo/gsc-daily/route.ts
//
// ดึงข้อมูล Google Search Console ของทุกเว็บในเมนู SEO / AEO
//
//   GET  — cron-job.org ทุกวัน 05:00 ส่ง Authorization: Bearer <CRON_SECRET>
//   POST — เจ้าของกดดึงเองจากหน้าเว็บ (ต้องอยู่ใน web_owners) · body { siteId? }
//
// รอบเดียวอาจ backfill 16 เดือนไม่จบ — จดความคืบหน้าไว้ รอบถัดไปทำต่อเอง
// (กดปุ่มซ้ำได้ ไม่ต้องรอ cron)

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { syncGsc } from '@/lib/services/seo/gscSync'
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
  return run()
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
