// lib/services/seo/seoDaily.ts
//
// งาน SEO รายวัน — cron ตัวเดียว (cron-job.org ตี 4 → /api/cron/seo/gsc-daily)
// เจ้าของขอ 6 ต.ค. 69: ไม่ต้องแยก cron ต่องาน · งาน SEO รายวันใหม่ต่อท้ายที่นี่
//
// แบ่งเป็นช่วง ช่วงละไม่เกิน 60 วิ ของ Vercel (route ต่อช่วงถัดไปเอง — ดู route.ts):
//   ช่วง gsc  — ดึง GSC ทุกเว็บ งบ 48 วิ · ไม่ทันครบ = ต่ออีกช่วง gsc (สูงสุด 3 ช่วง)
//               (7 ต.ค. 69: 7 เว็บใช้ ~50 วิ เดิมรวมทุกอย่างช่วงเดียว อันดับ/AI เลยไม่เคยได้รัน)
//   ช่วง work — 1) อันดับ: เก็บผลเมื่อวาน + ส่งคำที่ถึงรอบ/ต้องเช็คซ้ำ
//               2) Bing ยอดรายวัน (ข้ามถ้าไม่มี key)
//               3) AEO ถาม AI ที่ถึงรอบ เริ่มชุดใหม่ได้ถึงวิที่ 36 (ชุดละ ≤ 18 วิ)
//               4) สรุปความเปลี่ยนแปลงเข้า Discord ข้อความเดียว
//   ช่วง aeo  — ถาม AI ที่ยังค้างจากช่วง work ต่อ (ช่วงละ ~40 วิ สูงสุด 4 ช่วง) ที่เหลือจริง ๆ ทำต่อพรุ่งนี้
// งานที่ใช้ DataForSEO ข้ามเงียบ ๆ ถ้ายังไม่ตั้งรหัส · แต่ละขั้นพังไม่ลามขั้นอื่น

import type { SupabaseClient } from '@supabase/supabase-js'
import { syncGsc } from './gscSync'
import { hasDataForSeoCredentials } from './dataforseo'
import { collectRanks, postDueRanks, type RankEvent } from './rankSync'
import { runDueAeo, type AeoEvent } from './aeoSync'
import { syncBing } from './bing'
import { sendSeoDigest } from './seoAlerts'

const GSC_BUDGET_MS = 48_000
/** อันดับ: เก็บผลได้ถึงวิที่เท่านี้ */
const RANK_UNTIL_MS = 25_000
/** AEO: เริ่มถามชุดใหม่ได้ถึงวิที่เท่านี้ (ชุดหนึ่งไม่เกิน 18 วิ — askAi ตัดเอง) */
const AEO_UNTIL_MS = 36_000

const step = async <T,>(fn: () => Promise<T>): Promise<T | { error: string }> => {
  try {
    return await fn()
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** ช่วง gsc — คืนจำนวนเว็บที่เวลาไม่พอ (route ใช้ตัดสินว่าจะต่อช่วง gsc อีกไหม) */
export async function runSeoDailyGsc(sb: SupabaseClient) {
  const gsc = await syncGsc(sb, { budgetMs: GSC_BUDGET_MS })
  const deferred = gsc.filter((r) => r.status === 'skipped' && r.detail.startsWith('เวลาไม่พอ')).length
  return { gsc, deferred }
}

/** ช่วง work — อันดับ · Bing · AEO · แจ้งเตือน */
export async function runSeoDailyWork(sb: SupabaseClient) {
  const startedAt = Date.now()
  const skip = 'ข้าม — ยังไม่ได้ตั้ง DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD'
  let rank: unknown = skip
  let aeo: unknown = skip
  const rankEvents: RankEvent[] = []
  const aeoEvents: AeoEvent[] = []

  if (hasDataForSeoCredentials()) {
    rank = await step(async () => {
      const collected = await collectRanks(sb, startedAt + RANK_UNTIL_MS)
      rankEvents.push(...collected.events)
      const posted = await postDueRanks(sb)
      return { collected: { ...collected, events: collected.events.length }, posted }
    })
  }
  const bing = await step(() => syncBing(sb))
  if (hasDataForSeoCredentials()) {
    aeo = await step(async () => {
      const r = await runDueAeo(sb, { deadline: startedAt + AEO_UNTIL_MS })
      aeoEvents.push(...r.events)
      return { ...r, events: r.events.length }
    })
  }
  const alerts = await step(() => sendSeoDigest(sb, rankEvents, aeoEvents))
  const aeoRemaining = typeof aeo === 'object' && aeo && 'remaining' in aeo ? Number(aeo.remaining) : 0
  return { rank, bing, aeo, alerts, aeoRemaining }
}

/** ช่วง aeo — ถาม AI ต่อจากที่ค้าง · แจ้งเตือนเฉพาะความเปลี่ยนแปลงของช่วงนี้ */
export async function runSeoDailyAeo(sb: SupabaseClient) {
  if (!hasDataForSeoCredentials()) return { aeoRemaining: 0 }
  const r = await runDueAeo(sb, { deadline: Date.now() + 40_000 })
  if (r.events.length) await sendSeoDigest(sb, [], r.events).catch(() => {})
  return { ...r, events: r.events.length, aeoRemaining: r.remaining }
}
