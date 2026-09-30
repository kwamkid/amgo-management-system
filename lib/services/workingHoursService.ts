// lib/services/workingHoursService.ts

// import type ล้วน ๆ เพื่อให้ node รัน .ts ตรง ๆ ได้ (เทสต์เรียกไฟล์นี้)
// — type-stripping ตัดบรรทัดพวกนี้ทิ้ง ไม่ต้องแปล path alias '@/'
import type { CheckInRecord } from '@/types/checkin'
import { differenceInMinutes } from 'date-fns'

/* ── นาฬิกาไทยที่ไม่อิงเขตเวลาของเครื่องที่รัน ───────────────────────
 * บั๊กที่เจอ 30 ก.ย. 69: cron ปิดกะคนที่ลืมเช็คเอาท์ "ที่เวลาเลิกงาน 17:30"
 * ด้วย setHours() ซึ่งอิงเขตเวลาของเครื่อง — มือถือพนักงานเป็นเวลาไทยจึงถูก
 * แต่ cron รันบน Vercel ที่เป็น UTC ได้ 17:30 UTC = 00:30 เวลาไทยของวันรุ่งขึ้น
 * ใบของ 7 คนจึงโชว์ว่าเลิกงานหลังเที่ยงคืนทุกคืน (จำนวนชั่วโมงยังถูกเพราะ
 * เพดาน 8 ชม. แต่เวลาในรายงาน ประวัติ และ checkin_edits ผิดไป 7 ชั่วโมง)
 *
 * ไฟล์นี้ถูกเรียกทั้งจากมือถือและจาก cron — ต้องคิดเป็นเวลาไทยเสมอ
 * ไทยไม่มี DST ออฟเซ็ตจึงคงที่ +07:00 ตลอด ไม่ต้องพึ่งตารางเขตเวลา
 */
const BKK_OFFSET_MS = 7 * 3_600_000
const DAY_MS = 86_400_000

/** ชิ้นส่วนนาฬิกาไทยของช่วงเวลานี้ */
function bkkClock(d: Date) {
  const t = new Date(d.getTime() + BKK_OFFSET_MS)
  return {
    y: t.getUTCFullYear(),
    mo: t.getUTCMonth(),
    d: t.getUTCDate(),
    dow: t.getUTCDay(),
  }
}

/** วันเดียวกับ ref (ตามปฏิทินไทย) แต่เป็นเวลาไทย hh:mm */
function atBkkTime(ref: Date, hour: number, minute: number): Date {
  const c = bkkClock(ref)
  return new Date(Date.UTC(c.y, c.mo, c.d, hour, minute) - BKK_OFFSET_MS)
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS)
}

/** วันตามปฏิทินไทย 'YYYY-MM-DD' — ใช้เทียบว่าข้ามวันแล้วหรือยัง */
export function bangkokDayKey(d: Date): string {
  const c = bkkClock(d)
  return `${c.y}-${String(c.mo + 1).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`
}

/** เที่ยงคืนของวันนั้นตามเวลาไทย */
export function bangkokStartOfDay(d: Date): Date {
  return atBkkTime(d, 0, 0)
}

/** วันเดียวกันตามปฏิทินไทยไหม (แทน isSameDay ที่อิงเขตเวลาเครื่อง) */
function sameBkkDay(a: Date, b: Date): boolean {
  return bangkokDayKey(a) === bangkokDayKey(b)
}

interface WorkingHoursCalculation {
  regularHours: number      // Max 8 hours per day
  overtimeHours: number     // Hours beyond 8
  totalHours: number        // Total hours worked
  breakHours: number        // Break time deducted
  isLate: boolean
  lateMinutes: number
  isEarlyCheckout: boolean
  isOvernightShift: boolean
}

/**
 * Calculate working hours between check-in and check-out
 */
/** ระยะเมตรระหว่างพิกัด (haversine) — ใช้เช็คว่าเช็คเอาท์ไกลจากสาขาไหม */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(a)))
}

