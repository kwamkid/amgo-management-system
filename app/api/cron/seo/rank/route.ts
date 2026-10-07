// app/api/cron/seo/rank/route.ts
//
// ปุ่ม "เช็คอันดับตอนนี้" — เจ้าของเท่านั้น (web_owners) · body { siteId }
//   ลงคิวกลาง (seo.rank.post force) แล้วปลุกตัวรัน — ผลกลับมาเองทาง pingback ปิดหน้าได้
//   หน้าเว็บดูความคืบหน้าจาก seo_rank_tasks (แผงคิวลอย)
// งานรายวันอยู่ที่ /api/cron/seo/gsc-daily (ลงคิวชุดใหญ่) — route นี้ไม่มี cron ของตัวเอง

import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasDataForSeoCredentials } from '@/lib/services/seo/dataforseo'
import { requireWebOwner } from '@/lib/services/seo/owner'
import { enqueue, kickQueue } from '@/lib/queue/queue'

export async function POST(request: NextRequest) {
  const user = await requireWebOwner()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!hasDataForSeoCredentials()) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้ง DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD' }, { status: 500 })
  }
  const body = await request.json().catch(() => ({}))
  if (!body?.siteId) return NextResponse.json({ error: 'ไม่ระบุเว็บ' }, { status: 400 })

  await enqueue(createAdminClient(), [
    {
      kind: 'seo.rank.post',
      payload: { siteId: body.siteId, force: true },
      groupKey: `rank:${body.siteId}:${Date.now()}`,
      label: 'ส่งเช็คอันดับ',
      priority: 1,
      createdBy: user.id,
    },
  ])
  const origin = request.nextUrl.origin
  after(() => kickQueue(origin))
  return NextResponse.json({ queued: true })
}
