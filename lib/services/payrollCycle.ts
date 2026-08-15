// lib/services/payrollCycle.ts
//
// ช่วงงานของแต่ละรอบจ่ายเงินเดือน — "ตัดยอดก่อนวันจ่าย เอาไว้ทำ report"
// (เจ้าของอธิบายกติกา 15 ส.ค. 69)
//
//   รอบ   นับงานช่วง                  ตัดยอด          เงินออก
//   ────────────────────────────────────────────────────────────────
//   c28   26 เดือนก่อน – 25 เดือนนี้   25 เดือนนี้      28 เดือนนี้
//   c4    1 – สิ้นเดือนนี้             สิ้นเดือนนี้      4 เดือนถัดไป
//   c30   28 เดือนก่อน – 27 เดือนนี้   27 เดือนนี้      30 เดือนนี้   (ยังไม่มีใครใช้)
//   eom   ต่อจากงวดก่อน               ก่อนสิ้นเดือน 3 วัน  สิ้นเดือนนี้  (ยังไม่มีใครใช้)
//
// **เดือนของงวด = เดือนที่ทำงาน ไม่ใช่เดือนที่เงินออก** (เจ้าของยืนยัน 16 ส.ค. 69:
// "งวดที่จ่ายไป 4 ส.ค. มันคืองวด ก.ค.") — งวดสิงหาคมของรอบ c4 จึงคืองาน
// 1–31 ส.ค. ที่จะได้เงินวันที่ 4 ก.ย. ส่วนรอบ c28 เงินออกในเดือนเดียวกับป้ายงวด
//
// ── ต่างจากของเดิมตรงไหน ──────────────────────────────────────────────
// เดิม loadPayroll/loadAttendanceDays/loadOtHours ฮาร์ดโค้ด "วันที่ 1 ถึง
// สิ้นเดือน" เหมือนกันหมดทุกคน ไม่สนรอบจ่าย — คน c28 จึงถูกนับงานถึงสิ้นเดือน
// ทั้งที่ตัดยอดไปแล้วตั้งแต่วันที่ 25

export type CycleCode = 'c28' | 'c4' | 'c30' | 'eom'

/** ไม่ได้ตั้งรอบไว้ = ใช้รอบที่คนส่วนใหญ่ใช้ */
export const DEFAULT_CYCLE: CycleCode = 'c28'

export const CYCLE_LABELS: Record<CycleCode, string> = {
  c28: 'จ่ายวันที่ 28',
  c4: 'จ่ายวันที่ 4',
  c30: 'จ่ายวันที่ 30',
  eom: 'จ่ายสิ้นเดือน',
}

/** รอบของคนนี้ — ตั้งรายคนชนะ ไม่ตั้งก็ตามตำแหน่ง ไม่มีทั้งคู่ใช้ค่าปริยาย */
export function resolveCycle(
  userCycle?: string | null,
  jobFunctionCycle?: string | null
): CycleCode {
  const c = userCycle || jobFunctionCycle
  return c === 'c28' || c === 'c4' || c === 'c30' || c === 'eom' ? c : DEFAULT_CYCLE
}

const lastDayOfMonth = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0)

/** วันที่ n ของเดือนนั้น — เดือนสั้นกว่าก็ถอยมาวันสุดท้าย (30 ก.พ. ไม่มีจริง) */
function dayOfMonth(year: number, monthIndex: number, day: number): Date {
  const last = lastDayOfMonth(year, monthIndex).getDate()
  return new Date(year, monthIndex, Math.min(day, last))
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** วันที่เงินออกของงวดนี้ */
export function payDate(cycle: CycleCode, month: Date): Date {
  const y = month.getFullYear()
  const m = month.getMonth()
  switch (cycle) {
    case 'c28':
      return dayOfMonth(y, m, 28)
    case 'c4':
      // ตัดสิ้นเดือนแล้วจ่ายต้นเดือนถัดไป — เงินออกคนละเดือนกับป้ายงวด
      return dayOfMonth(y, m + 1, 4)
    case 'c30':
      return dayOfMonth(y, m, 30)
    case 'eom':
      return lastDayOfMonth(y, m)
  }
}

/**
 * วันสุดท้ายที่นับงานเข้างวดนี้ — งานหลังจากวันนี้ไปตกงวดถัดไป
 * เว้นระยะจากวันจ่ายไว้ให้ HR ทำ report ทัน
 */
export function cutoffDate(cycle: CycleCode, month: Date): Date {
  const y = month.getFullYear()
  const m = month.getMonth()
  switch (cycle) {
    case 'c28':
      return dayOfMonth(y, m, 25)
    case 'c4':
      // ทำงานเต็มเดือน ตัดสิ้นเดือน แล้วมีเวลาทำ report 4 วันก่อนจ่าย
      return lastDayOfMonth(y, m)
    case 'c30':
      return dayOfMonth(y, m, 27)
    case 'eom':
      return addDays(lastDayOfMonth(y, m), -3)
  }
}

export interface CycleWindow {
  cycle: CycleCode
  /** วันแรกที่นับงานเข้างวดนี้ (ถัดจากวันตัดยอดของงวดก่อน) */
  from: Date
  /** วันสุดท้ายที่นับงานเข้างวดนี้ = วันตัดยอด */
  to: Date
  payDate: Date
}

/**
 * ช่วงงานของงวด — ต่อจากวันตัดยอดของงวดก่อนหน้าเสมอ จึงไม่มีวันไหนตกหล่น
 * หรือถูกนับซ้ำสองงวด ไม่ว่าจะรอบไหน
 */
export function cycleWindow(cycle: CycleCode, month: Date): CycleWindow {
  const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1)
  return {
    cycle,
    from: addDays(cutoffDate(cycle, prevMonth), 1),
    to: cutoffDate(cycle, month),
    payDate: payDate(cycle, month),
  }
}

/** ถึงวันตัดยอดของงวดนี้หรือยัง (ใช้ล็อกไม่ให้บันทึกงวดที่ยังไม่ปิด) */
export function isCutoffPassed(cycle: CycleCode, month: Date, now: Date = new Date()): boolean {
  const cutoff = cutoffDate(cycle, month)
  // นับทั้งวันของวันตัดยอด — ตัดยอดตอนสิ้นวันที่ 25 ไม่ใช่เที่ยงคืนที่เข้าวันที่ 25
  return now >= addDays(cutoff, 1)
}

/** งวด (เดือนที่เงินออก) ที่ตัดยอดพอดีในวันนี้ — ไม่มี = null · ใช้ในงาน cron */
export function cycleCutoffToday(cycle: CycleCode, today: Date): Date | null {
  // วันตัดยอดของงวดเดือนนี้และเดือนหน้า พอครอบทุกรอบ (c4 ตัดข้ามเดือน)
  for (const offset of [0, 1]) {
    const month = new Date(today.getFullYear(), today.getMonth() + offset, 1)
    const cutoff = cutoffDate(cycle, month)
    if (
      cutoff.getFullYear() === today.getFullYear() &&
      cutoff.getMonth() === today.getMonth() &&
      cutoff.getDate() === today.getDate()
    ) {
      return month
    }
  }
  return null
}
