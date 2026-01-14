// types/checkin.ts

export interface CheckInRecord {
  id?: string
  userId: string
  userName: string
  userAvatar?: string
  
  // Check-in Info
  checkinTime: Date | string
  checkinLat: number
  checkinLng: number
  checkinType: 'onsite' | 'offsite'
  
  // Support multiple locations in range
  locationsInRange: string[] // All location IDs within radius
  primaryLocationId: string | null // Nearest location (main)
  primaryLocationName?: string
  
  // Shift Info
  selectedShift?: string
  selectedShiftName?: string
  shiftStartTime?: string // "10:00"
  shiftEndTime?: string // "18:00"
  
  // Check-out Info
  checkoutTime?: Date | string
  checkoutLat?: number
  checkoutLng?: number
  
  // Working Hours Calculation
  regularHours: number // Normal hours (max 8)
  overtimeHours: number // Hours beyond 8
  totalHours: number // Total hours worked
  breakHours: number // Break time deducted
  
  // Status
  status: 'checked-in' | 'completed' | 'pending'
  
  // Overnight shift flags
  isOvernightShift?: boolean // Work across midnight
  splitFromRecordId?: string // If split from another record
  
// Flags
  isLate: boolean
  lateMinutes: number
  isEarlyCheckout?: boolean
  forgotCheckout?: boolean
  manualCheckout?: boolean // HR checked out for employee
  autoCheckout?: boolean // System auto-checked out (forgot checkout at 23:59)
  needsOvertimeApproval?: boolean // Worked past closing time, needs HR approval
  overtimeApproved?: boolean // OT hours approved by HR
  
  // Notes
  note?: string // Employee note
  manualNote?: string // HR/Admin note
  checkoutReminder?: {
    sent15min?: boolean
    sent30min?: boolean
    sent1hour?: boolean
    sent2hour?: boolean
  }
  
  // Edit History
  editHistory?: CheckInEdit[]
  
  // Timestamps
  createdAt?: Date
  updatedAt?: Date
}

export interface CheckInEdit {
  editedBy: string
  editedByName: string
  editedAt: Date
  field: string
  oldValue: any
  newValue: any
  reason: string
}

// For creating new check-in
export interface CreateCheckInData {
  userId: string
  userName: string
  userAvatar?: string
  lat: number
  lng: number
  selectedShiftId?: string
  note?: string
}

// For check-out
export interface CheckOutData {
  lat: number
  lng: number
  note?: string
}

// Location check result
export interface LocationCheckResult {
  isWithinRange: boolean
  nearestLocation: {
    id: string
    name: string
    distance: number // meters
  } | null
  locationsInRange: Array<{
    id: string
    name: string
    distance: number
  }>
  canCheckIn: boolean
  reason?: string // If cannot check-in
}

// Shift with calculated times
export interface ShiftWithTimes {
  id: string
  name: string
  startTime: string
  endTime: string
  graceMinutes: number
  // Calculated for today
  actualStartTime: Date
  actualEndTime: Date
  isLate: boolean
  lateMinutes: number
}

// Daily summary
export interface DailyCheckInSummary {
  date: string
  totalEmployees: number
  checkedIn: number
  checkedOut: number
  late: number
  absent: number
  onLeave: number
  working: number // Currently working
  overtime: number // Working overtime now
}

// Check-in filters
export interface CheckInFilters {
  date?: string // YYYY-MM-DD
  userId?: string
  locationId?: string
  status?: 'all' | 'checked-in' | 'completed' | 'pending'
  isLate?: boolean
  hasOvertime?: boolean
}

// For reports
export interface CheckInReport {
  userId: string
  userName: string
  userAvatar?: string
  date: string
  checkinTime: string
  checkoutTime: string
  locationName: string
  regularHours: number
  overtimeHours: number
  totalHours: number
  isLate: boolean
  lateMinutes: number
  status: string
}

// Configuration
export interface CheckInConfig {
  maxOvertimeHours: number // Max OT per day
  autoCheckoutAfterHours: number // Auto create pending after X hours
  breakHoursDeduction: number // Standard break time
  reminderIntervals: {
    beforeCheckout: number[] // [-15] minutes before
    afterCheckout: number[] // [30, 60, 120] minutes after
  }
}