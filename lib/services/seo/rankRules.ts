// lib/services/seo/rankRules.ts
//
// กติกาอันดับที่ทั้งหน้าเว็บ (seoService) และงานเบื้องหลัง (rankSync) ใช้ร่วมกัน

/**
 * ร่วงหนักจนน่าสงสัย = เคยติด 30 อันดับแรก แล้วรอบนี้หลุด 100 หรือร่วง 20 อันดับขึ้นไป
 * ผล SERP จากเครื่องกลางแกว่งได้ (เคสจริง "กระเช้าผลไม้" 6 ต.ค. 69: GSC อันดับ 3–5 แต่ DataForSEO ไม่เจอ)
 * จึงยังไม่ฟันธงว่าหลุด จนกว่าจะเช็คซ้ำอีกรอบ — หน้าเว็บโชว์ "รอเช็คซ้ำ" · rankSync ส่งเช็คซ้ำวันถัดไป
 */
export function isSuspiciousDrop(cur: number | null, prev: number | null) {
  if (prev == null || prev > 30) return false
  return cur == null || cur - prev >= 20
}

// ── ความมั่นใจว่า "ติดจริง" (เจ้าของขอ 8 ต.ค. 69) ───────────────────────────
//
// อันดับครั้งเดียวเชื่อไม่ได้ (Google สลับชุดผล) แต่ค้นถี่ก็เปลือง → ใช้ประวัติช่วยแทน:
//   · DataForSEO: รวม "เจอเรากี่ครั้ง" จาก 4 รอบล่าสุดใน 35 วัน (รอบละ 1 ตัวอย่างก็พอ)
//   · GSC: คนค้นเห็นเรากี่ % = การแสดงผล 10 วัน ÷ ยอดค้นหาโดยประมาณ (ยอด/เดือน × 10/30)
//     อันดับเฉลี่ยของ GSC คิดเฉพาะครั้งที่โผล่ — เห็นเรา 1% แต่อันดับ 7 = Google แค่ลองแสดง ไม่ใช่ติดจริง

export type RankStatus = 'solid' | 'sometimes' | 'checking' | 'none' | 'unknown'

export const RANK_STATUS_LABEL: Record<RankStatus, string> = {
  solid: 'ติดจริง',
  sometimes: 'โผล่บางครั้ง',
  checking: 'ยังไม่แน่ใจ',
  none: 'ยังไม่ติด',
  unknown: 'ยังไม่เช็ค',
}

const HISTORY_ROUNDS = 4
const HISTORY_DAYS = 35
/**
 * จะบอกว่า "ยังไม่ติด" ได้ต้องไม่เจอเลยอย่างน้อยเท่านี้ครั้ง และข้ามอย่างน้อย 2 วัน (เจ้าของ 8 ต.ค. 69:
 * "ควร double check ก่อนตอบ") — ไม่ถึง = "ยังไม่แน่ใจ" แล้ว cron เช็คเพิ่มวันละครั้งจนครบ
 */
export const MIN_SAMPLES_TO_SAY_NONE = 3

export type RankEvidenceSnap = {
  checkedOn: string
  position: number | null
  samples: number
  hits: number
  organicSeen?: number | null
  features?: { type: string; rank: number }[] | null
}

export function rankConfidence(
  /** ใหม่ → เก่า */
  snaps: RankEvidenceSnap[],
  gsc: { impressions10d: number; monthlyVolume: number | null }
) {
  const cutoff = new Date(Date.now() - HISTORY_DAYS * 864e5).toISOString().slice(0, 10)
  const recent = snaps.filter((s) => s.checkedOn >= cutoff).slice(0, HISTORY_ROUNDS)
  const samples = recent.reduce((n, s) => n + s.samples, 0)
  const hits = recent.reduce((n, s) => n + s.hits, 0)
  const days = recent.filter((s) => s.samples > 0).length
  const rate = samples ? hits / samples : null
  const expected = gsc.monthlyVolume ? (gsc.monthlyVolume * 10) / 30 : null
  const share = expected ? Math.min(1, gsc.impressions10d / expected) : null
  // ส่วนอื่นของหน้าที่เราโผล่ (กล่องรูป · แผนที่ …) จากรอบล่าสุดที่มีข้อมูล — ไม่ซ้ำชนิด
  const featureMap = new Map<string, number>()
  for (const s of recent) for (const f of s.features ?? []) if (!featureMap.has(f.type)) featureMap.set(f.type, f.rank)
  const features = [...featureMap.entries()].map(([type, rank]) => ({ type, rank }))
  const organicSeen = recent.find((s) => s.organicSeen)?.organicSeen ?? null
  // อันดับ "ปกติ" = ค่ากลางของวันที่เจอ (ไม่ใช่ครั้งล่าสุดครั้งเดียว) — ช่องอันดับใช้ตัวนี้ จะได้ไม่ขัดกับสถานะ
  const found = recent.map((s) => s.position).filter((p): p is number => p != null).sort((a, b) => a - b)
  const typical = found.length ? found[Math.floor((found.length - 1) / 2)] : null
  const best = found[0] ?? null
  const latest = snaps[0] ? { position: snaps[0].position, checkedOn: snaps[0].checkedOn } : null

  let status: RankStatus = 'unknown'
  if ((samples >= 2 && rate! >= 0.5) || (share != null && share >= 0.5)) status = 'solid'
  else if (hits > 0 || features.length || (share != null && share >= 0.1)) status = 'sometimes'
  else if (samples >= MIN_SAMPLES_TO_SAY_NONE && days >= 2) status = 'none'
  else if (samples > 0 || share != null) status = 'checking'

  return { status, hits, samples, days, rounds: recent.length, share, features, organicSeen, typical, best, latest }
}

/** ชื่อไทยของส่วนต่าง ๆ บนหน้าผลค้นหา */
export const SERP_FEATURE_LABEL: Record<string, string> = {
  images: 'กล่องรูป',
  local_pack: 'แผนที่ร้านใกล้',
  map: 'แผนที่',
  video: 'วิดีโอ',
  short_videos: 'คลิปสั้น',
  people_also_ask: 'คำถามที่เกี่ยวข้อง',
  featured_snippet: 'กล่องคำตอบ',
  knowledge_graph: 'กล่องข้อมูลแบรนด์',
  popular_products: 'สินค้ายอดนิยม',
  shopping: 'ช็อปปิ้ง',
  top_stories: 'ข่าว',
}
