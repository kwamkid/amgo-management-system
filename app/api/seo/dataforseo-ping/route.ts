// app/api/seo/dataforseo-ping/route.ts
//
// DataForSEO เรียกเมื่องานเช็คอันดับแต่ละงานเสร็จ (pingback_url ตอนส่งงาน — ดู rankSync.ts)
// ทำให้คิวเดินเองจริง ๆ: กดเช็คแล้วปิดหน้าได้ ไม่ต้องรอหน้าเว็บมาถามผล หรือรอ cron พรุ่งนี้
// (8 ต.ค. 69: เจ้าของบ่นว่าคิวค้าง 18/24 ข้ามวัน เพราะผลถูกเก็บเฉพาะตอนเปิดหน้าค้างไว้)
//
// GET ?id=<task_id>&t=<token> — token = hash ของ CRON_SECRET (ไม่ส่ง secret จริงออกไปนอกระบบ)
// ตอบเร็วเสมอ (DataForSEO ไม่สนผล) แล้วเก็บผลใน after()

import { after, NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { collectRanks, pingToken } from '@/lib/services/seo/rankSync'
import { recordSeoEvents } from '@/lib/services/seo/seoAlerts'

export const maxDuration = 60

function validToken(t: string | null) {
  const expected = pingToken()
  return !!t && t.length === expected.length && timingSafeEqual(Buffer.from(t), Buffer.from(expected))
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!validToken(request.nextUrl.searchParams.get('t'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!id) return NextResponse.json({ error: 'ไม่มี id' }, { status: 400 })

  after(async () => {
    try {
      const sb = createAdminClient()
      const r = await collectRanks(sb, Date.now() + 40_000, { taskIds: [id] })
      // เก็บไว้ส่งรวมทีละเว็บ (seo.alerts.flush) — ไม่ยิง Discord ทีละคำ
      if (r.events.length) await recordSeoEvents(sb, r.events, [])
    } catch (e) {
      console.error('[dataforseo-ping]', id, (e as Error).message)
    }
  })
  return NextResponse.json({ ok: true })
}

// DataForSEO ส่ง GET แต่เผื่อบางบริการส่ง POST
export const POST = GET