/**
 * เวลาเลิกงานปกติของการเช็คอินครั้งนี้ — ใช้เป็นเพดานตัดชั่วโมง
 * (เช็คเอาท์นอกพื้นที่ / ลืมเช็คเอาท์ — เจ้าของสั่ง 14 ส.ค. 69: ตัดก่อนถึง OT)
 * มีกะ = เวลาจบกะ · ไม่มีกะ = เวลาเข้า + งานมาตรฐาน 8 ชม. + พัก
 */
export function normalEndTime(
  checkinTime: Date,
  shiftEndTime?: string | null,
  breakHours: number = 1,
  shiftStartTime?: string | null
): Date {
  if (shiftEndTime) {
    const [h, m] = shiftEndTime.split(':').map(Number)
    const end = atBkkTime(checkinTime, h, m)
    // เวลาเลิกงานอยู่ "วันถัดไป" เฉพาะกะข้ามคืนแท้ (จบกะ < เริ่มกะ)
    //
    // ของเดิมเลื่อนทุกครั้งที่ end < checkin — กะกลางวันที่เช็คอิน *หลัง* เลิกงาน
    // (มาร์ค 3 ก.ย. 69: เข้า 18:15 กะ 09:00–18:00) เลยกลายเป็นกะ 24 ชม. ระบบไม่มอง
    // ว่าลืมเช็คเอาท์ แล้วชั่วโมงติดลบจนฐานข้อมูลปฏิเสธ เช็คเอาท์ไม่ได้เลย
    // ไม่รู้เวลาเริ่มกะ = คงพฤติกรรมเดิม
    const overnight = shiftStartTime ? shiftEndTime < shiftStartTime : end < checkinTime
    return overnight && end < checkinTime ? addDays(end, 1) : end
  }
  return new Date(checkinTime.getTime() + (8 + breakHours) * 3600_000)
}

/**
 * เวลาที่ cron ปิดกะให้คนที่ลืมเช็คเอาท์ — null = ยังไม่ถึงเวลาปิด ข้ามไว้รอบหน้า
 * (แยกจาก autoCheckoutService เพื่อให้เทสต์ยิงตรงได้โดยไม่แตะฐานข้อมูล)
 *
 * · ปกติ = เวลาเลิกงานปกติ (normalEndTime) ไม่มี OT
 * · ไม่มีกะแล้วเข้าดึก (20:00 + 9 ชม. = ตี 5 พรุ่งนี้) → ไม่เกิน 23:59 ของ
 *   วันที่เช็คอิน เพราะเส้นแบ่งของ "ลืม" คือข้ามวัน
 * · กะข้ามคืนแท้ (จบกะ < เริ่มกะ) ที่เวลาเลิกงานยังมาไม่ถึง → null
 * · เช็คอินหลังเวลาเลิกงาน → ออกหลังเข้า 1 นาที (constraint) ชั่วโมงเป็น 0
 */
export function autoCheckoutTime(
  checkinTime: Date,
  shiftStartTime: string | null | undefined,
  shiftEndTime: string | null | undefined,
  breakHours: number,
  now: Date
): Date | null {
  let end = normalEndTime(checkinTime, shiftEndTime, breakHours, shiftStartTime)
  const overnightShift = !!(shiftStartTime && shiftEndTime && shiftEndTime < shiftStartTime)

  if (overnightShift) {
    if (end > now) return null
  } else {
    const checkinDayEnd = new Date(bangkokStartOfDay(checkinTime).getTime() + DAY_MS - 60_000)
    if (end > checkinDayEnd) end = checkinDayEnd
  }

  return end <= checkinTime ? new Date(checkinTime.getTime() + 60_000) : end
}

