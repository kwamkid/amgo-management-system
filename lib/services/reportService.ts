// lib/services/reportService.ts

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { CheckInRecord } from '@/types/checkin'
import { User } from '@/types/user'
import { format, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns'
import { th } from 'date-fns/locale'

export interface AttendanceReportData {
  date: string // YYYY-MM-DD
  userId: string
  userName: string
  firstCheckIn: string // HH:mm
  lastCheckOut: string // HH:mm หรือ '-' ถ้ายังไม่เช็คเอาท์
  totalHours: number
  status: 'normal' | 'late' | 'absent' | 'holiday'
  locationName?: string
  isLate: boolean
  lateMinutes: number
  note?: string
}

export interface AttendanceReportFilters {
  startDate: Date
  endDate: Date
  userIds?: string[] // ถ้าไม่ระบุ = ทั้งหมด
  locationId?: string
}

/**
 * Get attendance report data
 */
export async function getAttendanceReport(
  filters: AttendanceReportFilters
): Promise<AttendanceReportData[]> {
  try {
    const reportData: AttendanceReportData[] = []
    
    // Get all dates in range
    const dates = eachDayOfInterval({
      start: startOfDay(filters.startDate),
      end: endOfDay(filters.endDate)
    })
    
    // Get users
    let users: User[] = []
    if (filters.userIds && filters.userIds.length > 0) {
      // Get specific users
      const userQuery = query(
        collection(db, 'users'),
        where('__name__', 'in', filters.userIds),
        where('isActive', '==', true)
      )
      const userSnapshot = await getDocs(userQuery)
      users = userSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User))
    } else {
      // Get all active users
      const userQuery = query(
        collection(db, 'users'),
        where('isActive', '==', true),
        orderBy('fullName')
      )
      const userSnapshot = await getDocs(userQuery)
      users = userSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User))
    }
    
    // Filter by location if specified
    if (filters.locationId) {
      users = users.filter(user => 
        user.allowedLocationIds?.includes(filters.locationId!)
      )
    }
    
    // Process each date and user
    for (const date of dates) {
      const dateStr = format(date, 'yyyy-MM-dd')
      
      for (const user of users) {
        // Get all check-ins for this user on this date
        const checkinsQuery = query(
          collection(db, 'checkins', dateStr, 'records'),
          where('userId', '==', user.id)
        )
        
        const checkinsSnapshot = await getDocs(checkinsQuery)
        const checkins = checkinsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as CheckInRecord))
        
        if (checkins.length === 0) {
          // No check-in = absent (unless it's a holiday/weekend)
          const dayOfWeek = date.getDay()
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
          
          reportData.push({
            date: dateStr,
            userId: user.id!,
            userName: user.fullName,
            firstCheckIn: '-',
            lastCheckOut: '-',
            totalHours: 0,
            status: isWeekend ? 'holiday' : 'absent',
            isLate: false,
            lateMinutes: 0
          })
        } else {
          // Sort check-ins by time
          checkins.sort((a, b) => {
            const timeA = a.checkinTime instanceof Timestamp 
              ? a.checkinTime.toDate() 
              : new Date(a.checkinTime)
            const timeB = b.checkinTime instanceof Timestamp 
              ? b.checkinTime.toDate() 
              : new Date(b.checkinTime)
            return timeA.getTime() - timeB.getTime()
          })
          
          // Get first check-in
          const firstCheckin = checkins[0]
          const firstCheckinTime = firstCheckin.checkinTime instanceof Timestamp 
            ? firstCheckin.checkinTime.toDate() 
            : new Date(firstCheckin.checkinTime)
          
          // Get last checkout (might be from different record)
          let lastCheckoutTime: Date | null = null
          let totalHours = 0
          
          // Find the last checkout across all records
          for (const checkin of checkins) {
            if (checkin.checkoutTime) {
              const checkoutTime = checkin.checkoutTime instanceof Timestamp 
                ? checkin.checkoutTime.toDate() 
                : new Date(checkin.checkoutTime)
              
              if (!lastCheckoutTime || checkoutTime > lastCheckoutTime) {
                lastCheckoutTime = checkoutTime
              }
            }
            
            // Sum total hours from all records
            totalHours += checkin.totalHours || 0
          }
          
          // If no checkout found but has active check-in, calculate up to now
          if (!lastCheckoutTime && checkins.some(c => c.status === 'checked-in')) {
            const now = new Date()
            const activeCheckin = checkins.find(c => c.status === 'checked-in')
            if (activeCheckin) {
              const checkinTime = activeCheckin.checkinTime instanceof Timestamp 
                ? activeCheckin.checkinTime.toDate() 
                : new Date(activeCheckin.checkinTime)
              const hoursWorked = (now.getTime() - checkinTime.getTime()) / (1000 * 60 * 60)
              totalHours = Math.round(hoursWorked * 100) / 100
            }
          }
          
          reportData.push({
            date: dateStr,
            userId: user.id!,
            userName: user.fullName,
            firstCheckIn: format(firstCheckinTime, 'HH:mm'),
            lastCheckOut: lastCheckoutTime ? format(lastCheckoutTime, 'HH:mm') : '-',
            totalHours: Math.round(totalHours * 100) / 100,
            status: firstCheckin.isLate ? 'late' : 'normal',
            locationName: firstCheckin.primaryLocationName || 'นอกสถานที่',
            isLate: firstCheckin.isLate || false,
            lateMinutes: firstCheckin.lateMinutes || 0,
            note: checkins.map(c => c.note).filter(Boolean).join(', ')
          })
        }
      }
    }
    
    // Sort by date and user name
    reportData.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.userName.localeCompare(b.userName)
    })
    
    return reportData
  } catch (error) {
    console.error('Error generating attendance report:', error)
    throw error
  }
}

