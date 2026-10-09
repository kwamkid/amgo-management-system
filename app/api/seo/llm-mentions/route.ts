// app/api/seo/llm-mentions/route.ts
//
// ปุ่ม "ดึงข้อมูล AI อ้างเรา" ในแท็บ AI ตอบ — เจ้าของเท่านั้น · ลงคิวกลาง (seo.llm.mentions) แล้วปลุกตัวรัน
// POST { siteId } → { groupKey } ไว้ให้แผงคิวกลาง (GlobalQueue) ติดตาม · ~$0.6 ต่อครั้ง

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
  const groupKey = `llm:${body.siteId}:${Date.now()}`
  await enqueue(createAdminClient(), [
    { kind: 'seo.llm.mentions', payload: { siteId: body.siteId }, groupKey, label: 'ดึงข้อมูล AI อ้างเรา', priority: 1, maxAttempts: 2, createdBy: user.id },
  ])
  const origin = request.nextUrl.origin
  after(() => kickQueue(origin))
  return NextResponse.json({ groupKey })
}
