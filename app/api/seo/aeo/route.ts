// app/api/seo/aeo/route.ts
//
// ปุ่ม "ถาม AI ตอนนี้" ในแท็บ AI ตอบ — เจ้าของเท่านั้น (web_owners)
//
// POST { siteId } — ถามทุกคู่ (คำถาม × AI) ของเว็บนั้นที่ยังไม่ได้ถามวันนี้ เท่าที่ทันใน ~40 วิ
//   คืน remaining > 0 = ยังเหลือ หน้าเว็บเรียกซ้ำเองจนครบ (ทำเป็นคิวให้เห็นความคืบหน้า)

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasDataForSeoCredentials } from '@/lib/services/seo/dataforseo'
import { runDueAeo } from '@/lib/services/seo/aeoSync'
import { requireWebOwner } from '@/lib/services/seo/owner'
import { sendSeoDigest } from '@/lib/services/seo/seoAlerts'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  if (!(await requireWebOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!hasDataForSeoCredentials()) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้ง DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD' }, { status: 500 })
  }
  const body = await request.json().catch(() => ({}))
  if (!body?.siteId) return NextResponse.json({ error: 'ไม่ระบุเว็บ' }, { status: 400 })

  const sb = createAdminClient()
  try {
    const r = await runDueAeo(sb, { siteId: body.siteId, force: true, deadline: Date.now() + 40_000 })
    if (r.events.length) await sendSeoDigest(sb, [], r.events).catch(() => {})
    return NextResponse.json({ success: true, ...r, events: r.events.length })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
