'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useTodayDeliverySummary, useDeliveryPoints } from '@/hooks/useDelivery'
import { DeliveryPoint } from '@/types/delivery'
import { formatTime, formatDate } from '@/lib/utils/date'
import { 
  MapPin, 
  Package, 
  Truck,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  ArrowRight,
  Camera,
  Navigation,
  Phone,
  User,
  Hash,
  AlertCircle,
  Activity
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import TechLoader from '@/components/shared/TechLoader'
import DeliveryRouteSummary from '@/components/delivery/DeliveryRouteSummary'

export default function DeliveryDashboardPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { summary, loading: summaryLoading } = useTodayDeliverySummary()
  const { deliveryPoints, loading: pointsLoading } = useDeliveryPoints({
    date: new Date().toISOString().split('T')[0]
  })

  // Check permission
  useEffect(() => {
    if (userData && userData.role !== 'driver' && userData.role !== 'admin' && userData.role !== 'hr') {
      router.push('/unauthorized')
    }
  }, [userData, router])

  // Calculate stats
  const pendingCount = deliveryPoints.filter(d => d.deliveryStatus === 'pending').length
  const completedCount = deliveryPoints.filter(d => d.deliveryStatus === 'completed').length
  const failedCount = deliveryPoints.filter(d => d.deliveryStatus === 'failed').length
  const successRate = deliveryPoints.length > 0 
    ? Math.round((completedCount / deliveryPoints.length) * 100) 
    : 0

  // Get recent deliveries
  const recentDeliveries = deliveryPoints.slice(0, 5)

  // Check if any pending deliveries
  const hasPendingDeliveries = pendingCount > 0

  const loading = summaryLoading || pointsLoading

  if (loading) {
    return <TechLoader />
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Tracking</h1>
          <p className="text-gray-600 mt-1">ระบบติดตามการรับ-ส่งสินค้า</p>
        </div>
        <div className="text-sm text-gray-500">
          {formatDate(new Date())}
        </div>
      </div>

      {/* Alert for pending deliveries */}
      {hasPendingDeliveries && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            คุณมี {pendingCount} รายการที่ยังไม่ได้ดำเนินการ
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/delivery/checkin">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <Camera className="w-6 h-6 text-red-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900">เช็คอินจุดส่ง</h3>
              <p className="text-sm text-gray-600 mt-1">บันทึกการรับ-ส่งสินค้า</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/delivery/history">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900">ประวัติการส่ง</h3>
              <p className="text-sm text-gray-600 mt-1">ดูรายละเอียดย้อนหลัง</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/delivery/map">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900">แผนที่การส่ง</h3>
              <p className="text-sm text-gray-600 mt-1">ดูเส้นทางบนแผนที่</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Today's Summary */}
      {deliveryPoints.length > 0 && (
        <DeliveryRouteSummary 
          deliveries={deliveryPoints}
          date={new Date().toISOString().split('T')[0]}
          driverName={userData?.fullName || 'Driver'}
        />
      )}

      {/* Today's Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-gray-600" />
            สรุปประจำวันนี้
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Total */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-600">ทั้งหมด</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{deliveryPoints.length}</p>
              <p className="text-xs text-gray-500 mt-1">รายการ</p>
            </div>

            {/* Completed */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-gray-600">สำเร็จ</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{completedCount}</p>
              <p className="text-xs text-gray-500 mt-1">รายการ</p>
            </div>

            {/* Failed */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-sm text-gray-600">ไม่สำเร็จ</span>
              </div>
              <p className="text-3xl font-bold text-red-600">{failedCount}</p>
              <p className="text-xs text-gray-500 mt-1">รายการ</p>
            </div>

            {/* Pending */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-orange-500" />
                <span className="text-sm text-gray-600">รอดำเนินการ</span>
              </div>
              <p className="text-3xl font-bold text-orange-600">{pendingCount}</p>
              <p className="text-xs text-gray-500 mt-1">รายการ</p>
            </div>
          </div>

          {/* Success Rate */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">อัตราความสำเร็จ</span>
              <span className="text-sm font-bold text-gray-900">{successRate}%</span>
            </div>
            <Progress value={successRate} className="h-2" />
          </div>

          {/* Working Time */}
          {summary && summary.firstDeliveryTime && summary.lastDeliveryTime && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-gray-600">เวลาทำงาน</span>
              <span className="font-medium">
                {formatTime(summary.firstDeliveryTime)} - {formatTime(summary.lastDeliveryTime)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Deliveries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-gray-600" />
            การส่งล่าสุด
          </CardTitle>
          <Link href="/delivery/history">
            <Button variant="ghost" size="sm" className="gap-2">
              ดูทั้งหมด
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentDeliveries.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">ยังไม่มีการส่งวันนี้</p>
              <Link href="/delivery/checkin">
                <Button className="mt-4" size="sm">
                  <Camera className="w-4 h-4 mr-2" />
                  เริ่มเช็คอิน
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentDeliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {/* Time */}
                  <div className="text-sm text-gray-600 min-w-[60px]">
                    {formatTime(delivery.checkInTime)}
                  </div>

                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {delivery.deliveryStatus === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : delivery.deliveryStatus === 'failed' ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-orange-500" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {delivery.deliveryType === 'pickup' ? (
                        <Badge variant="info" className="text-xs">รับของ</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">ส่งของ</Badge>
                      )}
                      
                      {delivery.customerName && (
                        <span className="text-sm font-medium truncate">
                          {delivery.customerName}
                        </span>
                      )}
                    </div>

                    {delivery.orderNumber && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                        <Hash className="w-3 h-3" />
                        {delivery.orderNumber}
                      </div>
                    )}

                    <p className="text-xs text-gray-500 line-clamp-1">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {delivery.address || `${delivery.lat.toFixed(4)}, ${delivery.lng.toFixed(4)}`}
                    </p>

                    {delivery.failureReason && (
                      <p className="text-xs text-red-600 mt-1">
                        เหตุผล: {delivery.failureReason}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0">
                    {delivery.customerPhone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.location.href = `tel:${delivery.customerPhone}`}
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{successRate}%</p>
                <p className="text-xs text-gray-600">อัตราสำเร็จ</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-xs text-gray-600">ส่งสำเร็จวันนี้</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-xs text-gray-600">รอดำเนินการ</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{deliveryPoints.length}</p>
                <p className="text-xs text-gray-600">จุดส่งทั้งหมด</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}