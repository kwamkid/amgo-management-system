// lib/services/workingHoursService.ts

import { CheckInRecord } from '@/types/checkin'
import { Shift, Location } from '@/types/location'
import { differenceInMinutes, format, isSameDay, startOfDay, endOfDay } from 'date-fns'

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
  const dayName = dayNames[checkinTime.getDay()]
  const dailyHours = location.workingHours[dayName]
  
  // Calculate actual checkout time (capped at closing time unless approved)
  let effectiveCheckoutTime = new Date(checkoutTime)
  
  if (!isApprovedOvertime && dailyHours && !dailyHours.isClosed) {
    const [closeHour, closeMin] = dailyHours.close.split(':').map(Number)
    const closingTime = new Date(checkinTime)
    closingTime.setHours(closeHour, closeMin, 0, 0)
    
    // Handle overnight closing time
    if (dailyHours.close < dailyHours.open) {
      closingTime.setDate(closingTime.getDate() + 1)
    }
    
    // Cap checkout time at closing time if not approved
    if (checkoutTime > closingTime) {
      effectiveCheckoutTime = closingTime
    }
  }
  
  // Calculate total minutes worked
  const totalMinutes = differenceInMinutes(effectiveCheckoutTime, checkinTime)
  
  // Check if overnight shift (spans across midnight)
  const isOvernightShift = !isSameDay(checkinTime, effectiveCheckoutTime)
  
  // Calculate late status if shift info provided
  let isLate = false
  let lateMinutes = 0
  let isEarlyCheckout = false
  
  if (shift) {
    const [shiftStartHour, shiftStartMin] = shift.startTime.split(':').map(Number)
    const shiftStartTime = new Date(checkinTime)
    shiftStartTime.setHours(shiftStartHour, shiftStartMin, 0, 0)
    
    // Calculate late minutes (considering grace period)
    const minutesAfterShiftStart = differenceInMinutes(checkinTime, shiftStartTime)
    if (minutesAfterShiftStart > shift.graceMinutes) {
      isLate = true
      lateMinutes = minutesAfterShiftStart - shift.graceMinutes
    }
    
    // Check early checkout
    const [shiftEndHour, shiftEndMin] = shift.endTime.split(':').map(Number)
    let shiftEndTime = new Date(checkoutTime)
    shiftEndTime.setHours(shiftEndHour, shiftEndMin, 0, 0)
    
    // Handle overnight shift end time
    if (shift.endTime < shift.startTime) {
      shiftEndTime = new Date(shiftEndTime)
      shiftEndTime.setDate(shiftEndTime.getDate() + 1)
    }
    
    const minutesBeforeShiftEnd = differenceInMinutes(shiftEndTime, effectiveCheckoutTime)
    if (minutesBeforeShiftEnd > shift.graceMinutes) {
      isEarlyCheckout = true
    }
  }
  
  // Convert to hours
  let totalHours = totalMinutes / 60
  
  // Deduct break time if worked more than 4 hours
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
  const isOvernight = !isSameDay(checkinTime, now)
  
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
  let checkoutTime = new Date(checkinTime)
  checkoutTime.setHours(endHour, endMin, 0, 0)
  
  // Handle overnight shift
  if (shift.endTime < shift.startTime) {
    checkoutTime.setDate(checkoutTime.getDate() + 1)
  }
  
  return checkoutTime
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
  const dayName = dayNames[checkinTime.getDay()]
  const dailyHours = location.workingHours[dayName]
  
  if (!dailyHours || dailyHours.isClosed) return false
  
  const [closeHour, closeMin] = dailyHours.close.split(':').map(Number)
  const closingTime = new Date(checkinTime)
  closingTime.setHours(closeHour, closeMin, 0, 0)
  
  // Handle overnight closing time
  if (dailyHours.close < dailyHours.open) {
    closingTime.setDate(closingTime.getDate() + 1)
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