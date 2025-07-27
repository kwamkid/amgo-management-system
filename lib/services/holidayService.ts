// lib/services/holidayService.ts

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { 
  Holiday, 
  HolidayFormData, 
  HolidayFilters,
  PublicHolidayImport,
  DEFAULT_OT_RATES
} from '@/types/holiday'
import { format, startOfYear, endOfYear, getYear } from 'date-fns'

const COLLECTION_NAME = 'holidays'

/**
 * Create a new holiday
 */
export async function createHoliday(
  data: HolidayFormData,
  userId: string
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      date: new Date(data.date),
      overtimeRates: data.overtimeRates || DEFAULT_OT_RATES,
      isActive: true,
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    })
    
    return docRef.id
  } catch (error) {
    console.error('Error creating holiday:', error)
    throw new Error('ไม่สามารถสร้างวันหยุดได้')
  }
}

/**
 * Update holiday
 */
export async function updateHoliday(
  holidayId: string,
  data: Partial<HolidayFormData>,
  userId: string
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, holidayId)
    
    const updateData: any = {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    }
    
    if (data.date) {
      updateData.date = new Date(data.date)
    }
    
    await updateDoc(docRef, updateData)
  } catch (error) {
    console.error('Error updating holiday:', error)
    throw new Error('ไม่สามารถอัพเดทวันหยุดได้')
  }
}

/**
 * Delete holiday (soft delete)
 */
export async function deleteHoliday(holidayId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, holidayId)
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error deleting holiday:', error)
    throw new Error('ไม่สามารถลบวันหยุดได้')
  }
}

/**
 * Get holidays with filters
 */
export async function getHolidays(filters?: HolidayFilters): Promise<Holiday[]> {
  try {
    let q = query(collection(db, COLLECTION_NAME))
    
    // Filter by year
    if (filters?.year) {
      const yearStart = startOfYear(new Date(filters.year, 0, 1))
      const yearEnd = endOfYear(new Date(filters.year, 11, 31))
      
      q = query(
        q,
        where('date', '>=', yearStart),
        where('date', '<=', yearEnd)
      )
    }
    
    // Filter by type
    if (filters?.type) {
      q = query(q, where('type', '==', filters.type))
    }
    
    // Filter by active status
    if (filters?.isActive !== undefined) {
      q = query(q, where('isActive', '==', filters.isActive))
    }
    
    // Order by date
    q = query(q, orderBy('date', 'asc'))
    
    const snapshot = await getDocs(q)
    const holidays: Holiday[] = []
    
    snapshot.forEach(doc => {
      const data = doc.data()
      holidays.push({
        id: doc.id,
        ...data,
        date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : undefined
      } as Holiday)
    })
    
    // Filter by location if specified
    if (filters?.locationId) {
      return holidays.filter(holiday => 
        !holiday.applicableLocationIds || 
        holiday.applicableLocationIds.length === 0 ||
        holiday.applicableLocationIds.includes(filters.locationId!)
      )
    }
    
    return holidays
  } catch (error) {
    console.error('Error getting holidays:', error)
    throw new Error('ไม่สามารถดึงข้อมูลวันหยุดได้')
  }
}

/**
 * Get single holiday
 */
export async function getHoliday(holidayId: string): Promise<Holiday | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, holidayId)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return null
    }
    
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : undefined
    } as Holiday
  } catch (error) {
    console.error('Error getting holiday:', error)
    throw new Error('ไม่สามารถดึงข้อมูลวันหยุดได้')
  }
}

/**
 * Check if a date is holiday
 */
export async function isHoliday(
  date: Date,
  locationId?: string,
  role?: string
): Promise<{ isHoliday: boolean; holiday?: Holiday }> {
  try {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dateStart = new Date(dateStr)
    const dateEnd = new Date(dateStr)
    dateEnd.setHours(23, 59, 59, 999)
    
    const q = query(
      collection(db, COLLECTION_NAME),
      where('date', '>=', dateStart),
      where('date', '<=', dateEnd),
      where('isActive', '==', true)
    )
    
    const snapshot = await getDocs(q)
    
    if (snapshot.empty) {
      return { isHoliday: false }
    }
    
    // Check each holiday for location and role applicability
    for (const doc of snapshot.docs) {
      const holiday = {
        id: doc.id,
        ...doc.data()
      } as Holiday
      
      // Check location
      if (holiday.applicableLocationIds && 
          holiday.applicableLocationIds.length > 0 && 
          locationId &&
          !holiday.applicableLocationIds.includes(locationId)) {
        continue
      }
      
      // Check role
      if (holiday.applicableRoles && 
          holiday.applicableRoles.length > 0 && 
          role &&
          !holiday.applicableRoles.includes(role)) {
        continue
      }
      
      // This holiday applies
      return { 
        isHoliday: true, 
        holiday: {
          ...holiday,
          date: holiday.date instanceof Timestamp ? holiday.date.toDate() : holiday.date
        }
      }
    }
    
    return { isHoliday: false }
  } catch (error) {
    console.error('Error checking holiday:', error)
    return { isHoliday: false }
  }
}

/**
 * Import public holidays
 */
export async function importPublicHolidays(
  holidays: PublicHolidayImport[],
  year: number,
  userId: string
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0
  
  for (const holiday of holidays) {
    try {
      // Check if holiday already exists
      const dateToCheck = new Date(holiday.date)
      const existing = await isHoliday(dateToCheck)
      
      if (!existing.isHoliday) {
        await createHoliday({
          name: holiday.name,
          date: holiday.date,
          type: 'public',
          isWorkingDay: false,
          overtimeRates: DEFAULT_OT_RATES,
          applicableLocationIds: [], // All locations
          applicableRoles: [], // All roles
          description: `วันหยุดราชการประจำปี ${year}`,
          recurring: false
        }, userId)
        
        success++
      }
    } catch (error) {
      console.error(`Failed to import holiday: ${holiday.name}`, error)
      failed++
    }
  }
  
  return { success, failed }
}

/**
 * Get holidays for date range (for reports)
 */
export async function getHolidaysInRange(
  startDate: Date,
  endDate: Date,
  locationId?: string
): Promise<Map<string, Holiday>> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      where('isActive', '==', true),
      orderBy('date', 'asc')
    )
    
    const snapshot = await getDocs(q)
    const holidayMap = new Map<string, Holiday>()
    
    snapshot.forEach(doc => {
      const data = doc.data()
      const holiday: Holiday = {
        id: doc.id,
        ...data,
        date: data.date?.toDate ? data.date.toDate() : new Date(data.date)
      } as Holiday
      
      // Check location applicability
      if (!locationId || 
          !holiday.applicableLocationIds || 
          holiday.applicableLocationIds.length === 0 ||
          holiday.applicableLocationIds.includes(locationId)) {
        
        const dateKey = format(holiday.date as Date, 'yyyy-MM-dd')
        holidayMap.set(dateKey, holiday)
      }
    })
    
    return holidayMap
  } catch (error) {
    console.error('Error getting holidays in range:', error)
    return new Map()
  }
}

/**
 * Calculate OT rate for a specific role on a holiday
 */
export function getHolidayOTRate(holiday: Holiday, role: string): number {
  if (!holiday.overtimeRates) {
    return DEFAULT_OT_RATES[role as keyof typeof DEFAULT_OT_RATES] || 1.5
  }
  
  return holiday.overtimeRates[role as keyof typeof holiday.overtimeRates] || 
         DEFAULT_OT_RATES[role as keyof typeof DEFAULT_OT_RATES] || 
         1.5
}