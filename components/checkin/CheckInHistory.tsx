// components/checkin/CheckInHistory.tsx

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { CheckInRecord } from '@/types/checkin'
import { getCheckInRecords } from '@/lib/services/checkinService'
import { formatWorkingHours } from '@/lib/services/workingHoursService'
import { 
  Clock, 
  MapPin, 
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import Link from 'next/link'

interface CheckInHistoryProps {
  limit?: number
  showViewAll?: boolean
}

export default function CheckInHistory({ 
  limit = 10, 
  showViewAll = true 
}: CheckInHistoryProps) {
  const { userData } = useAuth()
  const [records, setRecords] = useState<CheckInRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userData?.id) {
      fetchHistory()
    }
  }, [userData?.id]) // Remove fetchHistory from deps

  const fetchHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get records for the last 7 days
      const results: CheckInRecord[] = []
      const today = new Date()
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateStr = format(date, 'yyyy-MM-dd')
        
        const { records: dayRecords } = await getCheckInRecords(
          {
            date: dateStr,
            userId: userData!.id
          },
          limit
        )
        
        results.push(...dayRecords)
        
        if (results.length >= limit) {
          break
        }
      }
      
      setRecords(results.slice(0, limit))
    } catch (err) {
      console.error('Error fetching history:', err)
      setError('ไม่สามารถโหลดประวัติได้')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (record: CheckInRecord) => {
    if (record.status === 'checked-in') {
      return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
    }
    if (record.status === 'pending') {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />
    }
    if (record.isLate) {
      return <AlertCircle className="w-4 h-4 text-red-500" />
    }
    return <CheckCircle className="w-4 h-4 text-green-500" />
  }

  const getStatusText = (record: CheckInRecord) => {
    if (record.status === 'checked-in') {
      return 'กำลังทำงาน'
    }
    if (record.status === 'pending') {
      return 'รอ HR อนุมัติ'
    }
    if (record.forgotCheckout) {
      return 'ลืมเช็คเอาท์'
    }
    return 'เสร็จสิ้น'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">{error}</p>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">ยังไม่มีประวัติการเช็คอิน</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {records.map((record) => {
        const checkinTime = record.checkinTime instanceof Date 
          ? record.checkinTime 
          : new Date(record.checkinTime)
        const checkoutTime = record.checkoutTime 
          ? (record.checkoutTime instanceof Date 
            ? record.checkoutTime 
            : new Date(record.checkoutTime))
          : null

        return (
          <div
            key={record.id}
            className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors"
          >
            {/* Date Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">
                  {format(checkinTime, 'EEEE d MMM', { locale: th })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(record)}
                <span className={`text-xs ${
                  record.status === 'checked-in' ? 'text-green-600' :
                  record.status === 'pending' ? 'text-yellow-600' :
                  'text-gray-600'
                }`}>
                  {getStatusText(record)}
                </span>
              </div>
            </div>

            {/* Time Info */}
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">เข้า-ออก</p>
                  <p className="text-sm font-medium text-gray-900">
                    {format(checkinTime, 'HH:mm')} - {
                      checkoutTime ? format(checkoutTime, 'HH:mm') : '--:--'
                    }
                  </p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">รวม</p>
                <p className="text-sm font-medium text-gray-900">
                  {record.totalHours > 0 
                    ? formatWorkingHours(record.totalHours)
                    : '-'
                  }
                  {record.overtimeHours > 0 && (
                    <span className="text-xs text-orange-600 ml-1">
                      (OT {formatWorkingHours(record.overtimeHours)})
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span>{record.primaryLocationName || 'นอกสถานที่'}</span>
              {record.isLate && (
                <span className="text-xs text-red-600 ml-auto">
                  สาย {record.lateMinutes} นาที
                </span>
              )}
            </div>

            {/* Note or Warning */}
            {record.needsOvertimeApproval && (
              <div className="mt-2 text-xs text-yellow-600 bg-yellow-50 rounded-lg px-3 py-1.5">
                ⏰ ทำงานเกินเวลาปิด รอ HR อนุมัติ
              </div>
            )}
            {record.note && (
              <div className="mt-2 text-xs text-gray-600 bg-white rounded-lg px-3 py-1.5">
                💬 {record.note}
              </div>
            )}
          </div>
        )
      })}

      {/* View All Link */}
      {showViewAll && records.length >= limit && (
        <Link
          href="/checkin/history"
          className="flex items-center justify-center gap-2 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
        >
          <span className="font-medium">ดูประวัติทั้งหมด</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}