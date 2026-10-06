// app/api/cron/seo/gsc-daily/route.ts
//
// งาน SEO รายวัน (ชื่อ path เดิมคงไว้ — cron-job.org ตั้งไว้แล้ว)
//
//   GET — cron-job.org ทุกวัน 04:00 ส่ง Authorization: Bearer <CRON_SECRET>
//         ?stage=gsc (ค่าเริ่มต้น) → work → aeo (ถ้าถาม AI ยังไม่ครบ) — แต่ละช่วงจบแล้วเรียกช่วงถัดไปเอง (ได้ 60 วิ ใหม่ทุกช่วง)
//         cron-job.org ตั้งแค่ตัวเดียว ไม่ต้องแก้ · ดู lib/services/seo/seoDaily.ts
//   ไม่มีปุ่มกดเองแล้ว (เจ้าของสั่งเอาออก 6 ต.ค. 69 — มี cron อยู่แล้ว กดแล้วงง)
//
// รอบเดียวอาจ backfill 16 เดือนไม่จบ — จดความคืบหน้าไว้ รอบถัดไปทำต่อเอง

import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { runSeoDailyAeo, runSeoDailyGsc, runSeoDailyWork } from '@/lib/services/seo/seoDaily'

export const maxDuration = 60

/** สูงสุดกี่ช่วง gsc ก่อนไปช่วง work (เว็บที่ค้างจริง ๆ ได้คิวแรกพรุ่งนี้) */
const MAX_GSC_HOPS = 3
/** ช่วงถาม AI ต่อได้สูงสุดกี่ช่วงต่อวัน (~15 คำถาม×AI ต่อช่วง) */
const MAX_AEO_HOPS = 4

/**
 * เรียกช่วงถัดไปหลังตอบ cron แล้ว — รอแค่ให้คำขอออกไป (ตัดที่ 5 วิ) ช่วงถัดไปทำงานต่อเองใน function ใหม่
 * ส่ง secret ทาง header เท่านั้น (ไม่ใส่ใน URL)
 */
function chain(request: NextRequest, query: string) {
  after(() =>
    fetch(new URL(`/api/cron/seo/gsc-daily?${query}`, request.nextUrl.origin), {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {})
  )
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const stage = request.nextUrl.searchParams.get('stage') ?? 'gsc'
  const hop = Number(request.nextUrl.searchParams.get('hop') ?? '1')
  try {
    if (stage === 'work' || stage === 'aeo') {
      const r = stage === 'work' ? await runSeoDailyWork(createAdminClient()) : await runSeoDailyAeo(createAdminClient())
      const aeoHop = stage === 'work' ? 0 : hop
      // ถาม AI ยังค้าง + ช่วงนี้ยังทำได้บ้าง (กันวนเมื่อติดงบ/AI ล่มทั้งหมด)
      const progressed = stage === 'work' || ('done' in r && Number(r.done) > 0)
      if (r.aeoRemaining > 0 && progressed && aeoHop < MAX_AEO_HOPS) chain(request, `stage=aeo&hop=${aeoHop + 1}`)
      return NextResponse.json({ success: true, stage, ...r })
    }
    const r = await runSeoDailyGsc(createAdminClient())
    const next = r.deferred > 0 && hop < MAX_GSC_HOPS ? `stage=gsc&hop=${hop + 1}` : 'stage=work'
    chain(request, next)
    return NextResponse.json({ success: true, stage, hop, next, ...r })
  } catch (e) {
    // GSC พังทั้งช่วง ก็ยังให้อันดับ/AI ทำงานต่อ
    if (stage !== 'work') chain(request, 'stage=work')
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
