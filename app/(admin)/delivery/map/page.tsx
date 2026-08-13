'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { canSeeDelivery } from '@/lib/services/user/access'
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
import { GoogleMap, Marker, InfoWindow, Polyline, useJsApiLoader } from '@react-google-maps/api'
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
import { GOOGLE_MAPS_LOADER } from '@/lib/maps'
import { DatePicker } from '@/components/aoo'

const mapContainerStyle = {
  width: '100%',
  height: '100%'
}

const defaultCenter = {
  lat: 13.7563, // Bangkok
  lng: 100.5018
}


// สีประจำคนขับ — แจกตามลำดับชื่อ (คนขับมีไม่กี่คน ครบ 12 สีค่อยวนซ้ำ)
const DRIVER_PALETTE = [
  '#dc2626', // red
  '#2563eb', // blue
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0d9488', // teal
  '#db2777', // pink
  '#4f46e5', // indigo
  '#ca8a04', // yellow-dark
  '#0891b2', // cyan
  '#65a30d', // lime-dark
  '#7c3aed', // violet
]

// ชุดสัญลักษณ์บนเส้นทาง: ขีดวิ่ง (เลื่อน offset ให้เห็นทิศ) + หัวลูกศรกลางเส้น
const routeIcons = (color: string, offsetPx: number) => [
  {
    icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeWeight: 3, scale: 3, strokeColor: color },
    offset: `${offsetPx}px`,
    repeat: '16px',
  },
  {
    icon: {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      fillOpacity: 1,
      fillColor: color,
      strokeColor: '#ffffff',
      strokeWeight: 1,
      scale: 2.5,
    },
    offset: '50%',
  },
]

