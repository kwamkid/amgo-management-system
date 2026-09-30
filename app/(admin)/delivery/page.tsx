// app/(admin)/delivery/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { PageHeader, StatCard, ListRows, ListRow } from '@/components/shared'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { canSeeDelivery } from '@/lib/services/user/access'
import { formatTime } from '@/lib/utils/date'
import { 
  MapPin, 
  Package, 
  Truck,
  Clock,
  CheckCircle,
  Camera,
  ArrowRight,
  User
} from 'lucide-react'
import TechLoader from '@/components/shared/TechLoader'
import { getDeliveryPoints } from '@/lib/services/deliveryService'
import { SelectMenu, Pill, Card, CardContent, CardHeader, CardTitle, Button, EmptyState } from '@/components/aoo'
export default function DeliveryDashboardPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const [loading, setLoading] = useState(true)
  const [deliveryPoints, setDeliveryPoints] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'mine' | 'all'>('mine') // เพิ่ม state สำหรับ view mode

  // Check permission
  useEffect(() => {
    if (userData && !canSeeDelivery(userData)) {
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
        <Card hoverable className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle icon={Camera} tone="accent">เช็คอินจุดส่งของ</CardTitle>
              <p className="text-sm text-gray-500 mt-1">บันทึกการรับ-ส่งสินค้า</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </Card>
      </Link>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="จุดทั้งหมด" value={totalPoints} icon={Package} tone="sky" />
        <StatCard label="สำเร็จ" value={completedPoints} icon={CheckCircle} tone="success" />
        <StatCard label="รอดำเนินการ" value={pendingPoints} icon={Clock} tone="warning" />
      </div>

      {/* Working Time */}
      {totalPoints > 0 && firstDelivery && lastDelivery && viewMode === 'mine' && (
        <Card padding={0}>
          <CardHeader>
            <CardTitle icon={Clock} tone="grape">ข้อมูลการทำงาน</CardTitle>
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
        <Card padding={0}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle icon={Truck} tone="sky">
              จุดส่งของล่าสุด {viewMode === 'all' && '(ทั้งหมด)'}
            </CardTitle>
            <Link href="/delivery/map">
              <Button variant="ghost" size="sm" iconRight="ChevronRight">
                ดูทั้งหมด
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <ListRows variant="divided">
              {deliveryPoints.slice(0, 5).map((point) => (
                <ListRow
                  key={point.id}
                  leading={
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 min-w-[48px] tabular-nums">
                        {formatTime(point.checkInTime)}
                      </span>
                      {point.deliveryStatus === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-[var(--leaf-500)]" />
                      ) : (
                        <Clock className="w-5 h-5 text-[var(--sun-500)]" />
                      )}
                    </div>
                  }
                  title={point.customerName || point.address || 'กำลังโหลดที่อยู่...'}
                  meta={
                    <>
                      {/* แสดงชื่อ Driver ถ้าดูแบบ All */}
                      {viewMode === 'all' && point.driverName && (
                        <span className="block">
                          <User className="w-3 h-3 inline mr-1" />
                          {point.driverName}
                        </span>
                      )}
                      {point.customerName && (
                        <span className="line-clamp-1">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {point.address || 'กำลังโหลดที่อยู่...'}
                        </span>
                      )}
                    </>
                  }
                  trailing={
                    <Pill tone={point.deliveryType === 'pickup' ? 'info' : 'neutral'}>
                      {point.deliveryType === 'pickup' ? 'รับ' : 'ส่ง'}
                    </Pill>
                  }
                />
              ))}
            </ListRows>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {totalPoints === 0 && (
        <Card>
          <EmptyState
            icon={<Package size={40} />}
            title={viewMode === 'mine' ? 'ยังไม่มีการส่งของของคุณวันนี้' : 'ยังไม่มีการส่งของวันนี้'}
            action={
              <Link href="/delivery/checkin">
                <Button>
                  <Camera className="w-4 h-4" />
                  เริ่มเช็คอิน
                </Button>
              </Link>
            }
          />
        </Card>
      )}
    </div>
  )
}