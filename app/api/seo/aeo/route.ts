// app/api/seo/aeo/route.ts
//
// ปุ่ม "ถาม AI ตอนนี้" ในแท็บ AI ตอบ — เจ้าของเท่านั้น (web_owners)
//
// POST { siteId } — ลงคิวกลาง ข้อละงาน (ทุกคู่ คำถาม × AI ที่ยังไม่ได้ถามวันนี้) + งานสรุป แล้วปลุกตัวรัน
//   คืน { groupKey, queued } — หน้าเว็บดูความคืบหน้าจาก queue_jobs ของ groupKey นี้ · ปิดหน้าได้ คิวเดินเอง
//   (8 ต.ค. 69: เดิมหน้าเว็บวนเรียกเอง ปิดหน้าแล้วหยุด เจ้าของว่า "แบบนี้เรียกว่าคิวไม่ได้")

import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasDataForSeoCredentials } from '@/lib/services/seo/dataforseo'
import { AEO_ENGINES } from '@/lib/services/seo/aeo'
import { planAeo } from '@/lib/services/seo/aeoSync'
import { requireWebOwner } from '@/lib/services/seo/owner'
import { enqueue, kickQueue } from '@/lib/queue/queue'

export async function POST(request: NextRequest) {
  const user = await requireWebOwner()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!hasDataForSeoCredentials()) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้ง DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD' }, { status: 500 })
  }
  const body = await request.json().catch(() => ({}))
  const siteId = body?.siteId as string | undefined
  if (!siteId) return NextResponse.json({ error: 'ไม่ระบุเว็บ' }, { status: 400 })

  const sb = createAdminClient()
  try {
    const { due, skipped } = await planAeo(sb, { siteId, force: true })
    if (!due.length) {
      return NextResponse.json({ groupKey: null, queued: 0, message: skipped[0] ?? 'ถามครบแล้ววันนี้ — ไม่มีอะไรต้องถามเพิ่ม' })
    }
    const groupKey = `aeo:${siteId}:${Date.now()}`
    const label = (k: string) => AEO_ENGINES.find((e) => e.key === k)?.label ?? k
    await enqueue(sb, [
      ...due.map((d) => ({
        kind: 'seo.aeo.ask',
        payload: { promptId: d.promptId, engine: d.engine },
        groupKey,
        label: `${label(d.engine)} · ${d.prompt}`,
        priority: 2,
        createdBy: user.id,
      })),
      { kind: 'seo.digest', groupKey, label: 'สรุปเข้า Discord', priority: 9, maxAttempts: 2, createdBy: user.id },
    ])
    const origin = request.nextUrl.origin
    after(() => kickQueue(origin))
    return NextResponse.json({ groupKey, queued: due.length })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
