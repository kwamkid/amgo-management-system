// lib/services/leave/rules.ts
//
// กติกาการลาล้วน ๆ — ไม่แตะฐานข้อมูล ไม่แตะเบราว์เซอร์
// แยกออกมาเพราะฟอร์มยื่นลาต้องเรียกตอนพิมพ์ทุกตัวอักษร ไม่ควรลาก client มาด้วย

import { LEAVE_RULES, type LeaveType, type CarryOverRule } from '@/types/leave'

export { LEAVE_RULES }

/**
 * นับจำนวนวันลา — นับทุกวันที่เลือก รวมเสาร์อาทิตย์
 *
 * ตั้งใจไม่ตัดวันหยุด เพราะหลายสาขาเปิด 7 วันและพนักงานทำงานเสาร์อาทิตย์จริง
 * (ดู coverage_days_per_week ใน business_units)
 */
export function calculateLeaveDays(startDate: Date, endDate: Date): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / 86_400_000)
  return diffDays + 1 // ลา 1-3 = 3 วัน ไม่ใช่ 2
}

/**
 * ตรวจใบลาก่อนส่ง
 *
 * แจ้งช้ากว่ากำหนดไม่ได้ห้าม แต่จะโดนหักโควต้าเป็นเท่า (urgentMultiplier)
 * จึงคืนเป็น warning ไม่ใช่ error
 */
export function validateLeaveRequest(
  type: LeaveType,
  startDate: Date,
  isUrgent: boolean
): { valid: boolean; message?: string; warning?: string } {
  const rules = LEAVE_RULES[type]

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  if (!rules.allowBackdate && start < today) {
    return { valid: false, message: 'ไม่สามารถลาย้อนหลังได้สำหรับประเภทนี้' }
  }

  if (!isUrgent && rules.advanceNotice > 0) {
    const daysAhead = Math.floor((start.getTime() - today.getTime()) / 86_400_000)
    if (daysAhead < rules.advanceNotice) {
      return {
        valid: true,
        warning:
          `การลา${type === 'personal' ? 'กิจ' : 'พักร้อน'} ควรแจ้งล่วงหน้า ${rules.advanceNotice} วัน ` +
          `หากดำเนินการต่อจะถูกหักโควต้า ${rules.urgentMultiplier} เท่า`,
      }
    }
  }

  return { valid: true }
}

/** จำนวนวันที่ยกยอดได้ตามกติกาที่ตั้งไว้ */
export function carryOverDaysFor(remaining: number, rule: CarryOverRule): number {
  if (!rule.enabled || remaining <= 0) return 0

  const byPercentage = Math.floor(remaining * (rule.percentage / 100))
  return rule.maxDays !== null ? Math.min(byPercentage, rule.maxDays) : byPercentage
}
