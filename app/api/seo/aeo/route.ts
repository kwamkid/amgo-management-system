// app/api/seo/aeo/route.ts
//
// ปุ่ม "ถาม AI ตอนนี้" ในแท็บ AI ตอบ — เจ้าของเท่านั้น (web_owners)
//
// POST { siteId } — ตอบ 202 ทันที แล้วถามทุกคู่ (คำถาม × AI) ของเว็บนั้นที่ยังไม่ได้ถามวันนี้ใน after()
//   ช่วงละ ~40 วิ ยังเหลือ = เรียกตัวเองต่ออีกช่วง (สูงสุด 6) — ปิดหน้าเว็บได้ งานเดินต่อเอง
//   (8 ต.ค. 69: เดิมหน้าเว็บวนเรียกเอง ปิดหน้าแล้วหยุด เจ้าของว่า "แบบนี้เรียกว่าคิวไม่ได้")
//   หน้าเว็บดูความคืบหน้าจากจำนวนคำตอบของวันนี้ในตาราง
// ช่วงต่อ ๆ ไปเรียกด้วย CRON_SECRET (ไม่มี session ผู้ใช้) + ?siteId=&hop=

import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { hasDataForSeoCredentials } from '@/lib/services/seo/dataforseo'
import { runDueAeo } from '@/lib/services/seo/aeoSync'
import { requireWebOwner } from '@/lib/services/seo/owner'
import { sendSeoDigest } from '@/lib/services/seo/seoAlerts'

export const maxDuration = 60

const MAX_HOPS = 6

async function runHop(request: NextRequest, siteId: string, hop: number) {
  const sb = createAdminClient()
  try {
    const r = await runDueAeo(sb, { siteId, force: true, deadline: Date.now() + 40_000 })
    if (r.events.length) await sendSeoDigest(sb, [], r.events).catch(() => {})
    if (r.remaining > 0 && r.done > 0 && hop < MAX_HOPS) {
      await fetch(new URL(`/api/seo/aeo?siteId=${siteId}&hop=${hop + 1}`, request.nextUrl.origin), {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
        signal: AbortSignal.timeout(10_000),
      }).catch((e) => console.error('[seo-aeo] chain', (e as Error).message))
    }
  } catch (e) {
    console.error('[seo-aeo]', siteId, (e as Error).message)
  }
}

export async function POST(request: NextRequest) {
  const internal = isAuthorizedCron(request)
  if (!internal && !(await requireWebOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!hasDataForSeoCredentials()) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้ง DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD' }, { status: 500 })
  }
  const body = internal ? {} : await request.json().catch(() => ({}))
  const siteId = (body?.siteId as string | undefined) ?? request.nextUrl.searchParams.get('siteId')
  if (!siteId) return NextResponse.json({ error: 'ไม่ระบุเว็บ' }, { status: 400 })
  const hop = Number(request.nextUrl.searchParams.get('hop') ?? '1')

  after(() => runHop(request, siteId, hop))
  return NextResponse.json({ accepted: true }, { status: 202 })
}