/**
 * เข้าข่าย "ลืมเช็คเอาท์" ไหม — เส้นแบ่งคือ **มากดปิดกะข้ามวัน**
 * (เจ้าของเลือก 15 ส.ค. 69 หลังเจอใบที่ลืมแล้วได้ 14.87 ชม. + OT 6.87)
 *
 * ทำไมต้องเป็น "ข้ามวัน" ไม่ใช่ "เกิน N ชั่วโมง": โอทีจริงของ PC หน้าร้าน
 * จบในวันเดียวกันเสมอ (ห้างปิด 22:00 เข้า 09:43 ออก 22:03 = 12.3 ชม. + OT 3.27
 * เจ้าของยืนยันว่าถูก) เกณฑ์นับชั่วโมงจะไปกินโอทีก้อนนั้น
 *
 * กะข้ามคืนแท้ (จบกะ < เริ่มกะ) ข้ามเที่ยงคืนเป็นปกติ — นับว่าลืมต่อเมื่อ
 * ปิดกะเลยวันที่ควรจบกะไปอีกวัน
 */
export function isForgotCheckout(
  checkinTime: Date,
  checkoutTime: Date,
  shiftStartTime?: string | null,
  shiftEndTime?: string | null,
  breakHours: number = 1
): boolean {
  const normalEnd = normalEndTime(checkinTime, shiftEndTime, breakHours, shiftStartTime)
  if (checkoutTime <= normalEnd) return false
  if (sameBkkDay(checkinTime, checkoutTime)) return false

  const overnightShift = !!(shiftStartTime && shiftEndTime && shiftEndTime < shiftStartTime)
  return !(overnightShift && sameBkkDay(normalEnd, checkoutTime))
}

export function calculateWorkingHours(
  checkinTime: Date,
  checkoutTime: Date,
  location: {
    workingHours: any
    breakHours: number
  },
  shift?: {
    startTime: string
    endTime: string
    graceMinutes: number
  },
  isApprovedOvertime: boolean = false
): WorkingHoursCalculation {
  // Get location closing time for the day
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayName = dayNames[bkkClock(checkinTime).dow]
  const dailyHours = location.workingHours[dayName]

  // Calculate actual checkout time (capped at closing time unless approved)
  let effectiveCheckoutTime = new Date(checkoutTime)

  if (!isApprovedOvertime && dailyHours && !dailyHours.isClosed) {
    const [closeHour, closeMin] = dailyHours.close.split(':').map(Number)
    let closingTime = atBkkTime(checkinTime, closeHour, closeMin)

    // Handle overnight closing time
    if (dailyHours.close < dailyHours.open) {
      closingTime = addDays(closingTime, 1)
    }
    
    // Cap checkout time at closing time if not approved
    if (checkoutTime > closingTime) {
      effectiveCheckoutTime = closingTime
    }
  }
  
  // Calculate total minutes worked
  // ห้ามติดลบ — เช็คอินหลังเวลาปิดร้าน (เพดานตัดก่อนเวลาเข้า) ต้องได้ 0 ไม่ใช่ค่าลบ
  // ที่ฐานข้อมูลปฏิเสธ (hours_not_negative — มาร์ค 3 ก.ย. 69)
  const totalMinutes = Math.max(0, differenceInMinutes(effectiveCheckoutTime, checkinTime))
  
  // Check if overnight shift (spans across midnight)
  const isOvernightShift = !sameBkkDay(checkinTime, effectiveCheckoutTime)
  
  // Calculate late status if shift info provided
  let isLate = false
  let lateMinutes = 0
  let isEarlyCheckout = false
  
  if (shift) {
    const [shiftStartHour, shiftStartMin] = shift.startTime.split(':').map(Number)
    const shiftStartTime = atBkkTime(checkinTime, shiftStartHour, shiftStartMin)
    
    // Calculate late minutes (considering grace period)
    const minutesAfterShiftStart = differenceInMinutes(checkinTime, shiftStartTime)
    if (minutesAfterShiftStart > shift.graceMinutes) {
      isLate = true
      lateMinutes = minutesAfterShiftStart - shift.graceMinutes
    }
    
    // Check early checkout
    const [shiftEndHour, shiftEndMin] = shift.endTime.split(':').map(Number)
    let shiftEndTime = atBkkTime(checkoutTime, shiftEndHour, shiftEndMin)

    // Handle overnight shift end time
    if (shift.endTime < shift.startTime) {
      shiftEndTime = addDays(shiftEndTime, 1)
    }
    
    const minutesBeforeShiftEnd = differenceInMinutes(shiftEndTime, effectiveCheckoutTime)
    if (minutesBeforeShiftEnd > shift.graceMinutes) {
      isEarlyCheckout = true
    }
  }
  
  // Convert to hours
  let totalHours = totalMinutes / 60
  
  // Deduct break time if worked more than 4 hours
  // (หักรอบเดียวตาม breakHours ของสาขา — เจ้าของยืนยัน 14 ส.ค. 69 ว่าถูกแล้ว:
  //  ห้าง 10:00–22:00 = 12 ชม. หักพัก 1 เหลือ 11 → โอที 3)
  let appliedBreakHours = 0
  if (totalHours > 4) {
    appliedBreakHours = Math.min(location.breakHours, totalHours - 4)
    totalHours = totalHours - appliedBreakHours
  }
  
  // Calculate regular and overtime hours
  const regularHours = Math.min(totalHours, 8)
  const overtimeHours = Math.max(0, totalHours - 8)
  
  return {
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    breakHours: appliedBreakHours,
    isLate,
    lateMinutes,
    isEarlyCheckout,
    isOvernightShift
  }
}