/**
 * Get summary statistics for the report
 */
export function getAttendanceSummary(data: AttendanceReportData[]) {
  const userStatsMap = new Map<string, {
    userName: string
    totalDays: number
    presentDays: number
    absentDays: number
    lateDays: number
    totalHours: number
  }>()
  
  // Calculate stats per user
  data.forEach(record => {
    if (!userStatsMap.has(record.userId)) {
      userStatsMap.set(record.userId, {
        userName: record.userName,
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        totalHours: 0
      })
    }
    
    const stats = userStatsMap.get(record.userId)!
    stats.totalDays++
    
    if (record.status === 'absent') {
      stats.absentDays++
    } else if (record.status !== 'holiday') {
      stats.presentDays++
      stats.totalHours += record.totalHours
      
      if (record.status === 'late') {
        stats.lateDays++
      }
    }
  })
  
  // Convert Map to Array with userId
  const results: Array<{
    userId: string
    userName: string
    totalDays: number
    presentDays: number
    absentDays: number
    lateDays: number
    totalHours: number
  }> = []
  
  userStatsMap.forEach((stat, userId) => {
    results.push({
      userId,
      ...stat
    })
  })
  
  return results
}

/**
 * Format report data for display
 */
export function formatReportForDisplay(data: AttendanceReportData[]) {
  // Group by date
  const groupedByDate = data.reduce((acc, record) => {
    if (!acc[record.date]) {
      acc[record.date] = []
    }
    acc[record.date].push(record)
    return acc
  }, {} as Record<string, AttendanceReportData[]>)
  
  return groupedByDate
}

/**
 * Get monthly summary report
 */
export async function getMonthlySummaryReport(
  year: number,
  month: number,
  locationId?: string
): Promise<{
  userId: string
  userName: string
  totalDays: number
  presentDays: number
  absentDays: number
  lateDays: number
  totalHours: number
  averageHoursPerDay: number
}[]> {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0) // Last day of month
  
  const reportData = await getAttendanceReport({
    startDate,
    endDate,
    locationId
  })
  
  const summary = getAttendanceSummary(reportData)
  
  return summary.map(stat => ({
    userId: stat.userId,
    userName: stat.userName,
    totalDays: stat.totalDays,
    presentDays: stat.presentDays,
    absentDays: stat.absentDays,
    lateDays: stat.lateDays,
    totalHours: stat.totalHours,
    averageHoursPerDay: stat.presentDays > 0 
      ? Math.round((stat.totalHours / stat.presentDays) * 100) / 100 
      : 0
  }))
}