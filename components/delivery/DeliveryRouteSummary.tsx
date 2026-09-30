'use client'

import { useState } from 'react'
import { DeliveryPoint } from '@/types/delivery'
import { formatTime, formatDate } from '@/lib/utils/date'
import { formatDistance } from '@/lib/utils/location'
import {
  Clock,
  Package,
  TrendingUp,
  Navigation,
  Share2,
  CheckCircle,
  ArrowDownToLine,
  ArrowUpFromLine
} from 'lucide-react'
import { Progress, Pill, Card, CardContent, CardHeader, CardTitle, Button, Modal } from '@/components/aoo'
import { StatCard, InfoPanel, ListRows, ListRow } from '@/components/shared'
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
      <Card padding={0}>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle icon={TrendingUp} tone="sky">สรุปเส้นทางประจำวัน</CardTitle>
          <div className="flex gap-2">
            <Button variant="soft" size="sm" onClick={() => setShowShareDialog(true)}>
              <Share2 className="w-4 h-4" />
              แชร์
            </Button>
            <Button variant="soft" size="sm" icon="Download" onClick={exportToCSV}>
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="จุดทั้งหมด" value={deliveries.length} icon={Package} tone="accent" />
            <StatCard label="รับของ" value={pickupCount} icon={ArrowDownToLine} tone="sky" />
            <StatCard label="ส่งของ" value={deliveryCount} icon={ArrowUpFromLine} tone="success" />
            <StatCard label="สำเร็จ" value="100%" icon={CheckCircle} tone="grape" />
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <CardTitle icon={Clock} tone="grape">เวลาทำงาน</CardTitle>

            <InfoPanel className="space-y-3">
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
            </InfoPanel>
          </div>

          {/* Route Summary */}
          <div className="space-y-3">
            <CardTitle icon={Navigation} tone="accent">เส้นทาง</CardTitle>

            <InfoPanel>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">ระยะทางโดยประมาณ</span>
                <span className="font-medium">{estimatedDistance} กม.</span>
              </div>

              <ListRows variant="divided">
                {sortedByTime.slice(0, 3).map((delivery, index) => (
                  <ListRow
                    key={delivery.id}
                    leading={<Pill tone="neutral">{index + 1}</Pill>}
                    title={formatTime(delivery.checkInTime)}
                    meta={delivery.customerName || undefined}
                    trailing={
                      <Pill tone={delivery.deliveryType === 'pickup' ? 'info' : 'neutral'}>
                        {delivery.deliveryType === 'pickup' ? 'รับ' : 'ส่ง'}
                      </Pill>
                    }
                  />
                ))}
              </ListRows>

              {sortedByTime.length > 3 && (
                <p className="text-center text-sm text-gray-500 pt-2">
                  และอีก {sortedByTime.length - 3} จุด...
                </p>
              )}
            </InfoPanel>
          </div>

          {/* Success Badge */}
          <div className="flex items-center justify-center pt-4">
            <Pill tone="success">
              <CheckCircle className="w-4 h-4" />
              ส่งครบทุกจุด สำเร็จ 100%
            </Pill>
          </div>
        </CardContent>
      </Card>

      {/* Share Dialog */}
      <Modal open={showShareDialog} onClose={() => setShowShareDialog(false)} title={<>แชร์สรุปประจำวัน</>}>
        <div className="space-y-4">
          <InfoPanel>
            <pre className="text-sm whitespace-pre-wrap font-sans">
              {generateSummaryText()}
            </pre>
          </InfoPanel>

          <div className="flex gap-2">
            <Button onClick={shareToLine} className="flex-1">
              แชร์ผ่าน LINE
            </Button>
            <Button
              variant="soft"
              icon="Copy"
              onClick={() => {
                navigator.clipboard.writeText(generateSummaryText())
                setShowShareDialog(false)
              }}
            >
              คัดลอก
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
