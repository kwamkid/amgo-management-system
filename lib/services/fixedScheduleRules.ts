// lib/services/fixedScheduleRules.ts
//
// เวลางานของคน "ไม่มีกะ" — job_functions.schedule_type = 'fixed' (ทุกตำแหน่งยกเว้น PC หน้าร้าน)
//
// เจ้าของตัดสิน 7 ก.ย. 69: "ไม่มีกะ ให้นับเวลาปกติ คือ 8.30/9.00 – 17.30/18.00"
// อ่านเป็นช่วงเข้างานยืดหยุ่น: มาถึง 08:30 เลิก 17:30 · มาถึง 09:00 เลิก 18:00
// (อยู่ที่ทำงาน 9 ชม. = ทำงาน 8 + พัก 1) สาย = มาหลัง 09:00 เกินผ่อนผัน 15 นาที
// (เท่ากะสาขา) ใช้เหมือนกันไม่ว่าจะเช็คอินที่สาขา / นอกสถานที่ / WFH
//
// ทำไมเลิกใช้กะของสาขา: กะสาขาคือกะห้างของ PC (10:00 / 13:00) หรือกะคลังที่ตั้งเพี้ยน
// (ตลาดไท 03:00–13:00 · คลังหลัก "กะที่ 2" 05:00–22:00) พนักงานออฟฟิศ/คลังเลยติดสาย
// 42% ของการเช็คอิน 30 วัน (151/356) ทั้งที่มาตามเวลา ส่วนคน WFH/นอกสถานที่
// ไม่เคยถูกนับสายเลย (ไม่มีกะให้เทียบ)
//
// กะเสมือนนี้เก็บลงแถว checkins ในช่อง shift_name / shift_start_time / shift_end_time
// เหมือนกะจริง (shift_id = null) เพื่อให้เช็คเอาท์ · cron ปิดกะ 23:59 · กติกาลืมเช็คเอาท์ ·
// รายงาน ใช้ทางเดิมทั้งหมดโดยไม่ต้องรู้ว่าเป็นกะเสมือน
//
// เทสต์: node scripts/test-fixed-schedule.mjs (ฟังก์ชันล้วน ไม่แตะฐานข้อมูล)

export const FIXED_SCHEDULE = {
  /** ชื่อที่โชว์แทนชื่อกะ */
  name: 'เวลาปกติ',
  /** มาถึงก่อนหรือตรงเส้นแบ่ง = รอบเช้า 08:30–17:30 */
  earlyStart: '08:30',
  earlyEnd: '17:30',
  /**
   * เส้นแบ่งรอบ (นาทีนับจากเที่ยงคืน) = 08:45 = 08:30 + ผ่อนผัน 15 นาที
   * ตั้งให้เท่าผ่อนผันพอดี คนที่เข้ารอบเช้าจึงไม่มีทางติดสายเพราะรอบเช้า
   */
  earlyCutoffMinutes: 8 * 60 + 45,
  /** มาถึงหลังเส้นแบ่ง = รอบ 09:00–18:00 — สายเมื่อเลย 09:15 */
  lateStart: '09:00',
  lateEnd: '18:00',
  graceMinutes: 15,
} as const

export interface FixedShift {
  name: string
  startTime: string
  endTime: string
  graceMinutes: number
}

/** กะเสมือนของคนไม่มีกะ ตามเวลาที่กดเช็คอิน (นาฬิกาเครื่องผู้ใช้ = เวลาไทย) */
export function fixedScheduleShift(checkinTime: Date): FixedShift {
  const minutes = checkinTime.getHours() * 60 + checkinTime.getMinutes()
  const early = minutes <= FIXED_SCHEDULE.earlyCutoffMinutes
  return {
    name: FIXED_SCHEDULE.name,
    startTime: early ? FIXED_SCHEDULE.earlyStart : FIXED_SCHEDULE.lateStart,
    endTime: early ? FIXED_SCHEDULE.earlyEnd : FIXED_SCHEDULE.lateEnd,
    graceMinutes: FIXED_SCHEDULE.graceMinutes,
  }
}

/**
 * ตำแหน่งนี้เลือกกะของสาขาตอนเช็คอินไหม — มีแค่ PC หน้าร้าน (schedule_type = 'rotating')
 * ไม่มีตำแหน่ง (บัญชีแอดมินระบบ) = ไม่มีกะ ใช้เวลาปกติเหมือนพนักงานออฟฟิศ
 */
export function usesLocationShifts(scheduleType?: string | null): boolean {
  return scheduleType === 'rotating'
}
