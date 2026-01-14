// lib/services/reportService.ts - Updated with Holiday Support

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
import { Holiday } from '@/types/holiday'
import { format, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns'
import { getHolidaysInRange } from './holidayService'

export interface AttendanceReportData {
  date: string
  userId: string
  userName: string
  firstCheckIn: string
  lastCheckOut: string
  totalHours: number
  status: 'normal' | 'late' | 'absent' | 'holiday'
  locationName?: string
  isLate: boolean
  lateMinutes: number
  note?: string
  holidayName?: string // เพิ่ม field สำหรับชื่อวันหยุด
  isWorkingHoliday?: boolean // เพิ่ม field สำหรับวันหยุดที่ต้องทำงาน
}

export interface AttendanceReportFilters {
  startDate: Date
  endDate: Date
  userIds?: string[]
  locationId?: string
  page?: number
  pageSize?: number
  showOnlyPresent?: boolean
}

export interface AttendanceReportResponse {
  data: AttendanceReportData[]
  summary: any[]
  pagination: {
    currentPage: number
    totalPages: number
    totalRecords: number
    pageSize: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Get attendance report with optimization and holiday support
 */
export async function getAttendanceReport(
  filters: AttendanceReportFilters
): Promise<AttendanceReportData[]> {
  const response = await getAttendanceReportPaginated(filters)
  return response.data
}

/**
 * Get attendance report with pagination (client-side optimized)
 */
export async function getAttendanceReportPaginated(
  filters: AttendanceReportFilters
): Promise<AttendanceReportResponse> {
  try {
    console.log('Getting report with filters:', filters)
    
    const page = filters.page || 1
    const pageSize = filters.pageSize || 50
    const showOnlyPresent = filters.showOnlyPresent !== undefined ? filters.showOnlyPresent : true
    
    // Step 1: Get filtered users
    const users = await getFilteredUsers(filters.userIds, filters.locationId)
    console.log(`Found ${users.length} users`)
    
    if (users.length === 0) {
      return {
        data: [],
        summary: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalRecords: 0,
          pageSize,
          hasNext: false,
          hasPrev: false
        }
      }
    }
    
    // Step 2: Get date range
    const dates = eachDayOfInterval({
      start: startOfDay(filters.startDate),
      end: endOfDay(filters.endDate)
    })
    console.log(`Processing ${dates.length} days`)
    
    // Warn if date range is too large
    if (dates.length > 31) {
      console.warn('Large date range detected. Consider using smaller ranges.')
    }
    
    // Step 3: Get holidays in range
    const holidayMap = await getHolidaysInRange(
      filters.startDate,
      filters.endDate,
      filters.locationId
    )
    console.log(`Found ${holidayMap.size} holidays in range`)
    
    // Step 4: Generate all report data (optimized with caching)
    const allReportData = await generateReportDataOptimized(users, dates, holidayMap)
    console.log(`Generated ${allReportData.length} records`)
    
    // Step 5: Apply showOnlyPresent filter
    let filteredData = allReportData
    if (showOnlyPresent) {
      // Don't filter out holidays that are working days
      filteredData = allReportData.filter(record => 
        record.status !== 'absent' && 
        (record.status !== 'holiday' || record.isWorkingHoliday)
      )
      console.log(`After filter: ${filteredData.length} records`)
    }
    
    // Step 6: Apply pagination
    const totalRecords = filteredData.length
    const totalPages = Math.ceil(totalRecords / pageSize)
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedData = filteredData.slice(startIndex, endIndex)
    console.log(`Showing page ${page} with ${paginatedData.length} records`)
    
    // Step 7: Calculate summary
    const summary = getAttendanceSummary(filteredData)
    
    return {
      data: paginatedData,
      summary,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        pageSize,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  } catch (error) {
    console.error('Error generating report:', error)
    throw error
  }
}

/**
 * Get full report for export
 */
export async function getAttendanceReportForExport(
  filters: Omit<AttendanceReportFilters, 'page' | 'pageSize'>
): Promise<AttendanceReportResponse> {
  try {
    console.log('Getting full report for export...')
    
    // Force showOnlyPresent to false for export to get all data
    const exportFilters: AttendanceReportFilters = {
      ...filters,
      page: 1,
      pageSize: 999999, // Get all data
      showOnlyPresent: false // Get all data including absent and holidays
    }
    
    const result = await getAttendanceReportPaginated(exportFilters)
    console.log(`Export data ready: ${result.data.length} records`)
    
    return result
  } catch (error) {
    console.error('Error in getAttendanceReportForExport:', error)
    throw error
  }
}

/**
 * Get filtered users
 */
async function getFilteredUsers(
  userIds?: string[],
  locationId?: string
): Promise<User[]> {
  try {
    console.log('Getting users with filters:', { userIds, locationId })
    let users: User[] = []
    
    // If specific users requested
    if (userIds && userIds.length > 0) {
      // Batch query for user IDs (Firestore limit is 10 per 'in' query)
      for (let i = 0; i < userIds.length; i += 10) {
        const batch = userIds.slice(i, i + 10)
        const q = query(
          collection(db, 'users'),
          where('__name__', 'in', batch),
          where('isActive', '==', true)
        )
        const snapshot = await getDocs(q)
        users.push(...snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as User)))
      }
    } else {
      // Get all active users
      const q = query(
        collection(db, 'users'),
        where('isActive', '==', true),
        orderBy('fullName')
      )
      const snapshot = await getDocs(q)
      console.log(`Found ${snapshot.size} active users`)
      users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User))
    }
    
    // Filter by location if specified
    if (locationId) {
      console.log(`Filtering by location: ${locationId}`)
      const beforeFilter = users.length
      users = users.filter(user => 
        user.allowedLocationIds?.includes(locationId)
      )
      console.log(`Location filter: ${beforeFilter} → ${users.length} users`)
    }
    
    console.log(`Returning ${users.length} users`)
    return users
  } catch (error) {
    console.error('Error getting users:', error)
    throw error
  }
}

