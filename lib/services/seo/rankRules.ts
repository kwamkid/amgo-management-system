// lib/services/seo/rankRules.ts
//
// กติกาอันดับที่ทั้งหน้าเว็บ (seoService) และงานเบื้องหลัง (rankSync) ใช้ร่วมกัน
// เหตุผล + เคสจริงที่เคยพลาด: .claude/rules/seo-rank-rules.md (แก้กติกา = อัปเดตไฟล์นั้นด้วย)
//
// ตัดสินอันดับทุกที่ด้วย judgeRank (ท้ายไฟล์) ตัวเดียว — ห้ามคิดอันดับเองที่อื่น
// เจ้าของ 9 ต.ค. 69: "เราควรบอกไปว่า ติดอยู่อันดับที่ xx ไปเลย" — เลิกสถานะ รอ/แกว่ง/โผล่บางครั้ง
// ผลค้นครั้งเดียวเชื่อไม่ได้ (เคส "กระเช้าผลไม้ พรีเมี่ยม": #1 → Google เสิร์ฟอีกชุด ไม่เจอ 2 วัน → กลับมา #1
// ขณะที่เจ้าของค้นเองเห็น #4) → อันดับที่โชว์ = ค่ากลางของครั้งที่เจอใน 5 ครั้งล่าสุด (ได้ #4)

/** ดูลึกกี่อันดับ — DataForSEO คิดเงินตามความลึก (หน้าละ 10) · 30 = หน้า 1–3 พอ (เจ้าของ 9 ต.ค. 69) */
export const RANK_DEPTH = 30
/** อันดับที่โชว์ = ค่ากลางของกี่ครั้งล่าสุด */
export const DISPLAY_ROUNDS = 5
/** ขยับเท่านี้ขึ้นไปถือว่า "เปลี่ยนเยอะ" (เช็คซ้ำ / แจ้ง Discord) */
export const BIG_MOVE = 5

/** ไม่ติด (หรือลึกกว่าที่ดู) = RANK_DEPTH + 1 ไว้คิดระยะ */
const asNum = (p: number | null) => (p == null || p > RANK_DEPTH ? RANK_DEPTH + 1 : p)

/** เจออย่างน้อยกี่ครั้งใน DISPLAY_ROUNDS ครั้งล่าสุด ถึงนับว่าติด */
export const MIN_FOUND = 2

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
  const before = judgeRank(snaps.slice(1)).rank
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

// ── ตัวตัดสินอันดับ (judgeRank) — ทุกที่ที่ต้อง "ตัดสิน" อันดับใช้ตัวนี้ตัวเดียว ─────────────────
//
// เจ้าของ 12 ต.ค. 69: "ก่อนตัดสินอะไร ให้ดูข้อมูลย้อนหลัง บางทีค้นเจอ ไม่เจอ มีหลายชุด"
// หลักฐาน 3 อย่างที่ดูพร้อมกัน:
//   1. ผลเช็คย้อนหลัง 10 ครั้ง (ไม่ใช่แค่ครั้งล่าสุด)
//   2. เจอ "หน้าไหน" — Google มีหลายชุด ชุดหนึ่งมีหน้าหลักเรา อีกชุดมีแค่หน้าอื่นลึก ๆ
//      (เคส "กระเช้าผลไม้ ส่งด่วน" 12 ต.ค.: หน้าแรก #1–4 ↔ หน้าสินค้า #28) → หน้าอื่นที่ลึกกว่าหน้าแรก = นับเป็น "อีกชุด"
//   3. GSC (คนค้นจริง) 10 วันล่าสุด — ระบบเช็คไม่เจอ แต่คนจริงเห็น = เชื่อฝั่งที่เจอ (การไม่เจอ = ได้อีกชุด ไม่ใช่หลักฐานว่าหลุด)

/** ย้อนดูกี่ครั้ง */
export const LOOKBACK = 10
/** ไม่เจอ (หรือเจอแค่ชุดอื่น) ติดกันกี่ครั้ง ถึงเชื่อว่าหลุดจริง */
export const MISS_CONFIRM = 3

export type RankCheck = { position: number | null; url?: string | null }
/** GSC: ต่อวัน เอาหน้าที่อันดับดีสุด (คือสิ่งที่คนเห็น) */
export type GscDay = { date: string; position: number; impressions: number }
/** GSC ต้องมีคนเห็นอย่างน้อยเท่านี้ (รวม 10 วัน) และหลายวัน ถึงใช้หักล้างระบบเช็คได้ — 1–2 ครั้งอาจเป็นคนค้นจากที่เฉพาะ */
export const GSC_MIN_IMPRESSIONS = 5
export const GSC_MIN_DAYS = 2