// Custom marker icon - ขนาดเล็กลง สีตามคนขับ
const createMarkerIcon = (color: string) => ({
  path: google.maps.SymbolPath.CIRCLE,
  fillColor: color,
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 2,
  scale: 10,
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
  // แผนที่มี 2 ตัว (desktop/mobile — อีกตัวแค่ถูกซ่อนด้วย CSS แต่ยัง mount อยู่)
  // ต้องแยก state และสั่งทั้งคู่ — เดิมใช้ตัวเดียว ตัวที่โหลดทีหลัง (มักเป็นตัวที่ซ่อน)
  // แย่งที่ ปุ่มดูทั้งหมด/โฟกัสจุดบนมือถือเลยไม่ขยับ
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [mobileMap, setMobileMap] = useState<google.maps.Map | null>(null)
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

  // Get unique drivers — จัดกลุ่มด้วย driverId ไม่ใช่ชื่อ
  // เพราะชื่อที่ฝังไว้กับจุดส่งเก่าอาจเป็นชื่อก่อนแก้โปรไฟล์ คนเดียวกันจะแตกเป็นหลายรายการ
  const uniqueDrivers = useMemo(() => {
    const drivers = new Map<string, string>()
    mapPoints.forEach(point => {
      if (point.driverId && point.driverName && !drivers.has(point.driverId)) {
        drivers.set(point.driverId, point.driverName)
      }
    })
    return Array.from(drivers, ([id, name]) => ({ id, name }))
  }, [mapPoints])

  // สีประจำคนขับ — เรียงตามชื่อให้สีนิ่งตลอดวัน ไม่สลับตามลำดับเช็คอิน
  const driverColors = useMemo(() => {
    const sorted = [...uniqueDrivers].sort((a, b) => a.name.localeCompare(b.name, 'th'))
    const colors = new Map<string, string>()
    sorted.forEach((d, i) => colors.set(d.id, DRIVER_PALETTE[i % DRIVER_PALETTE.length]))
    return colors
  }, [uniqueDrivers])

  const colorOf = (driverId?: string) =>
    (driverId && driverColors.get(driverId)) || DRIVER_PALETTE[0]

  // เลขลำดับจุด "ของแต่ละคน" — นับ 1,2,3… แยกตามคนขับ เรียงตามเวลาเช็คอิน
  // (sequence ที่ฝังมากับข้อมูลเป็นเลขรวมทั้งวัน เลยไม่ใช้)
  const seqByPoint = useMemo(() => {
    const counters = new Map<string, number>()
    const seq = new Map<string, number>()
    const byTime = [...mapPoints].sort(
      (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
    )
    byTime.forEach(p => {
      const key = p.driverId || '?'
      const n = (counters.get(key) || 0) + 1
      counters.set(key, n)
      seq.set(p.id, n)
    })
    return seq
  }, [mapPoints])

  // เส้นทางของแต่ละคน: จุดเรียงตามเวลา (อย่างน้อย 2 จุดถึงจะลากเส้นได้)
  const driverRoutes = useMemo(() => {
    const groups = new Map<string, DeliveryMapPoint[]>()
    mapPoints.forEach(p => {
      if (!p.driverId) return
      if (!groups.has(p.driverId)) groups.set(p.driverId, [])
      groups.get(p.driverId)!.push(p)
    })
    const routes: { driverId: string; path: { lat: number; lng: number }[] }[] = []
    groups.forEach((points, driverId) => {
      if (selectedDriver !== 'all' && driverId !== selectedDriver) return
      if (points.length < 2) return
      const sorted = [...points].sort(
        (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
      )
      routes.push({ driverId, path: sorted.map(p => ({ lat: p.lat, lng: p.lng })) })
    })
    return routes
  }, [mapPoints, selectedDriver])

  // ขีดวิ่งบนเส้นทาง: ขยับผ่าน setOptions ตรง ๆ ไม่ผ่าน state — ถ้าให้ React วาดใหม่
  // ทุก 90ms หมุด/เส้นบนแผนที่ทั้งสองตัวจะถูกตั้งค่ารัว ๆ จนแผนที่กระตุกลากไม่ได้
  const routeLines = useRef(new Set<{ line: google.maps.Polyline; color: string }>())
  useEffect(() => {
    let offset = 0
    const t = setInterval(() => {
      offset = (offset + 2) % 16
      routeLines.current.forEach(({ line, color }) =>
        line.setOptions({ icons: routeIcons(color, offset) })
      )
    }, 120)
    return () => clearInterval(t)
  }, [])

  // Filter points based on search and driver
  const filteredPoints = useMemo(() => {
    let filtered = mapPoints
    
    // Filter by driver
    if (selectedDriver !== 'all') {
      filtered = filtered.filter(point => point.driverId === selectedDriver)
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

  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER)

  // Check permission
  useEffect(() => {
    if (userData && !canSeeDelivery(userData)) {
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

  // ซูมให้เห็นครบทุกจุด — สั่งทั้งสองแผนที่ ตัวไหนแสดงอยู่ตัวนั้นขยับ
  // อ่านจุดผ่าน ref และ fit เมื่อ "ชุดจุด" เปลี่ยนจริงเท่านั้น — เดิมผูกกับ identity
  // ของ array ซึ่งเปลี่ยนทุกครั้งที่ geocode ที่อยู่เสร็จ แผนที่เลยเด้งกลับเองระหว่างใช้
  const pointsRef = useRef(filteredPoints)
  pointsRef.current = filteredPoints
  const pointsKey = useMemo(() => filteredPoints.map(p => p.id).join('|'), [filteredPoints])

  const fitAll = useCallback(() => {
    const pts = pointsRef.current
    if (!pts.length) return
    const makeBounds = () => {
      const b = new google.maps.LatLngBounds()
      pts.forEach(p => b.extend({ lat: p.lat, lng: p.lng }))
      return b
    }
    map?.fitBounds(makeBounds(), { top: 50, right: 50, bottom: 50, left: 380 })
    mobileMap?.fitBounds(makeBounds(), { top: 50, right: 20, bottom: 50, left: 20 })
  }, [map, mobileMap])

  useEffect(() => {
    fitAll()
  }, [fitAll, pointsKey])

  // สลับมาแท็บแผนที่: กล่องเพิ่งโผล่จาก display:none — Maps ยังจำขนาดตอนถูกซ่อนอยู่
  // ต้องบอกให้วัดขนาดใหม่ก่อนแล้วค่อย fit ไม่งั้นซูม/จุดหลุดนอกส่วนที่มองเห็น
  useEffect(() => {
    if (activeView !== 'map' || !mobileMap) return
    const t = setTimeout(() => {
      google.maps.event.trigger(mobileMap, 'resize')
      fitAll()
    }, 60)
    return () => clearTimeout(t)
  }, [activeView, mobileMap, fitAll])

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
  const viewAllPoints = () => fitAll()

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
    for (const m of [map, mobileMap]) {
      m?.panTo({ lat: point.lat, lng: point.lng })
      m?.setZoom(17)
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

  // เลเยอร์บนแผนที่ (ใช้ร่วม desktop/mobile): เส้นทางรายคน + หมุดเลขลำดับของแต่ละคน
  const renderMapLayers = () => (
    <>
      {driverRoutes.map(route => {
        const color = colorOf(route.driverId)
        return (
          <Polyline
            key={route.driverId}
            path={route.path}
            // ลงทะเบียนเส้นไว้ให้ตัวจับเวลาขยับขีดผ่าน setOptions ตรง ๆ (ไม่ผ่าน React)
            onLoad={line => routeLines.current.add({ line, color })}
            onUnmount={line => {
              routeLines.current.forEach(e => {
                if (e.line === line) routeLines.current.delete(e)
              })
            }}
            options={{
              strokeColor: color,
              strokeOpacity: 0.25,
              strokeWeight: 3,
              geodesic: true,
              icons: routeIcons(color, 0),
            }}
          />
        )
      })}
      {filteredPoints.map(point => (
        <Marker
          key={point.id}
          position={{ lat: point.lat, lng: point.lng }}
          icon={createMarkerIcon(colorOf(point.driverId))}
          label={{
            text: String(seqByPoint.get(point.id) ?? ''),
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
          onClick={() => setSelectedPoint(point)}
        />
      ))}
    </>
  )

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
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: colorOf(point.driverId) }}
                        >
                          <span className="text-xs font-semibold text-white">
                            {seqByPoint.get(point.id)}
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
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: colorOf(point.driverId) }}
                            />
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
    // dvh ไม่นับพื้นที่หลังแถบ URL ของเบราว์เซอร์มือถือ — 100vh เดิมทำขอบล่างโดนบัง
    <div className="flex h-[calc(100dvh-4rem)] relative">
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
            
            <DatePicker
              value={selectedDate}
              onChange={setSelectedDate}
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

      {/* Mobile Content Container — flex column: หัวสูงตามจริง แผนที่กินที่ที่เหลือพอดีจอ
          (เดิมกะความสูงเป็น 100vh-10rem แต่หัวจริงสูงกว่านั้น กรอบแผนที่เลยยาวทะลุจอ) */}
      <div className="lg:hidden flex h-full w-full flex-col">
        {/* Mobile Header */}
        <div className="shrink-0 bg-white border-b z-40 p-3 shadow-sm">
          {/* ขนาดเท่ากับ desktop — เจ้าของขอไม่ให้ย่อ font/ปุ่มบนมือถือ */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">รายการส่งของ</h2>
            <div className="flex gap-1">
              <Button
                variant={activeView === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView('list')}
                className="h-8 text-sm"
              >
                <Menu className="w-3.5 h-3.5 mr-1" />
                รายการ
              </Button>
              <Button
                variant={activeView === 'map' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView('map')}
                className="h-8 text-sm"
              >
                <MapIcon className="w-3.5 h-3.5 mr-1" />
                แผนที่
              </Button>
            </div>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => changeDate(-1)}
              disabled={loading}
              className="h-8 w-8"
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>

            <DatePicker
              value={selectedDate}
              onChange={setSelectedDate}
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

          {/* Search and Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <Input
                type="text"
                placeholder="ค้นหา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 text-sm h-8"
              />
            </div>

            {/* Driver Filter and Summary */}
            <div className="flex items-center justify-between">
              {uniqueDrivers.length > 0 ? (
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger className="h-8 text-sm w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="text-sm">ทั้งหมด</span>
                    </SelectItem>
                    {uniqueDrivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        <span className="text-sm">{driver.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm text-gray-600">
                  พบ {filteredPoints.length} จุด
                </span>
              )}

              {mapPoints.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={viewAllPoints}
                  disabled={loading}
                  className="h-8 text-sm cursor-pointer hover:bg-gray-100"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  ดูทั้งหมด
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile List View */}
        <div className={`${activeView === 'list' ? 'block' : 'hidden'} min-h-0 flex-1 overflow-y-auto`}>
          <div className="p-3">
            <PointsList />
          </div>
        </div>

        {/* Mobile Map View */}
        <div className={`${activeView === 'map' ? 'block' : 'hidden'} min-h-0 flex-1`}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={filteredPoints.length > 0 ? { lat: filteredPoints[0].lat, lng: filteredPoints[0].lng } : defaultCenter}
            zoom={13}
            onLoad={setMobileMap}
            options={{
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: true,
              zoomControl: true
            }}
          >
            {renderMapLayers()}

            {/* Info Window - Compact */}
            {selectedPoint && (
              <InfoWindow
                position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
                onCloseClick={() => setSelectedPoint(null)}
              >
                <div className="min-w-[160px] max-w-[200px]">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-xs flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: colorOf(selectedPoint.driverId) }}
                    />
                    จุดที่ {seqByPoint.get(selectedPoint.id)}
                    {selectedPoint.driverName ? ` · ${selectedPoint.driverName}` : ''}
                  </span>
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
          {renderMapLayers()}

          {/* Info Window */}
          {selectedPoint && (
            <InfoWindow
              position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
              onCloseClick={() => setSelectedPoint(null)}
            >
              <div className="min-w-[160px] max-w-[200px]">
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: colorOf(selectedPoint.driverId) }}
                    />
                    จุดที่ {seqByPoint.get(selectedPoint.id)}
                    {selectedPoint.driverName ? ` · ${selectedPoint.driverName}` : ''}
                  </span>
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