/**
 * Generate report data with optimization and holiday support
 */
async function generateReportDataOptimized(
  users: User[],
  dates: Date[],
  holidayMap: Map<string, Holiday>
): Promise<AttendanceReportData[]> {
  const reportData: AttendanceReportData[] = []
  
  // Process dates one by one to check all users
  for (const date of dates) {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    
    // Check if this date is a holiday
    const holiday = holidayMap.get(dateStr)
    
    try {
      // Get ALL check-ins for this date (more efficient than per-user queries)
      const checkinsQuery = query(
        collection(db, 'checkins', dateStr, 'records'),
        orderBy('checkinTime', 'asc')
      )
      
      const checkinsSnapshot = await getDocs(checkinsQuery)
      console.log(`Date ${dateStr}: Found ${checkinsSnapshot.size} check-ins`)
      
      // Group check-ins by user
      const checkinsByUser = new Map<string, CheckInRecord[]>()
      
      checkinsSnapshot.docs.forEach(doc => {
        const checkin = {
          id: doc.id,
          ...doc.data()
        } as CheckInRecord
        
        const userId = checkin.userId
        if (!checkinsByUser.has(userId)) {
          checkinsByUser.set(userId, [])
        }
        checkinsByUser.get(userId)!.push(checkin)
      })
      
      // Process each user
      for (const user of users) {
        const userCheckins = checkinsByUser.get(user.id!) || []
        
        if (userCheckins.length === 0) {
          // No check-in = check if holiday or absent
          let status: AttendanceReportData['status'] = 'absent'
          let note = ''
          
          if (holiday) {
            status = 'holiday'
            note = holiday.name
          } else if (isWeekend) {
            status = 'holiday'
            note = 'วันหยุดสุดสัปดาห์'
          }
          
          reportData.push({
            date: dateStr,
            userId: user.id!,
            userName: user.fullName,
            firstCheckIn: '-',
            lastCheckOut: '-',
            totalHours: 0,
            status,
            isLate: false,
            lateMinutes: 0,
            note,
            holidayName: holiday?.name,
            isWorkingHoliday: holiday?.isWorkingDay
          })
        } else {
          // Process check-ins
          const firstCheckin = userCheckins[0]
          const firstCheckinTime = firstCheckin.checkinTime instanceof Timestamp 
            ? firstCheckin.checkinTime.toDate() 
            : new Date(firstCheckin.checkinTime)
          
          // Find last checkout
          let lastCheckoutTime: Date | null = null
          let totalHours = 0
          
          for (const checkin of userCheckins) {
            if (checkin.checkoutTime) {
              const checkoutTime = checkin.checkoutTime instanceof Timestamp 
                ? checkin.checkoutTime.toDate() 
                : new Date(checkin.checkoutTime)
              
              if (!lastCheckoutTime || checkoutTime > lastCheckoutTime) {
                lastCheckoutTime = checkoutTime
              }
            }
            
            totalHours += checkin.totalHours || 0
          }
          
          // If still checked in, calculate up to now
          if (!lastCheckoutTime && userCheckins.some(c => c.status === 'checked-in')) {
            const now = new Date()
            const activeCheckin = userCheckins.find(c => c.status === 'checked-in')
            if (activeCheckin) {
              const checkinTime = activeCheckin.checkinTime instanceof Timestamp 
                ? activeCheckin.checkinTime.toDate() 
                : new Date(activeCheckin.checkinTime)
              const hoursWorked = (now.getTime() - checkinTime.getTime()) / (1000 * 60 * 60)
              totalHours = Math.round(hoursWorked * 100) / 100
            }
          }
          
          // Prepare note
          let note = userCheckins.map(c => c.note).filter(Boolean).join(', ')
          if (holiday) {
            note = note ? `${holiday.name} - ${note}` : holiday.name
          }
          
          reportData.push({
            date: dateStr,
            userId: user.id!,
            userName: user.fullName,
            firstCheckIn: format(firstCheckinTime, 'HH:mm'),
            lastCheckOut: lastCheckoutTime ? format(lastCheckoutTime, 'HH:mm') : '-',
            totalHours: Math.round(totalHours * 100) / 100,
            status: holiday && !holiday.isWorkingDay ? 'holiday' : (firstCheckin.isLate ? 'late' : 'normal'),
            locationName: firstCheckin.primaryLocationName || 'เช็คอินนอกสถานที่',
            isLate: firstCheckin.isLate || false,
            lateMinutes: firstCheckin.lateMinutes || 0,
            note,
            holidayName: holiday?.name,
            isWorkingHoliday: holiday?.isWorkingDay
          })
        }
      }
    } catch (error) {
      console.error(`Error processing date ${dateStr}:`, error)
      // Add absent/holiday records for all users on error
      users.forEach(user => {
        let status: AttendanceReportData['status'] = 'absent'
        let note = ''
        
        if (holiday) {
          status = 'holiday'
          note = holiday.name
        } else if (isWeekend) {
          status = 'holiday'
          note = 'วันหยุดสุดสัปดาห์'
        }
        
        reportData.push({
          date: dateStr,
          userId: user.id!,
          userName: user.fullName,
          firstCheckIn: '-',
          lastCheckOut: '-',
          totalHours: 0,
          status,
          isLate: false,
          lateMinutes: 0,
          note,
          holidayName: holiday?.name,
          isWorkingHoliday: holiday?.isWorkingDay
        })
      })
    }
  }
  
  // Sort by date and user name
  reportData.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date)
    if (dateCompare !== 0) return dateCompare
    return a.userName.localeCompare(b.userName)
  })
  
  return reportData
}

