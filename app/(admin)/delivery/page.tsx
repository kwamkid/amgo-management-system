// app/(admin)/delivery/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/shared'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { formatTime } from '@/lib/utils/date'
import { 
  MapPin, 
  Package, 
  Truck,
  Clock,
  CheckCircle,
  Camera,
  ArrowRight,
  Calendar,
  Users,
  User
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import TechLoader from '@/components/shared/TechLoader'
import { getDeliveryPoints } from '@/lib/services/deliveryService'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SelectMenu } from '@/components/aoo'

export default function DeliveryDashboardPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const [loading, setLoading] = useState(true)
  const [deliveryPoints, setDeliveryPoints] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'mine' | 'all'>('mine') // เพิ่ม state สำหรับ view mode

  // Check permission
  useEffect(() => {
    if (userData && userData.role !== 'driver' && userData.role !== 'admin' && userData.role !== 'hr') {
      router.push('/unauthorized')
    }
  }, [userData, router])

  // Fetch data
  useEffect(() => {
    const fetchDeliveryPoints = async () => {
      if (!userData?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        
        // service คืนวันที่เป็น Date มาแล้ว และกรองคนขับให้ในคำสั่งเดียว
        const today = new Date().toISOString().slice(0, 10)
        const { points } = await getDeliveryPoints(
          {
            date: today,
            driverId:
              viewMode === 'mine' && userData.role === 'driver' ? userData.id : undefined,
          },
          500
        )

        setDeliveryPoints(points)
      } catch (error) {
        console.error('Error fetching delivery points:', error)
        setDeliveryPoints([])
      } finally {
        setLoading(false)
      }
    }

    if (userData) {
      fetchDeliveryPoints()
    }
  }, [userData?.id, userData?.role, viewMode]) // เพิ่ม viewMode ใน dependencies

  // คำนวณสถิติ
  const totalPoints = deliveryPoints.length
  const completedPoints = deliveryPoints.filter(d => d.deliveryStatus === 'completed').length
  const pendingPoints = deliveryPoints.filter(d => d.deliveryStatus === 'pending').length

  // หาเวลาเริ่มและสิ้นสุด
  const sortedByTime = [...deliveryPoints].sort((a, b) => 
    new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
  )
  const firstDelivery = sortedByTime[0]
  const lastDelivery = sortedByTime[sortedByTime.length - 1]

  if (loading) {
    return <TechLoader />
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="สรุปการส่งของวันนี้"
        description={new Date().toLocaleDateString('th-TH', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
        icon={Truck}
        actions={
          // คนขับเลือกดูเฉพาะงานตัวเอง หรือของทุกคน
          userData?.role === 'driver' ? (
            <div className="w-44">
              <SelectMenu
                size="md"
                value={viewMode}
                searchThreshold={99}
                onChange={(v) => v && setViewMode(v as 'mine' | 'all')}
                options={[
                  { value: 'mine', label: 'เฉพาะของฉัน' },
                  { value: 'all', label: 'ทั้งหมด' },
                ]}
              />
            </div>
          ) : undefined
        }
      />

      {/* Quick Action */}
      <Link href="/delivery/checkin">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-red-200 bg-gradient-to-r from-red-50 to-rose-50 mb-6">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <Camera className="w-8 h-8 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">เช็คอินจุดส่งของ</h3>
                  <p className="text-base text-gray-600 mt-1">บันทึกการรับ-ส่งสินค้า</p>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base text-gray-600">จุดทั้งหมด</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{totalPoints}</p>
              </div>
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base text-gray-600">สำเร็จ</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{completedPoints}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base text-gray-600">รอดำเนินการ</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">{pendingPoints}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Working Time */}
      {totalPoints > 0 && firstDelivery && lastDelivery && viewMode === 'mine' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">ข้อมูลการทำงาน</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-base text-gray-600">เวลาทำงาน</span>
              <div className="text-right">
                <span className="text-base font-medium">
                  {formatTime(firstDelivery.checkInTime)} - {formatTime(lastDelivery.checkInTime)}
                </span>
                <p className="text-sm text-gray-500 mt-1">
                  {(() => {
                    const start = new Date(firstDelivery.checkInTime).getTime()
                    const end = new Date(lastDelivery.checkInTime).getTime()
                    const hours = Math.floor((end - start) / (1000 * 60 * 60))
                    const minutes = Math.floor(((end - start) % (1000 * 60 * 60)) / (1000 * 60))
                    return `รวม ${hours} ชั่วโมง ${minutes} นาที`
                  })()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Deliveries */}
      {totalPoints > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="w-5 h-5" />
              จุดส่งของล่าสุด {viewMode === 'all' && '(ทั้งหมด)'}
            </CardTitle>
            <Link href="/delivery/map">
              <Button variant="ghost" size="sm">
                ดูทั้งหมด
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deliveryPoints.slice(0, 5).map((point) => (
                <div key={point.id} className="flex items-center gap-4 pb-3 border-b last:border-0">
                  <div className="text-base text-gray-600 min-w-[60px]">
                    {formatTime(point.checkInTime)}
                  </div>
                  
                  <div className="flex-shrink-0">
                    {point.deliveryStatus === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-orange-500" />
                    )}
                  </div>

                  <div className="flex-1">
                    {/* แสดงชื่อ Driver ถ้าดูแบบ All */}
                    {viewMode === 'all' && point.driverName && (
                      <p className="text-sm text-gray-500">
                        <User className="w-3 h-3 inline mr-1" />
                        {point.driverName}
                      </p>
                    )}
                    {point.customerName && (
                      <p className="text-base font-medium">{point.customerName}</p>
                    )}
                    <p className="text-sm text-gray-500 line-clamp-1">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {point.address || 'กำลังโหลดที่อยู่...'}
                    </p>
                  </div>

                  <Badge variant={point.deliveryType === 'pickup' ? 'info' : 'secondary'} className="text-sm">
                    {point.deliveryType === 'pickup' ? 'รับ' : 'ส่ง'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {totalPoints === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-base text-gray-600 mb-4">
              {viewMode === 'mine' ? 'ยังไม่มีการส่งของของคุณวันนี้' : 'ยังไม่มีการส่งของวันนี้'}
            </p>
            <Link href="/delivery/checkin">
              <Button>
                <Camera className="w-4 h-4 mr-2" />
                เริ่มเช็คอิน
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}