/**
 * Check if employee is currently working overtime
 */
export function isWorkingOvertime(checkinTime: Date, now: Date = new Date()): boolean {
  const hoursWorked = differenceInMinutes(now, checkinTime) / 60
  return hoursWorked > 8
}

/**
 * Get overtime alert thresholds that have been passed
 */
export function getOvertimeAlerts(checkinTime: Date, now: Date = new Date()): {
  hours8: boolean
  hours10: boolean
  hours12: boolean
  isOvernight: boolean
} {
  const hoursWorked = differenceInMinutes(now, checkinTime) / 60
  const isOvernight = !sameBkkDay(checkinTime, now)
  
  return {
    hours8: hoursWorked >= 8,
    hours10: hoursWorked >= 10,
    hours12: hoursWorked >= 12,
    isOvernight
  }
}

/**
 * Calculate expected checkout time based on shift
 */
export function getExpectedCheckoutTime(
  checkinTime: Date,
  shift: {
    startTime: string
    endTime: string
  }
): Date {
  const [endHour, endMin] = shift.endTime.split(':').map(Number)
  const checkoutTime = atBkkTime(checkinTime, endHour, endMin)

  // Handle overnight shift
  return shift.endTime < shift.startTime ? addDays(checkoutTime, 1) : checkoutTime
}

/**
 * Get checkout reminder times based on expected checkout
 */
export function getCheckoutReminderTimes(expectedCheckoutTime: Date): {
  before15min: Date
  onTime: Date
  after30min: Date
  after1hour: Date
  after2hours: Date
} {
  return {
    before15min: new Date(expectedCheckoutTime.getTime() - 15 * 60 * 1000),
    onTime: expectedCheckoutTime,
    after30min: new Date(expectedCheckoutTime.getTime() + 30 * 60 * 1000),
    after1hour: new Date(expectedCheckoutTime.getTime() + 60 * 60 * 1000),
    after2hours: new Date(expectedCheckoutTime.getTime() + 120 * 60 * 1000)
  }
}

/**
 * Determine which reminders should be sent
 */
export function getPendingReminders(
  expectedCheckoutTime: Date,
  remindersSent: CheckInRecord['checkoutReminder'] = {},
  now: Date = new Date()
): string[] {
  const reminders = getCheckoutReminderTimes(expectedCheckoutTime)
  const pending: string[] = []
  
  if (now >= reminders.before15min && !remindersSent?.sent15min) {
    pending.push('15min')
  }
  
  if (now >= reminders.after30min && !remindersSent?.sent30min) {
    pending.push('30min')
  }
  
  if (now >= reminders.after1hour && !remindersSent?.sent1hour) {
    pending.push('1hour')
  }
  
  if (now >= reminders.after2hours && !remindersSent?.sent2hour) {
    pending.push('2hours')
  }
  
  return pending
}

