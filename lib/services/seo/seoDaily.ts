// lib/services/seo/seoDaily.ts
//
// งาน SEO รายวัน — cron ตัวเดียว (cron-job.org ตี 4 → /api/cron/seo/gsc-daily)
// เจ้าของขอ 6 ต.ค. 69: ไม่ต้องแยก cron ต่องาน · งาน SEO รายวันใหม่ (AEO · Bing) ต่อท้ายที่นี่
//
// ทั้งรอบต้องจบใน 60 วิ ของ Vercel:
//   1) GSC — ได้งบ 30 วิ (รอบปกติใช้ ~15 วิ ส่วนที่เหลือคือ backfill ซึ่งรอบหน้าทำต่อได้)
//   2) อันดับคำเป้าหมาย — เก็บผลของเมื่อวาน + ส่งคำที่ถึงรอบ (ข้ามเงียบ ๆ ถ้ายังไม่ตั้งรหัส DataForSEO)

import type { SupabaseClient } from '@supabase/supabase-js'
import { syncGsc } from './gscSync'
import { hasDataForSeoCredentials } from './dataforseo'
import { collectRanks, postDueRanks } from './rankSync'

const GSC_BUDGET_MS = 30_000
/** เวลาที่เหลือให้งานอันดับ นับจากต้นรอบ */
const TOTAL_BUDGET_MS = 52_000

export async function runSeoDaily(sb: SupabaseClient) {
  const startedAt = Date.now()
  const gsc = await syncGsc(sb, { budgetMs: GSC_BUDGET_MS })

  let rank: unknown = 'ข้าม — ยังไม่ได้ตั้ง DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD'
  if (hasDataForSeoCredentials()) {
    try {
      const collected = await collectRanks(sb, startedAt + TOTAL_BUDGET_MS - 5_000)
      const posted = await postDueRanks(sb)
      rank = { collected, posted }
    } catch (e) {
      rank = { error: (e as Error).message }
    }
  }
  return { gsc, rank }
}
