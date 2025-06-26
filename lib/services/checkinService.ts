// lib/services/checkinService.ts

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  CheckInRecord,
  CreateCheckInData,
  CheckOutData,
  CheckInFilters,
  DailyCheckInSummary
} from '@/types/checkin'
import { format, startOfDay, endOfDay } from 'date-fns'
import { calculateWorkingHours, needsOvertimeApproval } from './workingHoursService'
import { getLocation } from './locationService'

const COLLECTION_NAME = 'checkins'

/**
 * Create a new check-in record
 */
export async function createCheckIn(
  data: CreateCheckInData & {
    locationsInRange: string[]
    primaryLocationId: string | null
    primaryLocationName?: string
    checkinType: 'onsite' | 'offsite'
    selectedShift?: any
  }
): Promise<string> {
  try {
    const docData = {
      userId: data.userId,
      userName: data.userName,
      userAvatar: data.userAvatar || null,
      
      // Check-in info
      checkinTime: serverTimestamp(),
      checkinLat: data.lat,
      checkinLng: data.lng,
      checkinType: data.checkinType,
      
      // Location info
      locationsInRange: data.locationsInRange,
      primaryLocationId: data.primaryLocationId,
      primaryLocationName: data.primaryLocationName || null,
      
      // Shift info
      selectedShift: data.selectedShift?.id || null,
      selectedShiftName: data.selectedShift?.name || null,
      shiftStartTime: data.selectedShift?.startTime || null,
      shiftEndTime: data.selectedShift?.endTime || null,
      
      // Initial values
      regularHours: 0,
      overtimeHours: 0,
      totalHours: 0,
      breakHours: 0,
      
      // Status
      status: 'checked-in' as const,
      isLate: false,
      lateMinutes: 0,
      
      // Notes
      note: data.note || null,
      
      // Timestamps
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    
    // Create document with date-based path for better querying
    const dateStr = format(new Date(), 'yyyy-MM-dd')
    const collectionRef = collection(db, COLLECTION_NAME, dateStr, 'records')
    const docRef = await addDoc(collectionRef, docData)
    
    return docRef.id
  } catch (error) {
    console.error('Error creating check-in:', error)
    throw error
  }
}

/**
 * Check out from current session
 */
export async function checkOut(
  userId: string,
  checkoutData: CheckOutData
): Promise<void> {
  try {
    // Find active check-in for user
    const activeCheckIn = await getActiveCheckIn(userId)
    
    if (!activeCheckIn) {
      throw new Error('ไม่พบการเช็คอินที่ยังไม่ได้เช็คเอาท์')
    }
    
    // Get location data for hours calculation
    let location = null
    if (activeCheckIn.primaryLocationId) {
      location = await getLocation(activeCheckIn.primaryLocationId)
    }
    
    const checkinTime = activeCheckIn.checkinTime instanceof Timestamp 
      ? activeCheckIn.checkinTime.toDate() 
      : new Date(activeCheckIn.checkinTime)
    const checkoutTime = new Date()
    
    // Calculate working hours
    const hoursCalc = location 
      ? calculateWorkingHours(
          checkinTime,
          checkoutTime,
          location,
          activeCheckIn.selectedShift ? {
            startTime: activeCheckIn.shiftStartTime!,
            endTime: activeCheckIn.shiftEndTime!,
            graceMinutes: 15
          } : undefined,
          false // Not approved by default
        )
      : {
          regularHours: 0,
          overtimeHours: 0,
          totalHours: 0,
          breakHours: 0,
          isLate: activeCheckIn.isLate,
          lateMinutes: activeCheckIn.lateMinutes,
          isEarlyCheckout: false,
          isOvernightShift: false
        }
    
    // Check if needs overtime approval
    const needsApproval = location ? needsOvertimeApproval(checkoutTime, location, checkinTime) : false
    
    // Update record
    const dateStr = format(checkinTime, 'yyyy-MM-dd')
    const docRef = doc(db, COLLECTION_NAME, dateStr, 'records', activeCheckIn.id!)
    
    await updateDoc(docRef, {
      checkoutTime: serverTimestamp(),
      checkoutLat: checkoutData.lat,
      checkoutLng: checkoutData.lng,
      
      // Working hours
      regularHours: hoursCalc.regularHours,
      overtimeHours: hoursCalc.overtimeHours,
      totalHours: hoursCalc.totalHours,
      breakHours: hoursCalc.breakHours,
      
      // Status
      status: needsApproval ? 'pending' : 'completed',
      isOvernightShift: hoursCalc.isOvernightShift,
      needsOvertimeApproval: needsApproval,
      
      // Notes
      checkoutNote: checkoutData.note || null,
      
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error checking out:', error)
    throw error
  }
}

/**
 * Get active check-in for a user
 */
export async function getActiveCheckIn(userId: string): Promise<CheckInRecord | null> {
  try {
    // Check today first
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayQuery = query(
      collection(db, COLLECTION_NAME, today, 'records'),
      where('userId', '==', userId),
      where('status', '==', 'checked-in'),
      limit(1)
    )
    
    const todaySnapshot = await getDocs(todayQuery)
    
    if (!todaySnapshot.empty) {
      const doc = todaySnapshot.docs[0]
      return {
        id: doc.id,
        ...doc.data(),
        checkinTime: doc.data().checkinTime?.toDate(),
        checkoutTime: doc.data().checkoutTime?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      } as CheckInRecord
    }
    
    // Check yesterday for overnight shifts
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd')
    
    const yesterdayQuery = query(
      collection(db, COLLECTION_NAME, yesterdayStr, 'records'),
      where('userId', '==', userId),
      where('status', '==', 'checked-in'),
      limit(1)
    )
    
    const yesterdaySnapshot = await getDocs(yesterdayQuery)
    
    if (!yesterdaySnapshot.empty) {
      const doc = yesterdaySnapshot.docs[0]
      return {
        id: doc.id,
        ...doc.data(),
        checkinTime: doc.data().checkinTime?.toDate(),
        checkoutTime: doc.data().checkoutTime?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      } as CheckInRecord
    }
    
    return null
  } catch (error) {
    console.error('Error getting active check-in:', error)
    throw error
  }
}

/**
 * Get check-in records with filters
 */
export async function getCheckInRecords(
  filters: CheckInFilters,
  pageSize = 20,
  lastDoc?: any
): Promise<{
  records: CheckInRecord[]
  lastDoc: any
  hasMore: boolean
}> {
  try {
    const dateStr = filters.date || format(new Date(), 'yyyy-MM-dd')
    let q = query(collection(db, COLLECTION_NAME, dateStr, 'records'))
    
    // Apply filters
    if (filters.userId) {
      q = query(q, where('userId', '==', filters.userId))
    }
    if (filters.locationId) {
      q = query(q, where('primaryLocationId', '==', filters.locationId))
    }
    if (filters.status && filters.status !== 'all') {
      q = query(q, where('status', '==', filters.status))
    }
    if (filters.isLate !== undefined) {
      q = query(q, where('isLate', '==', filters.isLate))
    }
    if (filters.hasOvertime !== undefined) {
      q = query(q, where('overtimeHours', '>', 0))
    }
    
    // Order and pagination
    q = query(q, orderBy('checkinTime', 'desc'), limit(pageSize + 1))
    
    if (lastDoc) {
      q = query(q, startAfter(lastDoc))
    }
    
    const snapshot = await getDocs(q)
    const records = snapshot.docs.slice(0, pageSize).map(doc => ({
      id: doc.id,
      ...doc.data(),
      checkinTime: doc.data().checkinTime?.toDate(),
      checkoutTime: doc.data().checkoutTime?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    } as CheckInRecord))
    
    const hasMore = snapshot.docs.length > pageSize
    const newLastDoc = snapshot.docs[pageSize - 1]
    
    return { records, lastDoc: newLastDoc, hasMore }
  } catch (error) {
    console.error('Error getting check-in records:', error)
    throw error
  }
}

/**
 * Get pending checkouts (forgot to checkout)
 */
export async function getPendingCheckouts(): Promise<CheckInRecord[]> {
  try {
    const records: CheckInRecord[] = []
    
    // Check last 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = format(date, 'yyyy-MM-dd')
      
      const q = query(
        collection(db, COLLECTION_NAME, dateStr, 'records'),
        where('status', '==', 'checked-in')
      )
      
      const snapshot = await getDocs(q)
      
      snapshot.docs.forEach(doc => {
        const data = doc.data()
        const checkinTime = data.checkinTime?.toDate() || new Date(data.checkinTime)
        const hoursSinceCheckin = (Date.now() - checkinTime.getTime()) / (1000 * 60 * 60)
        
        // Only include if more than 12 hours since check-in
        if (hoursSinceCheckin > 12) {
          records.push({
            id: doc.id,
            ...data,
            checkinTime,
            checkoutTime: data.checkoutTime?.toDate(),
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate()
          } as CheckInRecord)
        }
      })
    }
    
    return records.sort((a, b) => 
      new Date(b.checkinTime).getTime() - new Date(a.checkinTime).getTime()
    )
  } catch (error) {
    console.error('Error getting pending checkouts:', error)
    throw error
  }
}

/**
 * Manual checkout by HR/Admin
 */
export async function manualCheckout(
  recordId: string,
  dateStr: string,
  checkoutTime: Date,
  approvedBy: string,
  approvedByName: string,
  reason: string,
  approveOvertime: boolean = false
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, dateStr, 'records', recordId)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      throw new Error('ไม่พบข้อมูลการเช็คอิน')
    }
    
    const record = docSnap.data() as CheckInRecord
    const checkinTime = record.checkinTime instanceof Timestamp 
      ? record.checkinTime.toDate() 
      : new Date(record.checkinTime)
    
    // Get location for hours calculation
    let location = null
    if (record.primaryLocationId) {
      location = await getLocation(record.primaryLocationId)
    }
    
    // Calculate working hours
    const hoursCalc = location 
      ? calculateWorkingHours(
          checkinTime,
          checkoutTime,
          location,
          record.selectedShift ? {
            startTime: record.shiftStartTime!,
            endTime: record.shiftEndTime!,
            graceMinutes: 15
          } : undefined,
          approveOvertime // Use approval status
        )
      : {
          regularHours: 0,
          overtimeHours: 0,
          totalHours: 0,
          breakHours: 0,
          isLate: record.isLate,
          lateMinutes: record.lateMinutes,
          isEarlyCheckout: false,
          isOvernightShift: false
        }
    
    // Update record
    await updateDoc(docRef, {
      checkoutTime,
      
      // Working hours
      regularHours: hoursCalc.regularHours,
      overtimeHours: hoursCalc.overtimeHours,
      totalHours: hoursCalc.totalHours,
      breakHours: hoursCalc.breakHours,
      
      // Status
      status: 'completed',
      manualCheckout: true,
      forgotCheckout: true,
      isOvernightShift: hoursCalc.isOvernightShift,
      overtimeApproved: approveOvertime,
      
      // Manual checkout info
      manualCheckoutBy: approvedBy,
      manualCheckoutByName: approvedByName,
      manualCheckoutAt: serverTimestamp(),
      manualNote: reason,
      
      // Edit history
      editHistory: [...(record.editHistory || []), {
        editedBy: approvedBy,
        editedByName: approvedByName,
        editedAt: new Date(),
        field: 'checkoutTime',
        oldValue: null,
        newValue: checkoutTime,
        reason
      }],
      
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error manual checkout:', error)
    throw error
  }
}

/**
 * Get daily summary
 */
export async function getDailySummary(date: Date = new Date()): Promise<DailyCheckInSummary> {
  try {
    const dateStr = format(date, 'yyyy-MM-dd')
    
    // Get all records for the date
    const q = query(collection(db, COLLECTION_NAME, dateStr, 'records'))
    const snapshot = await getDocs(q)
    
    const summary: DailyCheckInSummary = {
      date: dateStr,
      totalEmployees: 0, // This should come from users collection
      checkedIn: 0,
      checkedOut: 0,
      late: 0,
      absent: 0,
      onLeave: 0,
      working: 0,
      overtime: 0
    }
    
    snapshot.docs.forEach(doc => {
      const data = doc.data()
      
      summary.checkedIn++
      
      if (data.status === 'completed' || data.status === 'pending') {
        summary.checkedOut++
      } else if (data.status === 'checked-in') {
        summary.working++
        
        // Check if currently working overtime
        const checkinTime = data.checkinTime?.toDate() || new Date(data.checkinTime)
        const hoursWorked = (Date.now() - checkinTime.getTime()) / (1000 * 60 * 60)
        if (hoursWorked > 8) {
          summary.overtime++
        }
      }
      
      if (data.isLate) {
        summary.late++
      }
    })
    
    return summary
  } catch (error) {
    console.error('Error getting daily summary:', error)
    throw error
  }
}