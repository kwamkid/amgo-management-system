// lib/services/autoCheckoutService.ts
// Server-side auto-checkout service using Firebase Admin SDK

import { adminDb } from '@/lib/firebase/admin'
import { CheckInRecord } from '@/types/checkin'
import { calculateWorkingHours } from './workingHoursService'
import { format } from 'date-fns'
import { FieldValue } from 'firebase-admin/firestore'

const COLLECTION_NAME = 'checkins'

/**
 * Auto-checkout pending records (forgot to checkout)
 * Run this at 23:59 daily via cron job
 * Uses Firebase Admin SDK for server-side operations
 */
export async function autoCheckoutPendingRecords(): Promise<{
  processed: number
  errors: string[]
}> {
  try {
    const records: CheckInRecord[] = []
    const errors: string[] = []
    let processed = 0

    // Check today and yesterday (for overnight shifts)
    for (let i = 0; i < 2; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = format(date, 'yyyy-MM-dd')

      const snapshot = await adminDb
        .collection(COLLECTION_NAME)
        .doc(dateStr)
        .collection('records')
        .where('status', '==', 'checked-in')
        .get()

      snapshot.docs.forEach(doc => {
        const data = doc.data()
        const checkinTime = data.checkinTime?.toDate() || new Date(data.checkinTime)
        const hoursSinceCheckin = (Date.now() - checkinTime.getTime()) / (1000 * 60 * 60)

        // Auto-checkout if checked in for more than 12 hours
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

    console.log(`[Auto-Checkout] Found ${records.length} records to process`)

    // Process each record
    for (const record of records) {
      try {
        const checkinTime = record.checkinTime instanceof Date
          ? record.checkinTime
          : new Date(record.checkinTime)

        // Determine default checkout time
        let checkoutTime: Date

        if (record.shiftEndTime) {
          // Use shift end time
          const [endHour, endMin] = record.shiftEndTime.split(':').map(Number)
          checkoutTime = new Date(checkinTime)
          checkoutTime.setHours(endHour, endMin, 0, 0)

          // If shift end time is before checkin time, it's next day
          if (checkoutTime < checkinTime) {
            checkoutTime.setDate(checkoutTime.getDate() + 1)
          }
        } else {
          // Default to 18:00 on check-in day
          checkoutTime = new Date(checkinTime)
          checkoutTime.setHours(18, 0, 0, 0)

          // If 18:00 is before checkin time, use checkin time + 8 hours
          if (checkoutTime < checkinTime) {
            checkoutTime = new Date(checkinTime.getTime() + 8 * 60 * 60 * 1000)
          }
        }

        // Get location for hours calculation
        let location = null
        if (record.primaryLocationId) {
          const locationDoc = await adminDb
            .collection('locations')
            .doc(record.primaryLocationId)
            .get()

          if (locationDoc.exists) {
            location = { id: locationDoc.id, ...locationDoc.data() } as any
          }
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
              false // Not approved by default
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
        const dateStr = format(checkinTime, 'yyyy-MM-dd')
        const docRef = adminDb
          .collection(COLLECTION_NAME)
          .doc(dateStr)
          .collection('records')
          .doc(record.id!)

        await docRef.update({
          checkoutTime,

          // Working hours
          regularHours: hoursCalc.regularHours,
          overtimeHours: hoursCalc.overtimeHours,
          totalHours: hoursCalc.totalHours,
          breakHours: hoursCalc.breakHours,

          // Status
          status: 'completed',
          autoCheckout: true,
          forgotCheckout: true,
          isOvernightShift: hoursCalc.isOvernightShift,

          // Auto checkout info
          autoCheckoutAt: FieldValue.serverTimestamp(),
          autoCheckoutNote: 'ระบบเช็คเอาท์อัตโนมัติ (ลืมเช็คเอาท์)',

          // Edit history
          editHistory: FieldValue.arrayUnion({
            editedBy: 'system',
            editedByName: 'Auto-Checkout System',
            editedAt: new Date(),
            field: 'checkoutTime',
            oldValue: null,
            newValue: checkoutTime,
            reason: 'ระบบเช็คเอาท์อัตโนมัติเนื่องจากลืมเช็คเอาท์เกิน 12 ชั่วโมง'
          }),

          updatedAt: FieldValue.serverTimestamp()
        })

        processed++
        console.log(`[Auto-Checkout] ✓ Processed: ${record.userName} (${record.id})`)
      } catch (error) {
        console.error(`[Auto-Checkout] ✗ Error processing record ${record.id}:`, error)
        errors.push(`${record.userName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return { processed, errors }
  } catch (error) {
    console.error('[Auto-Checkout] Fatal error:', error)
    throw error
  }
}