/**
 * Format working hours for display
 */
export function formatWorkingHours(hours: number): string {
  const wholeHours = Math.floor(hours)
  const minutes = Math.round((hours - wholeHours) * 60)
  
  if (minutes === 0) {
    return `${wholeHours} ชั่วโมง`
  }
  
  return `${wholeHours} ชั่วโมง ${minutes} นาที`
}

/**
 * Check if should create pending checkout
 */
export function shouldCreatePendingCheckout(
  checkinTime: Date,
  maxHoursBeforePending: number = 12,
  now: Date = new Date()
): boolean {
  const hoursWorked = differenceInMinutes(now, checkinTime) / 60
  return hoursWorked >= maxHoursBeforePending
}

/**
 * Calculate trust score for auto-approval
 * Based on employee's checkout history
 */
export async function calculateTrustScore(
  userId: string,
  recentRecords: CheckInRecord[]
): Promise<number> {
  // Simple trust score calculation
  // Can be enhanced with more factors
  
  const totalRecords = recentRecords.length
  if (totalRecords < 10) return 0 // Not enough history
  
  const forgotCheckouts = recentRecords.filter(r => r.forgotCheckout).length
  const manualCheckouts = recentRecords.filter(r => r.manualCheckout).length
  const lateCheckins = recentRecords.filter(r => r.isLate).length
  
  // Calculate score (0-100)
  let score = 100
  score -= (forgotCheckouts / totalRecords) * 50
  score -= (manualCheckouts / totalRecords) * 30
  score -= (lateCheckins / totalRecords) * 20
  
  return Math.max(0, Math.round(score))
}

/**
 * Check if employee needs overtime approval
 * (Worked past closing time by more than 1 hour)
 */
export function needsOvertimeApproval(
  checkoutTime: Date,
  location: {
    workingHours: any
  },
  checkinTime: Date
): boolean {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayName = dayNames[bkkClock(checkinTime).dow]
  const dailyHours = location.workingHours[dayName]

  if (!dailyHours || dailyHours.isClosed) return false

  const [closeHour, closeMin] = dailyHours.close.split(':').map(Number)
  let closingTime = atBkkTime(checkinTime, closeHour, closeMin)

  // Handle overnight closing time
  if (dailyHours.close < dailyHours.open) {
    closingTime = addDays(closingTime, 1)
  }
  
  // Check if worked more than 1 hour past closing
  const minutesPastClosing = differenceInMinutes(checkoutTime, closingTime)
  return minutesPastClosing > 60
}

/**
 * Get actual hours for pending approval
 * Shows both approved hours and actual hours
 */
export function getPendingOvertimeInfo(
  checkinTime: Date,
  checkoutTime: Date,
  location: {
    workingHours: any
    breakHours: number
  }
): {
  approvedHours: number
  actualHours: number
  overtimeHours: number
  reason: string
} {
  // Calculate hours up to closing time
  const approvedCalc = calculateWorkingHours(
    checkinTime,
    checkoutTime,
    location,
    undefined,
    false // Not approved
  )
  
  // Calculate actual hours worked
  const actualCalc = calculateWorkingHours(
    checkinTime,
    checkoutTime,
    location,
    undefined,
    true // If approved
  )
  
  const overtimeHours = actualCalc.totalHours - approvedCalc.totalHours
  
  let reason = ''
  if (overtimeHours > 3) {
    reason = 'Midnight Sale / Renovate'
  } else if (overtimeHours > 2) {
    reason = 'ปิดร้านล่าช้า'
  } else {
    reason = 'ทำงานเกินเวลา'
  }
  
  return {
    approvedHours: approvedCalc.totalHours,
    actualHours: actualCalc.totalHours,
    overtimeHours,
    reason
  }
}