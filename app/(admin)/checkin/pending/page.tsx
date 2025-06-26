// app/(admin)/checkin/pending/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { CheckInRecord } from '@/types/checkin'
import { getPendingCheckouts, manualCheckout } from '@/lib/services/checkinService'
import { getPendingOvertimeInfo } from '@/lib/services/workingHoursService'
import { getLocation } from '@/lib/services/locationService'
import PendingCheckouts from '@/components/checkin/PendingCheckouts'
import { 
  Clock, 
  AlertTriangle,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

export default function PendingCheckoutsPage() {
  const { userData } = useAuth()
  const { showToast } = useToast()
  const [pendingRecords, setPendingRecords] = useState<CheckInRecord[]>([])
  const [overtimeRecords, setOvertimeRecords] = useState<CheckInRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  // Check if user has permission
  const canManage = userData?.role === 'admin' || userData?.role === 'hr'

  useEffect(() => {
    if (canManage) {
      fetchPendingData()
    }
  }, [canManage])

  const fetchPendingData = async () => {
    try {
      setLoading(true)
      
      // Get all pending checkouts
      const pending = await getPendingCheckouts()
      
      // Separate forgot checkouts and overtime approvals
      const forgot = pending.filter(r => r.status === 'checked-in')
      const overtime = pending.filter(r => r.status === 'pending')
      
      setPendingRecords(forgot)
      setOvertimeRecords(overtime)
    } catch (error) {
      console.error('Error fetching pending data:', error)
      showToast('ไม่สามารถโหลดข้อมูลได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleApproveCheckout = async (
    record: CheckInRecord,
    checkoutTime: Date,
    reason: string,
    approveOvertime: boolean = false
  ) => {
    if (!userData) return
    
    try {
      setProcessing(record.id!)
      
      const checkinTime = record.checkinTime instanceof Date 
        ? record.checkinTime 
        : new Date(record.checkinTime)
      
      const dateStr = format(checkinTime, 'yyyy-MM-dd')
      
      await manualCheckout(
        record.id!,
        dateStr,
        checkoutTime,
        userData.id!,
        userData.fullName,
        reason,
        approveOvertime
      )
      
      showToast('บันทึกการเช็คเอาท์สำเร็จ', 'success')
      await fetchPendingData()
    } catch (error) {
      console.error('Error approving checkout:', error)
      showToast('เกิดข้อผิดพลาด', 'error')
    } finally {
      setProcessing(null)
    }
  }

  if (!canManage) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-800 font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          <p className="text-red-600 text-sm mt-1">เฉพาะ HR และ Admin เท่านั้น</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const totalPending = pendingRecords.length + overtimeRecords.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">จัดการการเช็คเอาท์</h1>
        <p className="text-gray-600 mt-1">
          อนุมัติการเช็คเอาท์สำหรับพนักงานที่ลืมเช็คเอาท์หรือทำ OT
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">รอดำเนินการ</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalPending}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ลืมเช็คเอาท์</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{pendingRecords.length}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">รออนุมัติ OT</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{overtimeRecords.length}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Checkouts Section */}
      {pendingRecords.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              พนักงานลืมเช็คเอาท์
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              พนักงานที่ลืมเช็คเอาท์เกิน 12 ชั่วโมง
            </p>
          </div>
          <div className="p-6">
            <PendingCheckouts
              records={pendingRecords}
              onApprove={handleApproveCheckout}
              processing={processing}
              type="forgot"
            />
          </div>
        </div>
      )}

      {/* Overtime Approvals Section */}
      {overtimeRecords.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-500" />
              รออนุมัติทำงานล่วงเวลา
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              พนักงานที่ทำงานเกินเวลาปิดมากกว่า 1 ชั่วโมง
            </p>
          </div>
          <div className="p-6">
            <PendingCheckouts
              records={overtimeRecords}
              onApprove={handleApproveCheckout}
              processing={processing}
              type="overtime"
            />
          </div>
        </div>
      )}

      {/* Empty State */}
      {totalPending === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ไม่มีรายการรอดำเนินการ
            </h3>
            <p className="text-gray-600">
              พนักงานทุกคนเช็คเอาท์เรียบร้อยแล้ว
            </p>
          </div>
        </div>
      )}
    </div>
  )
}