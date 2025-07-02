'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useDeliveryPoints } from '@/hooks/useDelivery'
import { DeliveryFilters, DeliveryPoint } from '@/types/delivery'
import { formatDate, formatTime } from '@/lib/utils/date'
import { 
  MapPin, 
  Package, 
  Calendar,
  Clock,
  Navigation,
  Image as ImageIcon
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import TechLoader from '@/components/shared/TechLoader'
import { createNavigationUrl, getAddressFromCoords } from '@/lib/utils/location'
import { useJsApiLoader } from '@react-google-maps/api'

const libraries: ("places")[] = ['places']

export default function DeliveryHistoryPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [addresses, setAddresses] = useState<Record<string, string>>({})

  // Load Google Maps for geocoding
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
    id: 'google-map-script'
  })

  // Prepare filters with useMemo to prevent infinite loop
  const filters: DeliveryFilters = useMemo(() => ({
    date: selectedDate
  }), [selectedDate])

  const { deliveryPoints, loading, hasMore, loadMore } = useDeliveryPoints(filters)

  // Check permission
  useEffect(() => {
    if (userData && userData.role !== 'driver' && userData.role !== 'admin' && userData.role !== 'hr') {
      router.push('/unauthorized')
    }
  }, [userData, router])

  // Get addresses for all points
  useEffect(() => {
    if (isLoaded && deliveryPoints.length > 0) {
      deliveryPoints.forEach(async (point) => {
        if (!point.address && !addresses[point.id!]) {
          try {
            const address = await getAddressFromCoords(point.lat, point.lng)
            setAddresses(prev => ({ ...prev, [point.id!]: address }))
          } catch (error) {
            console.error('Error getting address:', error)
          }
        }
      })
    }
  }, [isLoaded, deliveryPoints])

  const DeliveryCard = ({ delivery }: { delivery: DeliveryPoint }) => {
    const displayAddress = delivery.address || addresses[delivery.id!] || 'กำลังโหลดที่อยู่...'

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex gap-4">
            {/* Thumbnail */}
            {delivery.photo && (
              <div className="flex-shrink-0">
                <img
                  src={delivery.photo.thumbnailUrl || delivery.photo.url}
                  alt="Delivery"
                  className="w-20 h-20 object-cover rounded-lg cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(delivery.photo!.url, '_blank')
                  }}
                />
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Top row - Time and Note */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-base font-medium text-gray-900">
                  {formatTime(delivery.checkInTime)}
                </span>
                
                {delivery.note && (
                  <span className="text-base text-gray-500 truncate max-w-[300px]">
                    {delivery.note}
                  </span>
                )}
              </div>

              {/* Bottom row - Address and Navigation */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-base text-gray-600 flex-1 min-w-0">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">
                    {displayAddress}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(createNavigationUrl(delivery.lat, delivery.lng), '_blank')
                  }}
                >
                  <Navigation className="w-4 h-4 mr-1" />
                  นำทาง
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return <TechLoader />
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ประวัติการส่งของ</h1>
        <p className="text-gray-600 mt-1">ดูรายละเอียดการรับ-ส่งสินค้าทั้งหมด</p>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <Label htmlFor="date" className="text-base font-medium whitespace-nowrap">
                เลือกวันที่:
              </Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="max-w-[200px]"
              />
            </div>
            
            <div className="text-base text-gray-600">
              พบ {deliveryPoints.length} รายการ
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deliveries List */}
      <div className="space-y-3">
        {deliveryPoints.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-base text-gray-600">ไม่พบข้อมูลการส่งของ</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {deliveryPoints.map((delivery) => (
              <DeliveryCard key={delivery.id} delivery={delivery} />
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="text-center pt-4">
                <Button
                  onClick={loadMore}
                  variant="outline"
                  disabled={loading}
                >
                  {loading ? 'กำลังโหลด...' : 'โหลดเพิ่มเติม'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}