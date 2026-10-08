// lib/services/seo/rankRules.ts
//
// กติกาอันดับที่ทั้งหน้าเว็บ (seoService) และงานเบื้องหลัง (rankSync) ใช้ร่วมกัน
//
// เจ้าของ 9 ต.ค. 69: "เราควรบอกไปว่า ติดอยู่อันดับที่ xx ไปเลย" — เลิกสถานะ รอ/แกว่ง/โผล่บางครั้ง
// ผลค้นครั้งเดียวเชื่อไม่ได้ (เคส "กระเช้าผลไม้ พรีเมี่ยม": #1 → Google เสิร์ฟอีกชุด ไม่เจอ 2 วัน → กลับมา #1
// ขณะที่เจ้าของค้นเองเห็น #4) → อันดับที่โชว์ = ค่ากลางของ 5 ครั้งล่าสุด ครั้งเดียวเพี้ยนตัวเลขไม่ขยับ

/** ดูลึกกี่อันดับ — DataForSEO คิดเงินตามความลึก (หน้าละ 10) · 30 = หน้า 1–3 พอ (เจ้าของ 9 ต.ค. 69) */
export const RANK_DEPTH = 30
/** อันดับที่โชว์ = ค่ากลางของกี่ครั้งล่าสุด */
export const DISPLAY_ROUNDS = 5
/** ขยับเท่านี้ขึ้นไปถือว่า "เปลี่ยนเยอะ" (เช็คซ้ำ / แจ้ง Discord) */
export const BIG_MOVE = 5

/** ไม่ติด (หรือลึกกว่าที่ดู) = RANK_DEPTH + 1 ไว้คิดระยะ */
const asNum = (p: number | null) => (p == null || p > RANK_DEPTH ? RANK_DEPTH + 1 : p)

/** positions ใหม่ → เก่า (แถวละวัน) · คืนอันดับที่โชว์ หรือ null = ไม่ติด 30 อันดับแรก */
export function displayRank(positions: (number | null)[]): number | null {
  const recent = positions.slice(0, DISPLAY_ROUNDS).map(asNum).sort((a, b) => a - b)
  if (!recent.length) return null
  // จำนวนคู่ = เอาตัวกลางที่ดีกว่า
  const mid = recent[Math.floor((recent.length - 1) / 2)]
  return mid > RANK_DEPTH ? null : mid
}

/** อันดับเปลี่ยนเยอะไหม — ข้ามเส้นหน้าแรก · ติด/หลุด 30 อันดับ · ขยับ ≥ BIG_MOVE · คืน up / down / null */
export function bigMove(from: number | null, to: number | null): 'up' | 'down' | null {
  const a = asNum(from)
  const b = asNum(to)
  if (a === b) return null
  const crossed = (a <= 10) !== (b <= 10) || (a > RANK_DEPTH) !== (b > RANK_DEPTH)
  if (!crossed && Math.abs(a - b) < BIG_MOVE) return null
  return b < a ? 'up' : 'down'
}

/**
 * ผลรอบล่าสุดต่างจากอันดับที่โชว์อยู่เยอะ = เช็คซ้ำวันถัดไป (ให้ค่ากลางตามทันเร็ว)
 * จำกัด: 4 วันล่าสุดเช็คไปแล้ว 3 ครั้ง = พอ รอรอบปกติ (กันกรณี Google สลับชุดไปมาทุกวัน)
 */
export function needsRecheck(snaps: { checkedOn: string; position: number | null }[], today: string) {
  if (snaps.length < 2) return false
  const before = displayRank(snaps.slice(1).map((s) => s.position))
  if (!bigMove(before, snaps[0].position)) return false
  const since = new Date(new Date(`${today}T00:00:00+07:00`).getTime() - 3 * 864e5).toISOString().slice(0, 10)
  return snaps.filter((s) => s.checkedOn >= since).length < 3
}

/** 4 รอบล่าสุดห่างกันไม่เกิน 2 อันดับ (หรือไม่ติดทุกรอบ) = นิ่ง → เช็คห่างขึ้นได้ */
export function isStable(positions: (number | null)[]) {
  const last = positions.slice(0, 4).map(asNum)
  return last.length === 4 && Math.max(...last) - Math.min(...last) <= 2
}

/** "#4" / "ไม่ติด 30 อันดับแรก" */
export const fmtDisplayRank = (p: number | null) => (p == null ? `ไม่ติด ${RANK_DEPTH} อันดับแรก` : `#${p}`)
