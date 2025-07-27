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
  Map as MapIcon,
  Package,
  Filter
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

// Custom marker icon - ขนาดเล็กลง
const createMarkerIcon = (label: string) => ({
  path: google.maps.SymbolPath.CIRCLE,
  fillColor: '#DC2626',
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 2, // ลดจาก 3 เป็น 2
  scale: 10, // ลดจาก 12 เป็น 10
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
                language: 'th'
              },
              (results, status) => {
                if (status === 'OK' && results && results[0]) {
                  const address = results[0].formatted_address
                    .replace('Unnamed Road, ', '')
                    .replace('ประเทศไทย', '')
                    .trim()
                    .replace(/,\s*$/, '')
                  
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
    today.setHours(23, 59, 59, 999)
    
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
        await refetch()
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
          <p className="text-red-600 text-sm">Error loading map</p>
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

  // Points List Component - Optimized
  const PointsList = () => (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filteredPoints.length === 0 ? (
        <div className="text-center py-8">
          <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">ไม่พบข้อมูลการส่งของ</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPoints.map((point, index) => (
            <Card
              key={point.id}
              className={`cursor-pointer transition-all hover:shadow-sm ${
                selectedPoint?.id === point.id ? 'ring-2 ring-red-500' : ''
              }`}
              onClick={() => handleSelectPoint(point)}
            >
              <CardContent className="p-3">
                <div className="flex gap-3">
                  {/* Thumbnail - ขนาดเล็กลง */}
                  {point.photo && (
                    <div className="flex-shrink-0">
                      <img
                        src={point.photo.thumbnailUrl || point.photo.url}
                        alt="Delivery"
                        className="w-12 h-12 md:w-14 md:h-14 object-cover rounded cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-200"
                        onClick={(e) => {
                          e.stopPropagation()
                          openLightbox(point.photo!.url)
                        }}
                      />
                    </div>
                  )}

                  {/* Content - ย่อขนาด font */}
                  <div className="flex-1 min-w-0">
                    {/* Time and Sequence */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-red-600">
                            {point.sequence}
                          </span>
                        </div>
                        <span className="text-sm font-medium">
                          {formatTime(point.checkInTime)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {/* Driver Name - Mobile hide */}
                        {point.driverName && (
                          <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
                            <User className="w-3 h-3" />
                            <span className="truncate max-w-[80px]">{point.driverName}</span>
                          </div>
                        )}
                        
                        {/* Delete button for admin */}
                        {userData?.role === 'admin' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
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
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {point.customerName}
                      </p>
                    )}

                    {/* Address - ย่อลงและ limit 1 บรรทัด */}
                    <p className="text-xs text-gray-500 line-clamp-1 mt-1">
                      <MapPin className="w-3 h-3 inline-block mr-1" />
                      {point.address || addressCache[point.id] || 'กำลังโหลด...'}
                    </p>

                    {/* Note - เฉพาะ mobile จะซ่อน */}
                    {point.note && (
                      <p className="text-xs text-gray-400 mt-1 italic hidden sm:block line-clamp-1">
                        {point.note}
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
      {/* Desktop Sidebar - ลดความกว้าง */}
      <div className="hidden lg:flex w-80 bg-white border-r border-gray-200 flex-col">
        {/* Header */}
        <div className="p-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">รายการส่งของ</h2>
          
          {/* Date Navigation */}
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => changeDate(-1)}
              disabled={loading}
              className="h-8 w-8"
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={getLocalDateString(new Date())}
              className="flex-1 text-sm h-8"
            />
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => changeDate(1)}
              disabled={loading || selectedDate === getLocalDateString(new Date())}
              className="h-8 w-8"
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>

          {/* Summary */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              พบ {filteredPoints.length} จุด
            </span>
            {mapPoints.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={viewAllPoints}
                disabled={loading}
                className="h-7 text-xs cursor-pointer hover:bg-gray-100"
              >
                <Eye className="w-3 h-3 mr-1" />
                ดูทั้งหมด
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="mt-2 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <Input
              type="text"
              placeholder="ค้นหา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-sm h-8"
            />
          </div>

          {/* Driver Filter Dropdown */}
          {uniqueDrivers.length > 0 && (
            <div className="mt-2">
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger className="text-sm h-8">
                  <SelectValue placeholder="เลือกพนักงาน" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3" />
                      <span className="text-sm">พนักงานทั้งหมด</span>
                    </div>
                  </SelectItem>
                  {uniqueDrivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      <span className="text-sm">{driver.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Points List */}
        <div className="flex-1 overflow-y-auto p-3">
          <PointsList />
        </div>
      </div>

      {/* Mobile Content Container */}
      <div className="lg:hidden w-full">
        {/* Mobile Header - Compact */}
        <div className="sticky top-0 left-0 right-0 bg-white border-b z-40 p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-gray-900">รายการส่งของ</h2>
            <div className="flex gap-1">
              <Button
                variant={activeView === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView('list')}
                className="h-7 text-xs"
              >
                <Menu className="w-3 h-3 mr-1" />
                รายการ
              </Button>
              <Button
                variant={activeView === 'map' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView('map')}
                className="h-7 text-xs"
              >
                <MapIcon className="w-3 h-3 mr-1" />
                แผนที่
              </Button>
            </div>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-1 mb-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => changeDate(-1)}
              disabled={loading}
              className="h-7 w-7"
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="flex-1 h-7 text-xs"
            />
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => changeDate(1)}
              disabled={loading || selectedDate === new Date().toISOString().split('T')[0]}
              className="h-7 w-7"
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>

          {/* Search and Filter - Compact */}
          <div className="space-y-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <Input
                type="text"
                placeholder="ค้นหา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-7 text-xs"
              />
            </div>
            
            {/* Driver Filter and Summary */}
            <div className="flex items-center justify-between">
              {uniqueDrivers.length > 0 ? (
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger className="h-7 text-xs w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="text-xs">ทั้งหมด</span>
                    </SelectItem>
                    {uniqueDrivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        <span className="text-xs">{driver.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-gray-600">
                  พบ {filteredPoints.length} จุด
                </span>
              )}
              
              {mapPoints.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={viewAllPoints}
                  disabled={loading}
                  className="h-7 text-xs cursor-pointer hover:bg-gray-100"
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
          <div className="p-3">
            <PointsList />
          </div>
        </div>

        {/* Mobile Map View */}
        <div className={`${activeView === 'map' ? 'block' : 'hidden'} h-[calc(100vh-10rem)]`}>
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
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
                onClick={() => setSelectedPoint(point)}
              />
            ))}

            {/* Info Window - Compact */}
            {selectedPoint && (
              <InfoWindow
                position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
                onCloseClick={() => setSelectedPoint(null)}
              >
                <div className="min-w-[160px] max-w-[200px]">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-xs">จุดที่ {selectedPoint.sequence}</span>
                    <span className="text-xs text-gray-600">
                      {formatTime(selectedPoint.checkInTime)}
                    </span>
                  </div>
                  
                  {/* Customer */}
                  {selectedPoint.customerName && (
                    <p className="text-xs font-medium mb-1">{selectedPoint.customerName}</p>
                  )}
                  
                  {/* Address */}
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                    {selectedPoint.address || addressCache[selectedPoint.id] || 'กำลังโหลด...'}
                  </p>

                  {/* Photo Thumbnail - Smaller */}
                  {selectedPoint.photo && (
                    <div className="mb-2 flex justify-center">
                      <img
                        src={selectedPoint.photo.thumbnailUrl || selectedPoint.photo.url}
                        alt="Delivery"
                        className="max-w-full max-h-16 object-contain rounded cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-200"
                        onClick={() => openLightbox(selectedPoint.photo!.url)}
                      />
                    </div>
                  )}

                  {/* Navigation Button */}
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full h-7 text-xs"
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
              <div className="min-w-[160px] max-w-[200px]">
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs">จุดที่ {selectedPoint.sequence}</span>
                  <span className="text-xs text-gray-600">
                    {formatTime(selectedPoint.checkInTime)}
                  </span>
                </div>
                
                {/* Customer */}
                {selectedPoint.customerName && (
                  <p className="text-xs font-medium mb-1">{selectedPoint.customerName}</p>
                )}
                
                {/* Address */}
                <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                  {selectedPoint.address || addressCache[selectedPoint.id] || 'กำลังโหลด...'}
                </p>

                {/* Photo Thumbnail */}
                {selectedPoint.photo && (
                  <div className="mb-2 flex justify-center">
                    <img
                      src={selectedPoint.photo.thumbnailUrl || selectedPoint.photo.url}
                      alt="Delivery"
                      className="max-w-full max-h-16 object-contain rounded cursor-pointer hover:opacity-80"
                      onClick={() => openLightbox(selectedPoint.photo!.url)}
                    />
                  </div>
                )}

                {/* Navigation Button */}
                <Button
                  variant="default"
                  size="sm"
                  className="w-full h-7 text-xs"
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
        <DialogContent className="max-w-4xl p-0 [&>button]:hidden">
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
              <X className="w-4 h-4" />
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