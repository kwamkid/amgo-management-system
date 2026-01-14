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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { gradients } from '@/lib/theme/colors'

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
            <Card
              key={record.id}
              className={`border-2 ${
                type === 'forgot' 
                  ? 'border-orange-200' 
                  : 'border-purple-200'
              }`}
            >
              <CardContent className="p-4">
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
                  <Button
                    onClick={() => handleSelectRecord(record)}
                    disabled={processing === record.id}
                    variant={type === 'forgot' ? 'outline' : 'secondary'}
                    className={type === 'forgot' 
                      ? 'border-orange-500 text-orange-600 hover:bg-orange-50' 
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }
                  >
                    {processing === record.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'จัดการ'
                    )}
                  </Button>
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
                      <span>{record.primaryLocationName || 'เช็คอินนอกสถานที่'}</span>
                    </div>
                    
                    {/* แสดงข้อมูลกะ */}
                    {record.selectedShiftName ? (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{record.selectedShiftName}</span>
                      </div>
                    ) : (
                      <div /> // Empty cell for grid alignment
                    )}
                  </div>

                {/* Note if any */}
                {record.note && (
                  <Card className="mt-3 border-gray-100">
                    <CardContent className="p-3">
                      <p className="text-sm text-gray-600">
                        <MessageSquare className="w-4 h-4 inline mr-1" />
                        {record.note}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Approval Modal */}
      {showReasonModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {type === 'forgot' ? 'กำหนดเวลาเช็คเอาท์' : 'อนุมัติการทำงานล่วงเวลา'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Employee Info */}
              <Card className={`bg-gradient-to-r ${gradients.grayLight} border-0`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
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
                </CardContent>
              </Card>

              {/* Checkout Time */}
              <div className="space-y-2">
                <Label>เวลาเช็คเอาท์</Label>
                <Input
                  type="datetime-local"
                  value={checkoutTime}
                  onChange={(e) => setCheckoutTime(e.target.value)}
                />
              </div>

              {/* OT Approval (for overtime type) */}
              {type === 'overtime' && (
                <Card className="border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="approveOT"
                        checked={approveOT}
                        onCheckedChange={(checked) => setApproveOT(checked as boolean)}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="approveOT" className="font-medium cursor-pointer">
                          อนุมัติชั่วโมงทำงานล่วงเวลา
                        </Label>
                        <p className="text-sm text-gray-500">
                          {approveOT 
                            ? 'คิดชั่วโมงทำงานจริง' 
                            : 'คิดชั่วโมงถึงเวลาปิดเท่านั้น'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label>เหตุผล/หมายเหตุ *</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    type === 'forgot' 
                      ? 'เช่น ลืมเช็คเอาท์, ระบบขัดข้อง...'
                      : 'เช่น Midnight Sale, ปรับปรุงพื้นที่...'
                  }
                  rows={3}
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowReasonModal(false)}
                  className="flex-1"
                >
                  ยกเลิก
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!reason.trim() || processing === selectedRecord.id}
                  className={`flex-1 ${
                    type === 'forgot'
                      ? `bg-gradient-to-r ${gradients.warning}`
                      : `bg-gradient-to-r ${gradients.purple}`
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
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}