export type RankVerdict = {
  /** อันดับที่โชว์ · null = ไม่ติด 30 อันดับแรก */
  rank: number | null
  /** ตัวเลขมาจากไหน */
  source: 'check' | 'gsc' | 'none'
  /**
   * steady = เจอสม่ำเสมอ · split = Google สลับชุด (เจอบ้างไม่เจอบ้าง) ยังนับว่าติด
   * disputed = ระบบเช็คไม่เจอติดกัน แต่คนค้นจริงเห็น · gone = หลุดจริง (ไม่เจอติดกัน + GSC ไม่เห็นหน้าแรก)
   * none = ยังไม่เคยเจอ · unchecked = ยังไม่เคยเช็ค
   */
  pattern: 'steady' | 'split' | 'disputed' | 'gone' | 'none' | 'unchecked'
  /** เจอหน้าหลักกี่ครั้ง จากที่ดู */
  found: number
  total: number
  /** หน้าหลักของคำนี้ (หน้าที่ติดหน้าแรกบ่อยสุด) */
  mainUrl: string | null
  /** อันดับคนค้นจริง (GSC ค่ากลาง 10 วัน) */
  gsc: number | null
  /** อธิบายเป็นภาษาคน — โชว์ใน tooltip / แจ้งเตือน */
  reason: string
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor((s.length - 1) / 2)]
}
const normUrl = (u?: string | null) => (u ? u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : null)

/** GSC รายวัน → ค่ากลาง (ปัดเป็นจำนวนเต็ม) · ข้อมูลน้อยกว่าเกณฑ์ = null (ไม่นับเป็นหลักฐาน) */
export function gscMedian(days: GscDay[]) {
  const imp = days.reduce((a, d) => a + d.impressions, 0)
  if (days.length < GSC_MIN_DAYS || imp < GSC_MIN_IMPRESSIONS) return null
  return Math.round(median(days.map((d) => d.position)))
}