/**
 * Calculate attendance summary
 */
export function getAttendanceSummary(data: AttendanceReportData[]) {
  const userStatsMap = new Map<string, {
    userId: string
    userName: string
    totalDays: number
    presentDays: number
    absentDays: number
    lateDays: number
    holidayDays: number
    workingHolidayDays: number
    totalHours: number
    averageHoursPerDay: number
  }>()
  
  data.forEach(record => {
    if (!userStatsMap.has(record.userId)) {
      userStatsMap.set(record.userId, {
        userId: record.userId,
        userName: record.userName,
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        holidayDays: 0,
        workingHolidayDays: 0,
        totalHours: 0,
        averageHoursPerDay: 0
      })
    }
    
    const stats = userStatsMap.get(record.userId)!
    stats.totalDays++
    
    if (record.status === 'absent') {
      stats.absentDays++
    } else if (record.status === 'holiday') {
      stats.holidayDays++
      if (record.isWorkingHoliday && record.totalHours > 0) {
        stats.workingHolidayDays++
        stats.presentDays++
        stats.totalHours += record.totalHours
      }
    } else {
      stats.presentDays++
      stats.totalHours += record.totalHours
      
      if (record.status === 'late') {
        stats.lateDays++
      }
    }
  })
  
  // Calculate averages
  const results = Array.from(userStatsMap.values())
  results.forEach(stat => {
    stat.averageHoursPerDay = stat.presentDays > 0 
      ? Math.round((stat.totalHours / stat.presentDays) * 100) / 100 
      : 0
  })
  
  return results
}