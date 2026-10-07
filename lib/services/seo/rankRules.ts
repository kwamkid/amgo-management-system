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

export type RankStatus = 'solid' | 'sometimes' | 'none' | 'unknown'

export const RANK_STATUS_LABEL: Record<RankStatus, string> = {
  solid: 'ติดจริง',
  sometimes: 'โผล่บางครั้ง',
  none: 'ยังไม่ติด',
  unknown: 'ยังไม่เช็ค',
}

const HISTORY_ROUNDS = 4
const HISTORY_DAYS = 35

export function rankConfidence(
  /** ใหม่ → เก่า */
  snaps: { checkedOn: string; position: number | null; samples: number; hits: number }[],
  gsc: { impressions10d: number; monthlyVolume: number | null }
) {
  const cutoff = new Date(Date.now() - HISTORY_DAYS * 864e5).toISOString().slice(0, 10)
  const recent = snaps.filter((s) => s.checkedOn >= cutoff).slice(0, HISTORY_ROUNDS)
  const samples = recent.reduce((n, s) => n + s.samples, 0)
  const hits = recent.reduce((n, s) => n + s.hits, 0)
  const rate = samples ? hits / samples : null
  const expected = gsc.monthlyVolume ? (gsc.monthlyVolume * 10) / 30 : null
  const share = expected ? Math.min(1, gsc.impressions10d / expected) : null

  let status: RankStatus = 'unknown'
  if ((samples >= 2 && rate! >= 0.5) || (share != null && share >= 0.5)) status = 'solid'
  else if (hits > 0 || (share != null && share >= 0.1)) status = 'sometimes'
  else if (samples > 0 || share != null) status = 'none'

  return { status, hits, samples, rounds: recent.length, share }
}
