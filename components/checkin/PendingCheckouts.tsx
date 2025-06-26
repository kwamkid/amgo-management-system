// components/checkin/PendingCheckouts.tsx

'use client'

import { useState } from 'react'
import { CheckInRecord } from '@/types/checkin'
import { 
  Clock, 
  MapPin, 
  Calendar,
  Check,
  X,
  AlertTriangle,
  MessageSquare,
  Loader2
} from 'lucide-react'
import { format, differenceInHours } from 'date-fns'
import { th } from 'date-fns/locale'
import { formatWorkingHours } from '@/lib/services/workingHoursService'

interface PendingCheckoutsProps {
  records: CheckInRecord[]
  onApprove: (
    record: CheckInRecord, 
    checkoutTime: Date, 
    reason: string,
    approveOvertime: boolean
  ) => Promise<void>
  processing: string | null
  type: 'forgot' | 'overtime'
}

export default function PendingCheckouts({ 
  records, 
  onApprove, 
  processing,
  type 
}: PendingCheckoutsProps) {
  const [selectedRecord, setSelectedRecord] = useState<CheckInRecord | null>(null)
  const [checkoutTime, setCheckoutTime] = useState('')
  const [reason, setReason] = useState('')
  const [approveOT, setApproveOT] = useState(true)
  const [showReasonModal, setShowReasonModal] = useState(false)

  const handleSelectRecord = (record: CheckInRecord) => {
    setSelectedRecord(record)
    
    // Set default checkout time
    if (type === 'forgot') {
      // Default to 18:00 on the same day
      const checkinDate = new Date(record.checkinTime)
      checkinDate.setHours(18, 0, 0, 0)
      setCheckoutTime(format(checkinDate, "yyyy-MM-dd'T'HH:mm"))
    } else {
      // Use actual checkout time
      const checkoutDate = record.checkoutTime 
        ? new Date(record.checkoutTime) 
        : new Date()
      setCheckoutTime(format(checkoutDate, "yyyy-MM-dd'T'HH:mm"))
    }
    
    setReason('')
    setApproveOT(true)
    setShowReasonModal(true)
  }

  const handleSubmit = async () => {
    if (!selectedRecord || !checkoutTime || !reason.trim()) {
      return
    }
    
    await onApprove(
      selectedRecord,
      new Date(checkoutTime),
      reason,
      approveOT
    )
    
    setShowReasonModal(false)
    setSelectedRecord(null)
  }

  const getHoursSinceCheckin = (record: CheckInRecord) => {
    const checkinTime = record.checkinTime instanceof Date 
      ? record.checkinTime 
      : new Date(record.checkinTime)
    return differenceInHours(new Date(), checkinTime)
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">ไม่มีรายการ</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {records.map((record) => {
          const checkinTime = record.checkinTime instanceof Date 
            ? record.checkinTime 
            : new Date(record.checkinTime)
          const hoursSince = getHoursSinceCheckin(record)
          
          return (
            <div
              key={record.id}
              className={`bg-gray-50 rounded-xl p-4 border-2 ${
                type === 'forgot' 
                  ? 'border-orange-200' 
                  : 'border-purple-200'
              }`}
            >
              {/* Employee Info */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {record.userAvatar ? (
                    <img
                      src={record.userAvatar}
                      alt={record.userName}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-300 rounded-full" />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">{record.userName}</p>
                    <p className="text-sm text-gray-600">
                      {type === 'forgot' 
                        ? `ลืมเช็คเอาท์ ${hoursSince} ชั่วโมง`
                        : 'ทำงานเกินเวลาปิด'
                      }
                    </p>
                  </div>
                </div>
                
                {/* Quick Actions for Mobile */}
                <button
                  onClick={() => handleSelectRecord(record)}
                  disabled={processing === record.id}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    type === 'forgot'
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : 'bg-purple-500 text-white hover:bg-purple-600'
                  } disabled:opacity-50`}
                >
                  {processing === record.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'จัดการ'
                  )}
                </button>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{format(checkinTime, 'dd MMM yyyy', { locale: th })}</span>
                </div>
                
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>เข้า {format(checkinTime, 'HH:mm')}</span>
                </div>
                
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{record.primaryLocationName || 'นอกสถานที่'}</span>
                </div>
                
                {record.selectedShiftName && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{record.selectedShiftName}</span>
                  </div>
                )}
              </div>

              {/* Note if any */}
              {record.note && (
                <div className="mt-3 p-3 bg-white rounded-lg">
                  <p className="text-sm text-gray-600">
                    <MessageSquare className="w-4 h-4 inline mr-1" />
                    {record.note}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Approval Modal */}
      {showReasonModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {type === 'forgot' ? 'กำหนดเวลาเช็คเอาท์' : 'อนุมัติการทำงานล่วงเวลา'}
            </h3>
            
            {/* Employee Info */}
            <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
              {selectedRecord.userAvatar ? (
                <img
                  src={selectedRecord.userAvatar}
                  alt={selectedRecord.userName}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 bg-gray-300 rounded-full" />
              )}
              <div>
                <p className="font-medium">{selectedRecord.userName}</p>
                <p className="text-sm text-gray-600">
                  เช็คอิน {format(new Date(selectedRecord.checkinTime), 'dd/MM HH:mm')}
                </p>
              </div>
            </div>

            {/* Checkout Time */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เวลาเช็คเอาท์
              </label>
              <input
                type="datetime-local"
                value={checkoutTime}
                onChange={(e) => setCheckoutTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* OT Approval (for overtime type) */}
            {type === 'overtime' && (
              <div className="mb-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={approveOT}
                    onChange={(e) => setApproveOT(e.target.checked)}
                    className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="font-medium">อนุมัติชั่วโมงทำงานล่วงเวลา</span>
                </label>
                <p className="text-sm text-gray-500 ml-8 mt-1">
                  {approveOT 
                    ? 'คิดชั่วโมงทำงานจริง' 
                    : 'คิดชั่วโมงถึงเวลาปิดเท่านั้น'
                  }
                </p>
              </div>
            )}

            {/* Reason */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เหตุผล/หมายเหตุ *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  type === 'forgot' 
                    ? 'เช่น ลืมเช็คเอาท์, ระบบขัดข้อง...'
                    : 'เช่น Midnight Sale, ปรับปรุงพื้นที่...'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 resize-none"
                rows={3}
                required
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowReasonModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason.trim() || processing === selectedRecord.id}
                className={`flex-1 px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 ${
                  type === 'forgot'
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-purple-500 hover:bg-purple-600'
                }`}
              >
                {processing === selectedRecord.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังบันทึก...
                  </span>
                ) : (
                  'บันทึก'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}