'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useDeliveryMap } from '@/hooks/useDelivery'
import { DeliveryMapPoint } from '@/types/delivery'
import { formatTime } from '@/lib/utils/date'
import { 
  MapPin, 
  Calendar,
  Navigation,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Camera,
  X,
  Eye,
  Trash2,
  Search,
  User,
  Menu,
  Map as MapIcon
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import TechLoader from '@/components/shared/TechLoader'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/useToast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const mapContainerStyle = {
  width: '100%',
  height: '100%'
}

const defaultCenter = {
  lat: 13.7563, // Bangkok
  lng: 100.5018
}

const libraries: ("places")[] = ['places']

// Custom marker icon - ขนาดใหญ่ขึ้น
const createMarkerIcon = (label: string) => ({
  path: google.maps.SymbolPath.CIRCLE,
  fillColor: '#DC2626',
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 3,
  scale: 12, // เพิ่มขนาดจาก 10 เป็น 12
  labelOrigin: new google.maps.Point(0, 0)
})

export default function DeliveryMapPage() {
  const router = useRouter()
  const { userData } = useAuth()
  // Get local date string in YYYY-MM-DD format
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  const [selectedDate, setSelectedDate] = useState(getLocalDateString(new Date()))
  const [selectedPoint, setSelectedPoint] = useState<DeliveryMapPoint | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [showLightbox, setShowLightbox] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string>('')
  const [addressCache, setAddressCache] = useState<Record<string, string>>({})
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletePointId, setDeletePointId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showMobileList, setShowMobileList] = useState(false)
  const [activeView, setActiveView] = useState<'map' | 'list'>('map') // For mobile
  const [selectedDriver, setSelectedDriver] = useState<string>('all')

  const { mapPoints, loading, deleteDeliveryPoint, refetch } = useDeliveryMap(selectedDate)
  const { showToast } = useToast()

  // Get unique drivers
  const uniqueDrivers = useMemo(() => {
    const drivers = new Map<string, string>()
    mapPoints.forEach(point => {
      if (point.driverName) {
        // Use driverName as both id and name since we don't have driverId field
        drivers.set(point.driverName, point.driverName)
      }
    })
    return Array.from(drivers, ([id, name]) => ({ id, name }))
  }, [mapPoints])

  // Filter points based on search and driver
  const filteredPoints = useMemo(() => {
    let filtered = mapPoints
    
    // Filter by driver
    if (selectedDriver !== 'all') {
      filtered = filtered.filter(point => point.driverName === selectedDriver)
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(point => 
        (point.address && point.address.toLowerCase().includes(search)) ||
        (addressCache[point.id] && addressCache[point.id].toLowerCase().includes(search)) ||
        (point.note && point.note.toLowerCase().includes(search)) ||
        (point.driverName && point.driverName.toLowerCase().includes(search)) ||
        (point.customerName && point.customerName.toLowerCase().includes(search))
      )
    }
    
    return filtered
  }, [mapPoints, searchTerm, addressCache, selectedDriver])

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
    id: 'google-map-script',
    language: 'th',
    region: 'TH'
  })

  // Check permission
  useEffect(() => {
    if (userData && userData.role !== 'driver' && userData.role !== 'admin' && userData.role !== 'hr') {
      router.push('/unauthorized')
    }
  }, [userData, router])

  // Fetch addresses for points without address
  useEffect(() => {
    const fetchMissingAddresses = async () => {
      if (!isLoaded || mapPoints.length === 0) return

      const geocoder = new google.maps.Geocoder()
      
      const pointsWithoutAddress = mapPoints.filter(
        point => !point.address && !addressCache[point.id]
      )

      for (const point of pointsWithoutAddress) {
        try {
          const result = await new Promise<string>((resolve, reject) => {
            geocoder.geocode(
              { 
                location: { lat: point.lat, lng: point.lng },
                language: 'th' // เพิ่มภาษาไทย
              },
              (results, status) => {
                if (status === 'OK' && results && results[0]) {
                  // Clean up Thailand-specific formatting
                  const address = results[0].formatted_address
                    .replace('Unnamed Road, ', '')
                    .replace('ประเทศไทย', '')
                    .trim()
                    .replace(/,\s*$/, '') // Remove trailing comma
                  
                  resolve(address)
                } else {
                  reject(new Error('ไม่สามารถหาที่อยู่ได้'))
                }
              }
            )
          })
          
          setAddressCache(prev => ({ ...prev, [point.id]: result }))
        } catch (error) {
          console.error('Error fetching address:', error)
          setAddressCache(prev => ({ ...prev, [point.id]: 'ไม่สามารถระบุที่อยู่ได้' }))
        }
      }
    }

    fetchMissingAddresses()
  }, [isLoaded, mapPoints, addressCache])

  // Fit map to show all points
  useEffect(() => {
    if (map && filteredPoints.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      filteredPoints.forEach(point => {
        bounds.extend({ lat: point.lat, lng: point.lng })
      })
      map.fitBounds(bounds)
      
      // Add padding - less for mobile
      const isMobile = window.innerWidth < 768
      const padding = isMobile 
        ? { top: 50, right: 20, bottom: 50, left: 20 }
        : { top: 50, right: 50, bottom: 50, left: 380 }
      map.fitBounds(bounds, padding)
    }
  }, [map, filteredPoints])

  // Navigate between dates
  const changeDate = (days: number) => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + days)
    
    const today = new Date()
    today.setHours(23, 59, 59, 999) // Set to end of today
    
    if (date <= today) {
      setSelectedDate(getLocalDateString(date))
    }
  }

  // Open lightbox
  const openLightbox = (imageUrl: string) => {
    setLightboxImage(imageUrl)
    setShowLightbox(true)
  }

  // View all points
  const viewAllPoints = () => {
    if (map && filteredPoints.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      filteredPoints.forEach(point => {
        bounds.extend({ lat: point.lat, lng: point.lng })
      })
      map.fitBounds(bounds)
      
      const isMobile = window.innerWidth < 768
      const padding = isMobile 
        ? { top: 50, right: 20, bottom: 50, left: 20 }
        : { top: 50, right: 50, bottom: 50, left: 380 }
      map.fitBounds(bounds, padding)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!deletePointId) return

    try {
      const success = await deleteDeliveryPoint(deletePointId)
      if (success) {
        showToast('ลบจุดส่งของสำเร็จ', 'success')
        setSelectedPoint(null)
        await refetch() // Refresh data
      }
    } catch (error) {
      showToast('ไม่สามารถลบจุดส่งของได้', 'error')
    } finally {
      setShowDeleteDialog(false)
      setDeletePointId(null)
    }
  }

  // Select point and focus on map
  const handleSelectPoint = (point: DeliveryMapPoint) => {
    setSelectedPoint(point)
    if (map) {
      map.panTo({ lat: point.lat, lng: point.lng })
      map.setZoom(17)
    }
    // On mobile, switch to map view when selecting a point
    if (window.innerWidth < 768) {
      setActiveView('map')
      setShowMobileList(false)
    }
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="p-8">
          <p className="text-red-600 text-base">Error loading map</p>
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

  // Points List Component
  const PointsList = () => (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : filteredPoints.length === 0 ? (
        <div className="text-center py-8">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 text-base">ไม่พบข้อมูลการส่งของ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPoints.map((point, index) => (
            <Card
              key={point.id}
              className={`cursor-pointer transition-all ${
                selectedPoint?.id === point.id ? 'ring-2 ring-red-500' : 'hover:shadow-md'
              }`}
              onClick={() => handleSelectPoint(point)}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  {point.photo && (
                    <div className="flex-shrink-0">
                      <img
                        src={point.photo.thumbnailUrl || point.photo.url}
                        alt="Delivery"
                        className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          openLightbox(point.photo!.url)
                        }}
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Time and Sequence */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-base font-medium text-red-600">
                            {point.sequence}
                          </span>
                        </div>
                        <span className="text-base font-medium">
                          {formatTime(point.checkInTime)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {/* Driver Name */}
                        {point.driverName && (
                          <div className="hidden sm:flex items-center gap-1 text-sm text-gray-600">
                            <User className="w-3 h-3" />
                            <span>{point.driverName}</span>
                          </div>
                        )}
                        
                        {/* Delete button for admin */}
                        {userData?.role === 'admin' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 ml-auto"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeletePointId(point.id)
                              setShowDeleteDialog(true)
                            }}
                          >
                            <Trash2 className="w-3 h-3 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Customer Name */}
                    {point.customerName && (
                      <p className="text-base font-medium text-gray-700 mb-1">
                        {point.customerName}
                      </p>
                    )}

                    {/* Address */}
                    <p className="text-base text-gray-500 line-clamp-2">
                      <MapPin className="w-3 h-3 inline-block mr-1" />
                      {point.address || addressCache[point.id] || 'กำลังโหลดที่อยู่...'}
                    </p>

                    {/* Note */}
                    {point.note && (
                      <p className="text-sm text-gray-500 mt-1 italic">
                        หมายเหตุ: {point.note}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] relative">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-96 bg-white border-r border-gray-200 flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">รายการส่งของ</h2>
          
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
              max={getLocalDateString(new Date())}
              className="flex-1 text-base"
            />
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => changeDate(1)}
              disabled={loading || selectedDate === getLocalDateString(new Date())}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Summary */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-base text-gray-600">
              พบ {filteredPoints.length} จุดส่งของ
            </span>
            {mapPoints.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={viewAllPoints}
                disabled={loading}
              >
                <Eye className="w-4 h-4 mr-1" />
                ดูทั้งหมด
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="ค้นหาที่อยู่, หมายเหตุ, พนักงาน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-base"
            />
          </div>

          {/* Driver Filter Dropdown */}
          {uniqueDrivers.length > 0 && (
            <div className="mt-3">
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger className="text-base">
                  <SelectValue placeholder="เลือกพนักงาน" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span className="text-base">พนักงานทั้งหมด</span>
                    </div>
                  </SelectItem>
                  {uniqueDrivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      <span className="text-base">{driver.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Points List */}
        <div className="flex-1 overflow-y-auto p-4">
          <PointsList />
        </div>
      </div>

      {/* Mobile Content Container */}
      <div className="lg:hidden w-full">
        {/* Mobile Header - ใช้ sticky positioning */}
        <div className="sticky top-0 left-0 right-0 bg-white border-b z-40 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">รายการส่งของ</h2>
            <div className="flex gap-2">
              <Button
                variant={activeView === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView('list')}
              >
                <Menu className="w-4 h-4 mr-1" />
                รายการ
              </Button>
              <Button
                variant={activeView === 'map' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView('map')}
              >
                <MapIcon className="w-4 h-4 mr-1" />
                แผนที่
              </Button>
            </div>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-2 mb-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => changeDate(-1)}
              disabled={loading}
              className="h-9 w-9"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="flex-1 h-9 text-base"
            />
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => changeDate(1)}
              disabled={loading || selectedDate === new Date().toISOString().split('T')[0]}
              className="h-9 w-9"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Search and Driver Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="ค้นหา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-base"
              />
            </div>
            
            {/* Driver Filter Dropdown */}
            {uniqueDrivers.length > 0 && (
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger className="h-9 text-base">
                  <SelectValue placeholder="เลือกพนักงาน" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3" />
                      <span className="text-base">พนักงานทั้งหมด</span>
                    </div>
                  </SelectItem>
                  {uniqueDrivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      <span className="text-base">{driver.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <div className="flex items-center justify-between text-base">
              <span className="text-gray-600">
                พบ {filteredPoints.length} จุดส่งของ
              </span>
              {mapPoints.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={viewAllPoints}
                  disabled={loading}
                  className="h-8"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  ดูทั้งหมด
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile List View */}
        <div className={`${activeView === 'list' ? 'block' : 'hidden'}`}>
          <div className="p-4">
            <PointsList />
          </div>
        </div>

        {/* Mobile Map View */}
        <div className={`${activeView === 'map' ? 'block' : 'hidden'} h-[calc(100vh-14rem)]`}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={filteredPoints.length > 0 ? { lat: filteredPoints[0].lat, lng: filteredPoints[0].lng } : defaultCenter}
            zoom={13}
            onLoad={setMap}
            options={{
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: true,
              zoomControl: true
            }}
          >
            {/* Markers */}
            {filteredPoints.map((point, index) => (
              <Marker
                key={point.id}
                position={{ lat: point.lat, lng: point.lng }}
                icon={{
                  ...createMarkerIcon(point.sequence?.toString() || (index + 1).toString()),
                }}
                label={{
                  text: point.sequence?.toString() || (index + 1).toString(),
                  color: '#ffffff',
                  fontSize: '14px',
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
                <div className="min-w-[180px] max-w-[240px]">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2 pr-8">
                    <span className="font-medium text-sm">จุดที่ {selectedPoint.sequence}</span>
                    {selectedPoint.driverName && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <User className="w-3 h-3" />
                        <span>{selectedPoint.driverName}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Time */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(selectedPoint.checkInTime)}
                  </div>
                  
                  {/* Customer */}
                  {selectedPoint.customerName && (
                    <p className="text-sm font-medium mb-1">{selectedPoint.customerName}</p>
                  )}
                  
                  {/* Address */}
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                    {selectedPoint.address || addressCache[selectedPoint.id] || 'กำลังโหลดที่อยู่...'}
                  </p>

                  {/* Photo Thumbnail */}
                  {selectedPoint.photo && (
                    <div className="mb-2 flex justify-center">
                      <img
                        src={selectedPoint.photo.thumbnailUrl || selectedPoint.photo.url}
                        alt="Delivery"
                        className="max-w-full max-h-24 object-contain rounded cursor-pointer hover:opacity-80"
                        onClick={() => openLightbox(selectedPoint.photo!.url)}
                      />
                    </div>
                  )}

                  {/* Navigation Button */}
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full h-8 text-sm"
                    onClick={() => {
                      const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedPoint.lat},${selectedPoint.lng}`
                      window.open(url, '_blank')
                    }}
                  >
                    <Navigation className="w-3 h-3 mr-1" />
                    นำทาง
                  </Button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      </div>

      {/* Desktop Map - Full width */}
      <div className="hidden lg:block flex-1 relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={filteredPoints.length > 0 ? { lat: filteredPoints[0].lat, lng: filteredPoints[0].lng } : defaultCenter}
          zoom={13}
          onLoad={setMap}
          options={{
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
            zoomControl: true
          }}
        >
          {/* Markers */}
          {filteredPoints.map((point, index) => (
            <Marker
              key={point.id}
              position={{ lat: point.lat, lng: point.lng }}
              icon={{
                ...createMarkerIcon(point.sequence?.toString() || (index + 1).toString()),
              }}
              label={{
                text: point.sequence?.toString() || (index + 1).toString(),
                color: '#ffffff',
                fontSize: '14px',
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
              <div className="min-w-[180px] max-w-[240px]">
                {/* Header */}
                <div className="flex items-center justify-between mb-2 pr-8">
                  <span className="font-medium text-sm">จุดที่ {selectedPoint.sequence}</span>
                  {selectedPoint.driverName && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <User className="w-3 h-3" />
                      <span>{selectedPoint.driverName}</span>
                    </div>
                  )}
                </div>
                
                {/* Time */}
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(selectedPoint.checkInTime)}
                </div>
                
                {/* Customer */}
                {selectedPoint.customerName && (
                  <p className="text-sm font-medium mb-1">{selectedPoint.customerName}</p>
                )}
                
                {/* Address */}
                <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                  {selectedPoint.address || addressCache[selectedPoint.id] || 'กำลังโหลดที่อยู่...'}
                </p>

                {/* Photo Thumbnail */}
                {selectedPoint.photo && (
                  <div className="mb-2 flex justify-center">
                    <img
                      src={selectedPoint.photo.thumbnailUrl || selectedPoint.photo.url}
                      alt="Delivery"
                      className="max-w-full max-h-24 object-contain rounded cursor-pointer hover:opacity-80"
                      onClick={() => openLightbox(selectedPoint.photo!.url)}
                    />
                  </div>
                )}

                {/* Navigation Button */}
                <Button
                  variant="default"
                  size="sm"
                  className="w-full h-8 text-sm"
                  onClick={() => {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedPoint.lat},${selectedPoint.lng}`
                    window.open(url, '_blank')
                  }}
                >
                  <Navigation className="w-3 h-3 mr-1" />
                  นำทาง
                </Button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={showLightbox} onOpenChange={setShowLightbox}>
        <DialogContent className="max-w-4xl p-0">
          <DialogTitle className="sr-only">รูปภาพการส่งของ</DialogTitle>
          <div className="relative">
            <img
              src={lightboxImage}
              alt="Delivery Photo"
              className="w-full h-auto max-h-[90vh] object-contain"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-white/80 hover:bg-white"
              onClick={() => setShowLightbox(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ที่จะลบจุดส่งของนี้? การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletePointId(null)}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}