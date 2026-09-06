'use client'

import { useState } from 'react'
import { DeliveryPoint } from '@/types/delivery'
import { formatTime, formatDate } from '@/lib/utils/date'
import { formatDistance } from '@/lib/utils/location'
import { 
  Truck, 
  MapPin, 
  Clock,
  Package,
  TrendingUp,
  Calendar,
  Navigation,
  Download,
  Share2,
  CheckCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { Progress } from '@/components/aoo'
interface DeliveryRouteSummaryProps {
  deliveries: DeliveryPoint[]
  date: string
  driverName: string
}

export default function DeliveryRouteSummary({ 
  deliveries, 
  date,
  driverName 
}: DeliveryRouteSummaryProps) {
  const [showShareDialog, setShowShareDialog] = useState(false)

  // คำนวณสถิติ
  const pickupCount = deliveries.filter(d => d.deliveryType === 'pickup').length
  const deliveryCount = deliveries.filter(d => d.deliveryType === 'delivery').length
  
  // หาเวลาเริ่มและสิ้นสุด
  const sortedByTime = [...deliveries].sort((a, b) => 
    new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
  )
  const firstDelivery = sortedByTime[0]
  const lastDelivery = sortedByTime[sortedByTime.length - 1]
  
  // คำนวณระยะเวลาทำงาน
  const workDuration = firstDelivery && lastDelivery ? 
    Math.round((new Date(lastDelivery.checkInTime).getTime() - 
    new Date(firstDelivery.checkInTime).getTime()) / (1000 * 60)) : 0
  
  const workHours = Math.floor(workDuration / 60)
  const workMinutes = workDuration % 60

  // คำนวณระยะทางโดยประมาณ (ถ้ามีข้อมูล)
  const estimatedDistance = deliveries.length * 5 // ประมาณ 5 กม. ต่อจุด

  // สร้างข้อความสรุป
  const generateSummaryText = () => {
    return `📊 สรุปการส่งของประจำวัน
📅 วันที่: ${formatDate(date)}
👤 พนักงาน: ${driverName}

📦 จำนวนจุดทั้งหมด: ${deliveries.length} จุด
- รับของ: ${pickupCount} จุด
- ส่งของ: ${deliveryCount} จุด

⏰ เวลาทำงาน: ${workHours} ชั่วโมง ${workMinutes} นาที
- เริ่ม: ${firstDelivery ? formatTime(firstDelivery.checkInTime) : '-'}
- สิ้นสุด: ${lastDelivery ? formatTime(lastDelivery.checkInTime) : '-'}

📍 ระยะทางโดยประมาณ: ${estimatedDistance} กม.

✅ สำเร็จทุกจุด!`
  }

  // แชร์ผ่าน LINE
  const shareToLine = () => {
    const text = encodeURIComponent(generateSummaryText())
    window.open(`https://line.me/R/msg/text/?${text}`, '_blank')
  }

  // Export เป็น CSV
  const exportToCSV = () => {
    const headers = ['ลำดับ', 'เวลา', 'ประเภท', 'ชื่อลูกค้า', 'เบอร์โทร', 'ออเดอร์', 'ที่อยู่']
    
    const rows = deliveries.map((d, index) => [
      index + 1,
      formatTime(d.checkInTime),
      d.deliveryType === 'pickup' ? 'รับของ' : 'ส่งของ',
      d.customerName || '-',
      d.customerPhone || '-',
      d.orderNumber || '-',
      d.address || `${d.lat.toFixed(6)}, ${d.lng.toFixed(6)}`
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `delivery-summary-${date}.csv`
    link.click()
  }

  if (deliveries.length === 0) {
    return null
  }

  return (
    <>
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              สรุปเส้นทางประจำวัน
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShareDialog(true)}
              >
                <Share2 className="w-4 h-4 mr-2" />
                แชร์
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">{deliveries.length}</div>
              <p className="text-sm text-gray-600 mt-1">จุดทั้งหมด</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{pickupCount}</div>
              <p className="text-sm text-gray-600 mt-1">รับของ</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{deliveryCount}</div>
              <p className="text-sm text-gray-600 mt-1">ส่งของ</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">100%</div>
              <p className="text-sm text-gray-600 mt-1">สำเร็จ</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              เวลาทำงาน
            </h4>
            
            <div className="bg-white rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">เริ่มงาน</span>
                <span className="font-medium">
                  {firstDelivery ? formatTime(firstDelivery.checkInTime) : '-'}
                </span>
              </div>
              
              <div className="relative">
                <Progress value={100} className="h-2" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-700">
                    {workHours} ชม. {workMinutes} นาที
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">เลิกงาน</span>
                <span className="font-medium">
                  {lastDelivery ? formatTime(lastDelivery.checkInTime) : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Route Summary */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              เส้นทาง
            </h4>
            
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">ระยะทางโดยประมาณ</span>
                <span className="font-medium">{estimatedDistance} กม.</span>
              </div>
              
              <div className="space-y-2">
                {sortedByTime.slice(0, 3).map((delivery, index) => (
                  <div key={delivery.id} className="flex items-start gap-3 text-sm">
                    <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-xs">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatTime(delivery.checkInTime)}</span>
                        <Badge variant={delivery.deliveryType === 'pickup' ? 'info' : 'secondary'} className="text-xs">
                          {delivery.deliveryType === 'pickup' ? 'รับ' : 'ส่ง'}
                        </Badge>
                      </div>
                      {delivery.customerName && (
                        <p className="text-gray-600">{delivery.customerName}</p>
                      )}
                    </div>
                  </div>
                ))}
                
                {sortedByTime.length > 3 && (
                  <p className="text-center text-sm text-gray-500 pt-2">
                    และอีก {sortedByTime.length - 3} จุด...
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Success Badge */}
          <div className="flex items-center justify-center pt-4">
            <Badge variant="success" className="text-base px-4 py-2 gap-2">
              <CheckCircle className="w-5 h-5" />
              ส่งครบทุกจุด สำเร็จ 100%
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แชร์สรุปประจำวัน</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm whitespace-pre-wrap font-sans">
                {generateSummaryText()}
              </pre>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={shareToLine}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                แชร์ผ่าน LINE
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(generateSummaryText())
                  setShowShareDialog(false)
                }}
              >
                คัดลอก
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}