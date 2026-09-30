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
  CheckCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import Link from 'next/link'
import { InfoPanel } from '@/components/shared'
import { Alert, Pill, type PillTone, Card, CardContent, Button, Spinner, EmptyState } from '@/components/aoo'
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
      
      // ย้อนหลัง 7 วัน — query เดียวจบ
      // (ของเดิมวนยิงทีละวัน 7 รอบ เพราะ Firestore เก็บซ้อนตามวัน)
      const today = new Date()
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 6)

      const { records: results } = await getCheckInRecords(
        {
          startDate: format(weekAgo, 'yyyy-MM-dd'),
          endDate: format(today, 'yyyy-MM-dd'),
          userId: userData!.id,
        },
        limit
      )

      setRecords(results)
    } catch (err) {
      console.error('Error fetching history:', err)
      setError('ไม่สามารถโหลดประวัติได้')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (record: CheckInRecord) => {
    if (record.status === 'checked-in') {
      return <div className="w-2 h-2 bg-[var(--sky-500)] rounded-full animate-pulse" />
    }
    if (record.status === 'pending') {
      return <AlertCircle className="w-4 h-4 text-[var(--sun-500)]" />
    }
    if (record.isLate) {
      return <AlertCircle className="w-4 h-4 text-[var(--ruby-500)]" />
    }
    return <CheckCircle className="w-4 h-4 text-[var(--leaf-500)]" />
  }

  const getStatusText = (record: CheckInRecord) => {
    if (record.status === 'checked-in') {
      return 'กำลังทำงาน'
    }
    if (record.status === 'pending') {
      return 'รอ HR อนุมัติ'
    }
    if (record.autoCheckout) {
      return 'Auto Checkout'
    }
    if (record.forgotCheckout) {
      return 'ลืมเช็คเอาท์'
    }
    return 'เสร็จสิ้น'
  }

  const getStatusTone = (record: CheckInRecord): PillTone => {
    if (record.status === 'checked-in') return 'sky'
    if (record.status === 'pending') return 'warning'
    if (record.autoCheckout) return 'info'
    if (record.isLate) return 'danger'
    return 'success'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert tone="error">
        <div>{error}</div>
      </Alert>
    )
  }

  if (records.length === 0) {
    return (
      <EmptyState icon={<Calendar size={40} />} title="ยังไม่มีประวัติการเช็คอิน" />
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
          <Card padding={0} key={record.id}>
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
                  <Pill tone={getStatusTone(record)}>
                    {getStatusText(record)}
                  </Pill>
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
                      <span className="text-xs text-[var(--brand-coral-600)] ml-1">
                        (OT {formatWorkingHours(record.overtimeHours)})
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Location & Shift */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{record.primaryLocationName || 'เช็คอินนอกสถานที่'}</span>
                    {record.isLate && (
                      <Pill tone="danger" className="ml-auto">
                        สาย {record.lateMinutes} นาที
                      </Pill>
                    )}
                  </div>
                  
                  {/* เพิ่มส่วนแสดงข้อมูลกะ */}
                  {record.selectedShiftName && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 ml-6">
                      <Clock className="w-3 h-3" />
                      <span>{record.selectedShiftName} ({record.shiftStartTime} - {record.shiftEndTime})</span>
                    </div>
                  )}
                </div>

              {/* Note or Warning */}
              {record.autoCheckout && (
                <Alert tone="info" className="mt-2 py-2">
                  <div className="text-xs">
                    🤖 ลืมเช็คเอาท์ — ระบบปิดให้ที่เวลาเลิกงาน
                  </div>
                </Alert>
              )}
              {record.needsOvertimeApproval && (
                <Alert tone="warning" className="mt-2 py-2">
                  <div className="text-xs">
                    ⏰ ทำงานเกินเวลาปิด รอ HR อนุมัติ
                  </div>
                </Alert>
              )}
              {record.note && (
                <InfoPanel className="mt-2">
                  <p className="text-xs text-gray-600">💬 {record.note}</p>
                </InfoPanel>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* View All Link */}
      {showViewAll && records.length >= limit && (
        <Link href="/checkin/history">
          <Button variant="ghost" className="w-full">
            <span className="font-medium">ดูประวัติทั้งหมด</span>
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      )}
    </div>
  )
}