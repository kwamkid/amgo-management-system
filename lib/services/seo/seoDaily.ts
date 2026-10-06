// lib/services/seo/seoDaily.ts
//
// งาน SEO รายวัน — cron ตัวเดียว (cron-job.org ตี 4 → /api/cron/seo/gsc-daily)
// เจ้าของขอ 6 ต.ค. 69: ไม่ต้องแยก cron ต่องาน · งาน SEO รายวันใหม่ต่อท้ายที่นี่
//
// ทั้งรอบต้องจบใน 60 วิ ของ Vercel:
//   1) GSC — งบ 25 วิ (รอบปกติใช้ ~15 วิ ส่วนที่เหลือคือ backfill ซึ่งรอบหน้าทำต่อได้)
//   2) อันดับคำเป้าหมาย — เก็บผลของเมื่อวาน + ส่งคำที่ถึงรอบ/ต้องเช็คซ้ำ
//   3) Bing — ยอดรายวัน (ข้ามถ้าไม่มี key)
//   4) AEO — ถาม AI ที่ถึงรอบ เริ่มชุดใหม่ได้ถึงวิที่ 36 (ชุดละ ≤ 18 วิ) ที่ค้างทำต่อพรุ่งนี้
//   5) สรุปความเปลี่ยนแปลงเข้า Discord ข้อความเดียว
// งานที่ใช้ DataForSEO ข้ามเงียบ ๆ ถ้ายังไม่ตั้งรหัส · แต่ละขั้นพังไม่ลามขั้นอื่น

import type { SupabaseClient } from '@supabase/supabase-js'
import { syncGsc } from './gscSync'
import { hasDataForSeoCredentials } from './dataforseo'
import { collectRanks, postDueRanks, type RankEvent } from './rankSync'
import { runDueAeo, type AeoEvent } from './aeoSync'
import { syncBing } from './bing'
import { sendSeoDigest } from './seoAlerts'

const GSC_BUDGET_MS = 25_000
/** อันดับ: เก็บผลได้ถึงวิที่เท่านี้ */
const RANK_UNTIL_MS = 35_000
/** AEO: เริ่มถามชุดใหม่ได้ถึงวิที่เท่านี้ (ชุดหนึ่งไม่เกิน 18 วิ — askAi ตัดเอง) */
const AEO_UNTIL_MS = 36_000

const step = async <T,>(fn: () => Promise<T>): Promise<T | { error: string }> => {
  try {
    return await fn()
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function runSeoDaily(sb: SupabaseClient) {
  const startedAt = Date.now()
  const gsc = await syncGsc(sb, { budgetMs: GSC_BUDGET_MS })

  const skip = 'ข้าม — ยังไม่ได้ตั้ง DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD'
  let rank: unknown = skip
  let aeo: unknown = skip
  const rankEvents: RankEvent[] = []
  const aeoEvents: AeoEvent[] = []

  let bing: unknown = null
  if (hasDataForSeoCredentials()) {
    rank = await step(async () => {
      const collected = await collectRanks(sb, startedAt + RANK_UNTIL_MS)
      rankEvents.push(...collected.events)
      const posted = await postDueRanks(sb)
      return { collected: { ...collected, events: collected.events.length }, posted }
    })
    bing = await step(() => syncBing(sb))
    aeo = await step(async () => {
      const r = await runDueAeo(sb, { deadline: startedAt + AEO_UNTIL_MS })
      aeoEvents.push(...r.events)
      return { ...r, events: r.events.length }
    })
  } else bing = await step(() => syncBing(sb))

  const alerts = await step(() => sendSeoDigest(sb, rankEvents, aeoEvents))
  return { gsc, rank, aeo, bing, alerts }
}
