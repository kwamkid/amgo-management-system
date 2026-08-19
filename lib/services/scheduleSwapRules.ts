// lib/services/scheduleSwapRules.ts
//
// กติกาตรวจใบสลับวันหยุด — แยกจาก service เพราะไม่แตะฐานข้อมูลเลย
// เทสต์ (scripts/test-schedule-swap.mjs) จึงยิงเข้าฟังก์ชันนี้ตรง ๆ ได้
// โดยไม่ต้องมี env และไม่ทิ้งข้อมูลบนของจริง

import { format } from 'date-fns'
import { cycleWindow, periodOf, isCutoffPassed, type CycleCode } from './payrollCycle.ts'

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')
const dm = (d: Date) => format(d, 'd/M')

export interface SwapCheckInput {
  cycle: CycleCode
  /** วันหยุดประจำที่ขอมาทำงาน */
  workedDate: Date
  /** วันทำงานปกติที่ขอไปหยุดแทน */
  offDate: Date
  /** โหมดที่ตารางบอกว่าวันนั้นควรเป็นอะไร — จาก expected_work_mode() · undefined = ไม่ตรวจ */
  workedDateMode?: string | null
  offDateMode?: string | null
  now?: Date
}

/** เดือนของงวดที่จบวันนี้ — cycleWindow(cycle, เดือนนั้น).to ต้องตรงกับ periodEnd */
function monthOfPeriod(cycle: CycleCode, periodEnd: Date): Date {
  for (const offset of [0, 1, -1]) {
    const m = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + offset, 1)
    if (cycleWindow(cycle, m).to.getTime() === periodEnd.getTime()) return m
  }
  return new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1)
}

/**
 * ตรวจใบสลับวันหยุด — คืนข้อความปัญหา · null = ผ่าน
 *
 * กติกาเจ้าของ 16 ส.ค. 69:
 *   · ต้องระบุทั้งสองวันตอนยื่น (ไม่มีเครดิตค้าง) — บังคับที่ชนิดข้อมูล
 *   · วันที่ขอมาทำงานต้องเป็นวันหยุดของเขาจริง
 *   · วันที่ขอไปหยุดต้องเป็นวันทำงาน ไม่งั้นได้หยุดฟรีเพิ่มหนึ่งวัน
 *   · ทั้งคู่ต้องอยู่งวดจ่ายเดียวกัน และงวดนั้นต้องยังไม่ตัดยอด
 */
export function checkSwap(input: SwapCheckInput): string | null {
  const { cycle, workedDate, offDate, workedDateMode, offDateMode } = input
  const now = input.now ?? new Date()

  if (ymd(workedDate) === ymd(offDate)) {
    return 'วันที่มาทำงานกับวันที่ไปหยุดต้องเป็นคนละวัน'
  }

  if (workedDateMode != null && workedDateMode !== 'off') {
    return `วันที่ ${dm(workedDate)} เป็นวันทำงานปกติอยู่แล้ว ไม่ต้องยื่นสลับ`
  }

  if (offDateMode === 'off') {
    return `วันที่ ${dm(offDate)} เป็นวันหยุดของคุณอยู่แล้ว เลือกวันทำงานเป็นวันหยุดชดเชย`
  }

  const pWorked = periodOf(cycle, workedDate)
  const pOff = periodOf(cycle, offDate)
  if (pWorked.to.getTime() !== pOff.to.getTime()) {
    return (
      `ต้องหยุดชดเชยภายในงวดเดียวกัน — วันที่ ${dm(workedDate)} อยู่งวด ` +
      `${dm(pWorked.from)}–${dm(pWorked.to)} แต่วันที่ ${dm(offDate)} อยู่งวด ` +
      `${dm(pOff.from)}–${dm(pOff.to)}`
    )
  }

  // งวดที่ตัดยอดไปแล้วแก้ไม่ได้ — วันมา/ขาดถูกตรึงเข้าเงินเดือนไปเรียบร้อย
  if (isCutoffPassed(cycle, monthOfPeriod(cycle, pWorked.to), now)) {
    return `งวดนี้ตัดยอดไปแล้ว (ตัดวันที่ ${dm(pWorked.to)}) แก้ไม่ได้ — แจ้ง HR แทน`
  }

  return null
}
