'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useDeliveryMap } from '@/hooks/useDelivery'
import { DeliveryMapPoint } from '@/types/delivery'
import { formatTime } from '@/lib/utils/date'
import { 
  MapPin, 
  Package, 
  Calendar,
  Navigation,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { GoogleMap, Marker, Polyline, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import TechLoader from '@/components/shared/TechLoader'

const mapContainerStyle = {
  width: '100%',
  height: '100%'
}

const defaultCenter = {
  lat: 13.7563, // Bangkok
  lng: 100.5018
}

const libraries: ("places")[] = ['places']

// Custom marker icons
const createMarkerIcon = (color: string, label?: string) => ({
  path: google.maps.SymbolPath.CIRCLE,
  fillColor: color,
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 2,
  scale: label ? 10 : 8,
  labelOrigin: label ? new google.maps.Point(0, 0) : undefined
})

export default function DeliveryMapPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedPoint, setSelectedPoint] = useState<DeliveryMapPoint | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [showRoute, setShowRoute] = useState(true)

  const { mapPoints, loading } = useDeliveryMap(selectedDate)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
    id: 'google-map-script'
  })

  // Check permission
  useEffect(() => {
    if (userData && userData.role !== 'driver' && userData.role !== 'admin' && userData.role !== 'hr') {
      router.push('/unauthorized')
    }
  }, [userData, router])

  // Fit map to show all points
  useEffect(() => {
    if (map && mapPoints.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      mapPoints.forEach(point => {
        bounds.extend({ lat: point.lat, lng: point.lng })
      })
      map.fitBounds(bounds)
      
      // Add padding
      const padding = { top: 50, right: 50, bottom: 50, left: 350 } // Left padding for sidebar
      map.fitBounds(bounds, padding)
    }
  }, [map, mapPoints])

  // Navigate between dates
  const changeDate = (days: number) => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + days)
    if (date <= new Date()) {
      setSelectedDate(date.toISOString().split('T')[0])
    }
  }

  // Get marker color based on status
  const getMarkerColor = (point: DeliveryMapPoint) => {
    switch (point.deliveryStatus) {
      case 'completed':
        return '#10B981' // green
      case 'failed':
        return '#EF4444' // red
      default:
        return '#F59E0B' // yellow
    }
  }

  // Create route path
  const routePath = mapPoints.map(point => ({
    lat: point.lat,
    lng: point.lng
  }))

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="p-8">
          <p className="text-red-600">Error loading map</p>
        </Card>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <TechLoader />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">แผนที่การส่งของ</h2>
          
          {/* Date Navigation */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => changeDate(-1)}
              disabled={loading}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="flex-1"
            />
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => changeDate(1)}
              disabled={loading || selectedDate === new Date().toISOString().split('T')[0]}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="text-center p-2 bg-gray-50 rounded">
              <p className="text-xs text-gray-600">ทั้งหมด</p>
              <p className="text-lg font-bold">{mapPoints.length}</p>
            </div>
            <div className="text-center p-2 bg-green-50 rounded">
              <p className="text-xs text-green-600">สำเร็จ</p>
              <p className="text-lg font-bold text-green-600">
                {mapPoints.filter(p => p.deliveryStatus === 'completed').length}
              </p>
            </div>
            <div className="text-center p-2 bg-red-50 rounded">
              <p className="text-xs text-red-600">ไม่สำเร็จ</p>
              <p className="text-lg font-bold text-red-600">
                {mapPoints.filter(p => p.deliveryStatus === 'failed').length}
              </p>
            </div>
          </div>

          {/* Show Route Toggle */}
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRoute(!showRoute)}
              className="w-full"
            >
              <Navigation className="w-4 h-4 mr-2" />
              {showRoute ? 'ซ่อนเส้นทาง' : 'แสดงเส้นทาง'}
            </Button>
          </div>
        </div>

        {/* Points List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : mapPoints.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">ไม่พบข้อมูลการส่งของ</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mapPoints.map((point, index) => (
                <Card
                  key={point.id}
                  className={`cursor-pointer transition-all ${
                    selectedPoint?.id === point.id ? 'ring-2 ring-red-500' : 'hover:shadow-md'
                  }`}
                  onClick={() => {
                    setSelectedPoint(point)
                    if (map) {
                      map.panTo({ lat: point.lat, lng: point.lng })
                      map.setZoom(17)
                    }
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Sequence Number */}
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">{point.sequence}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Time and Status */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">
                            {formatTime(point.checkInTime)}
                          </span>
                          {point.deliveryStatus === 'completed' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : point.deliveryStatus === 'failed' ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <Clock className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>

                        {/* Type */}
                        <div className="flex items-center gap-2 mb-1">
                          {point.deliveryType === 'pickup' ? (
                            <Badge variant="info" className="text-xs">
                              <Package className="w-3 h-3 mr-1" />
                              รับของ
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <Truck className="w-3 h-3 mr-1" />
                              ส่งของ
                            </Badge>
                          )}
                        </div>

                        {/* Customer */}
                        {point.customerName && (
                          <p className="text-sm text-gray-700 font-medium truncate">
                            {point.customerName}
                          </p>
                        )}

                        {/* Address */}
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {point.address || `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapPoints.length > 0 ? { lat: mapPoints[0].lat, lng: mapPoints[0].lng } : defaultCenter}
          zoom={13}
          onLoad={setMap}
          options={{
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
            zoomControl: true
          }}
        >
          {/* Route Line */}
          {showRoute && routePath.length > 1 && (
            <Polyline
              path={routePath}
              options={{
                strokeColor: '#3B82F6',
                strokeOpacity: 0.6,
                strokeWeight: 4,
                geodesic: true
              }}
            />
          )}

          {/* Markers */}
          {mapPoints.map((point, index) => (
            <Marker
              key={point.id}
              position={{ lat: point.lat, lng: point.lng }}
              icon={{
                ...createMarkerIcon(getMarkerColor(point)),
                scale: selectedPoint?.id === point.id ? 12 : 8
              }}
              label={{
                text: point.sequence?.toString() || (index + 1).toString(),
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
              onClick={() => setSelectedPoint(point)}
            />
          ))}

          {/* Info Window */}
          {selectedPoint && (
            <InfoWindow
              position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
              onCloseClick={() => setSelectedPoint(null)}
            >
              <div className="p-2 min-w-[200px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">จุดที่ {selectedPoint.sequence}</span>
                  {selectedPoint.deliveryStatus === 'completed' ? (
                    <Badge variant="success" className="text-xs">สำเร็จ</Badge>
                  ) : selectedPoint.deliveryStatus === 'failed' ? (
                    <Badge variant="error" className="text-xs">ไม่สำเร็จ</Badge>
                  ) : (
                    <Badge variant="warning" className="text-xs">รอดำเนินการ</Badge>
                  )}
                </div>
                
                <p className="text-sm text-gray-600 mb-1">
                  เวลา: {formatTime(selectedPoint.checkInTime)}
                </p>
                
                {selectedPoint.customerName && (
                  <p className="text-sm font-medium mb-1">{selectedPoint.customerName}</p>
                )}
                
                <p className="text-xs text-gray-500 line-clamp-2">
                  {selectedPoint.address || 'ไม่ระบุที่อยู่'}
                </p>

                <div className="mt-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedPoint.lat},${selectedPoint.lng}`
                      window.open(url, '_blank')
                    }}
                  >
                    <Navigation className="w-3 h-3 mr-1" />
                    นำทาง
                  </Button>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {/* Map Legend */}
        <Card className="absolute bottom-4 right-4 w-48">
          <CardContent className="p-3">
            <h4 className="text-sm font-medium mb-2">สัญลักษณ์</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                <span className="text-xs">รอดำเนินการ</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="text-xs">ส่งสำเร็จ</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span className="text-xs">ส่งไม่สำเร็จ</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}