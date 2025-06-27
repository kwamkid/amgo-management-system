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
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { colorClasses, gradients } from '@/lib/theme/colors'

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
  }, [userData?.id])

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
      return <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
    }
    if (record.status === 'pending') {
      return <AlertCircle className="w-4 h-4 text-orange-500" />
    }
    if (record.isLate) {
      return <AlertCircle className="w-4 h-4 text-red-500" />
    }
    return <CheckCircle className="w-4 h-4 text-teal-500" />
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

  const getStatusVariant = (record: CheckInRecord): 'success' | 'warning' | 'error' | 'default' => {
    if (record.status === 'checked-in') return 'success'
    if (record.status === 'pending') return 'warning'
    if (record.isLate) return 'error'
    return 'default'
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
      <Alert variant="error">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
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
          <Card 
            key={record.id}
            className="border-0 shadow-sm hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4">
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
                  <Badge variant={getStatusVariant(record)} className="text-xs">
                    {getStatusText(record)}
                  </Badge>
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
                  <Badge variant="error" className="ml-auto text-xs">
                    สาย {record.lateMinutes} นาที
                  </Badge>
                )}
              </div>

              {/* Note or Warning */}
              {record.needsOvertimeApproval && (
                <Alert variant="warning" className="mt-2 py-2">
                  <AlertDescription className="text-xs">
                    ⏰ ทำงานเกินเวลาปิด รอ HR อนุมัติ
                  </AlertDescription>
                </Alert>
              )}
              {record.note && (
                <Card className="mt-2 border-gray-100">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-600">💬 {record.note}</p>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* View All Link */}
      {showViewAll && records.length >= limit && (
        <Link href="/checkin/history">
          <Button
            variant="ghost"
            className="w-full hover:bg-red-50"
          >
            <span className="font-medium">ดูประวัติทั้งหมด</span>
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      )}
    </div>
  )
}