/** checks ใหม่ → เก่า · gsc = หน้าที่ดีสุดต่อวัน 10 วันล่าสุด (ไม่มีก็ได้) */
export function judgeRank(checks: RankCheck[], gscDays: GscDay[] = []): RankVerdict {
  const gsc = gscMedian(gscDays)
  const window = checks.slice(0, LOOKBACK)
  const base = { gsc, total: window.length }
  if (!window.length) return { ...base, rank: null, source: 'none', pattern: 'unchecked', found: 0, mainUrl: null, reason: 'ยังไม่เคยเช็ค' }

  // หน้าหลัก = หน้าที่ติดหน้าแรกบ่อยสุด (ไม่มีก็เอาหน้าที่เจอบ่อยสุด) · ประวัติที่นำเข้าไม่มี URL
  const count = new Map<string, number>()
  const tally = (onlyPage1: boolean) => {
    count.clear()
    for (const c of window) {
      const u = normUrl(c.url)
      if (u && c.position != null && c.position <= (onlyPage1 ? 10 : RANK_DEPTH)) count.set(u, (count.get(u) ?? 0) + 1)
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }
  const mainUrl = tally(true) ?? tally(false)

  // เจอ = ติด 30 อันดับ และเป็นหน้าหลัก (หรือไม่รู้ URL / หน้าอื่นที่ก็ติดหน้าแรก)
  // หน้าอื่นที่ลึกกว่าหน้าแรก ขณะที่หน้าหลักเคยติดหน้าแรก = Google ชุดอื่น → นับเป็นไม่เจอ
  const mainOnPage1 = window.some((c) => c.position != null && c.position <= 10 && (!c.url || normUrl(c.url) === mainUrl))
  const isHit = (c: RankCheck) => {
    if (c.position == null || c.position > RANK_DEPTH) return false
    const u = normUrl(c.url)
    if (!u || !mainUrl || u === mainUrl || c.position <= 10) return true
    return !mainOnPage1
  }
  const hits = window.filter(isHit).map((c) => c.position as number)
  let streak = 0
  while (streak < window.length && !isHit(window[streak])) streak++
  const otherSet = window.slice(0, streak).some((c) => c.position != null && c.position <= RANK_DEPTH)
  const found = hits.length

  // ไม่เจอติดกันถึงเกณฑ์ หรือยังไม่เคยเจอเลย → ถาม GSC ก่อนตัดสิน
  // (12 ต.ค. 69: คำใหม่เช็คครั้งเดียวไม่เจอ แต่ GSC เห็น #2 มีคนเห็น 632 ครั้ง — "ของไหว้พระพิฆเนศ" — เดิมขึ้นไม่ติด)
  if (streak >= MISS_CONFIRM || !found) {
    if (gsc != null && gsc <= RANK_DEPTH)
      return {
        ...base, rank: gsc, source: 'gsc', pattern: 'disputed', found, mainUrl,
        reason: `ระบบเช็ค${otherSet ? 'เจอแค่หน้าอื่นลึก ๆ' : 'ไม่เจอ'} ${streak} ครั้ง${streak > 1 ? 'ติด' : ''} แต่คนค้นจริง (GSC) เห็น ~#${gsc} — Google เสิร์ฟคนละชุด เชื่อฝั่งที่เจอ`,
      }
    if (streak < MISS_CONFIRM && !found)
      return { ...base, rank: null, source: 'none', pattern: 'none', found, mainUrl, reason: `ยังไม่เจอใน ${RANK_DEPTH} อันดับแรก (เช็ค ${window.length} ครั้ง · GSC ไม่มีคนเห็นพอ)` }
    return {
      ...base, rank: null, source: 'none', pattern: found ? 'gone' : 'none', found, mainUrl,
      reason: found
        ? `ไม่เจอ ${streak} ครั้งติด${gsc != null ? ` · GSC ก็ ~#${gsc}` : ' · GSC ไม่มีคนเห็น'} — หลุดจริง`
        : `ยังไม่เคยเจอใน ${RANK_DEPTH} อันดับแรก`,
    }
  }

  // ยังไม่ถึงเกณฑ์หลุด → อันดับ = ค่ากลางของครั้งที่เจอ (5 ครั้งล่าสุด ถ้าเจอ ≥ 2 · ไม่งั้นย้อน 10 ครั้ง)
  const recent = window.slice(0, DISPLAY_ROUNDS).filter(isHit).map((c) => c.position as number)
  const pool = recent.length >= Math.min(MIN_FOUND, window.length) ? recent : hits
  if (!pool.length)
    return { ...base, rank: null, source: 'none', pattern: 'none', found, mainUrl, reason: `ยังไม่เจอใน ${RANK_DEPTH} อันดับแรก (เช็ค ${window.length} ครั้ง)` }
  const rank = median(pool)
  const split = found < window.length
  return {
    ...base, rank, source: 'check', pattern: split ? 'split' : 'steady', found, mainUrl,
    reason: split
      ? `Google สลับชุด — เจอ ${found} จาก ${window.length} ครั้ง · อันดับ = ค่ากลางของครั้งที่เจอ${streak ? ` (ล่าสุดไม่เจอ ${streak} ครั้ง ยังไม่ถึง ${MISS_CONFIRM})` : ''}`
      : `เจอทุกครั้ง (${found} ครั้ง) · ค่ากลาง`,
  }
}

/** ก่อน/หลังรอบล่าสุด — ไว้คิดขึ้น/ลง และแจ้งเตือน (ใช้ GSC ชุดเดียวกัน) */
export function judgeMove(checks: RankCheck[], gscDays: GscDay[] = []) {
  const before = judgeRank(checks.slice(1), gscDays)
  const after = judgeRank(checks, gscDays)
  // ตัวเลขที่ได้จาก GSC ไม่ใช่ผลเช็คใหม่ — ไม่แจ้งขึ้น/ลงจากการสลับแหล่ง (หลุดจริงยังแจ้ง เพราะ after มาจากการเช็ค)
  const move = checks.length > 1 && after.source !== 'gsc' ? bigMove(before.rank, after.rank) : null
  return { before, after, move }
}

/** แถว GSC (หลายหน้าต่อวัน) → หน้าที่ดีสุดต่อวัน */
export function gscBestPerDay(rows: { date: string; position: number; impressions: number }[]): GscDay[] {
  const best = new Map<string, GscDay>()
  for (const r of rows) {
    const cur = best.get(r.date)
    if (!cur || r.position < cur.position) best.set(r.date, { date: r.date, position: r.position, impressions: r.impressions })
  }
  return [...best.values()]
}
