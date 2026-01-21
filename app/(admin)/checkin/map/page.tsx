'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { CheckInRecord } from '@/types/checkin'
import { getCheckInRecords } from '@/lib/services/checkinService'
import { formatTime } from '@/lib/utils/date'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  MapPin,
  Calendar,
  Navigation,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Eye,
  Search,
  User,
  Menu,
  Map as MapIcon,
  Filter,
  Building,
  MapPinOff
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { GoogleMap, Marker, InfoWindow, useJsApiLoader, Circle } from '@react-google-maps/api'
import TechLoader from '@/components/shared/TechLoader'
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

// Marker icons
const createOnsiteMarkerIcon = () => ({
  path: google.maps.SymbolPath.CIRCLE,
  fillColor: '#22c55e', // green
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 2,
  scale: 10
})

const createOffsiteMarkerIcon = () => ({
  path: google.maps.SymbolPath.CIRCLE,
  fillColor: '#f59e0b', // orange/warning
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 2,
  scale: 10
})

export default function CheckinMapPage() {
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
  const [records, setRecords] = useState<CheckInRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRecord, setSelectedRecord] = useState<CheckInRecord | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeView, setActiveView] = useState<'map' | 'list'>('map')
  const [filterType, setFilterType] = useState<'all' | 'onsite' | 'offsite'>('all')

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
    id: 'google-map-script',
    language: 'th',
    region: 'TH'
  })

  // Check permission - admin only
  useEffect(() => {
    if (userData && userData.role !== 'admin') {
      router.push('/unauthorized')
    }
  }, [userData, router])

  // Fetch check-in records for selected date
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true)
        const { records: fetchedRecords } = await getCheckInRecords({
          date: selectedDate
        }, 100)
        setRecords(fetchedRecords)
      } catch (error) {
        console.error('Error fetching check-in records:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecords()
  }, [selectedDate])

  // Filter records
  const filteredRecords = useMemo(() => {
    let filtered = records

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(record => record.checkinType === filterType)
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(record =>
        record.userName?.toLowerCase().includes(search) ||
        record.primaryLocationName?.toLowerCase().includes(search)
      )
    }

    return filtered
  }, [records, filterType, searchTerm])

  // Stats
  const stats = useMemo(() => {
    const onsite = records.filter(r => r.checkinType === 'onsite').length
    const offsite = records.filter(r => r.checkinType === 'offsite').length
    return { total: records.length, onsite, offsite }
  }, [records])

  // Fit map to show all points
  useEffect(() => {
    if (map && filteredRecords.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      filteredRecords.forEach(record => {
        if (record.checkinLat && record.checkinLng) {
          bounds.extend({ lat: record.checkinLat, lng: record.checkinLng })
        }
      })
      map.fitBounds(bounds)

      const isMobile = window.innerWidth < 768
      const padding = isMobile
        ? { top: 50, right: 20, bottom: 50, left: 20 }
        : { top: 50, right: 50, bottom: 50, left: 380 }
      map.fitBounds(bounds, padding)
    }
  }, [map, filteredRecords])

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

  // View all points
  const viewAllPoints = () => {
    if (map && filteredRecords.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      filteredRecords.forEach(record => {
        if (record.checkinLat && record.checkinLng) {
          bounds.extend({ lat: record.checkinLat, lng: record.checkinLng })
        }
      })
      map.fitBounds(bounds)

      const isMobile = window.innerWidth < 768
      const padding = isMobile
        ? { top: 50, right: 20, bottom: 50, left: 20 }
        : { top: 50, right: 50, bottom: 50, left: 380 }
      map.fitBounds(bounds, padding)
    }
  }

  // Select record and focus on map
  const handleSelectRecord = (record: CheckInRecord) => {
    setSelectedRecord(record)
    if (map && record.checkinLat && record.checkinLng) {
      map.panTo({ lat: record.checkinLat, lng: record.checkinLng })
      map.setZoom(17)
    }
    if (window.innerWidth < 768) {
      setActiveView('map')
    }
  }

  // Format checkin time
  const formatCheckinTime = (time: Date | string) => {
    const date = time instanceof Date ? time : new Date(time)
    return format(date, 'HH:mm', { locale: th })
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

  // Records List Component
  const RecordsList = () => (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-8">
          <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">ไม่พบข้อมูลการเช็คอิน</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRecords.map((record) => (
            <Card
              key={record.id}
              className={`cursor-pointer transition-all hover:shadow-sm ${
                selectedRecord?.id === record.id ? 'ring-2 ring-red-500' : ''
              }`}
              onClick={() => handleSelectRecord(record)}
            >
              <CardContent className="p-3">
                <div className="flex gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 flex-shrink-0 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                    {record.userAvatar ? (
                      <img
                        src={record.userAvatar}
                        alt={record.userName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-600 text-xs font-medium">
                        {record.userName?.charAt(0) || '?'}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Name and Time */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm truncate">
                        {record.userName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatCheckinTime(record.checkinTime)}
                      </span>
                    </div>

                    {/* Location and Type */}
                    <div className="flex items-center gap-2">
                      {record.checkinType === 'offsite' ? (
                        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200">
                          <MapPinOff className="w-3 h-3 mr-1" />
                          นอกสถานที่
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200">
                          <Building className="w-3 h-3 mr-1" />
                          {record.primaryLocationName || 'ในสถานที่'}
                        </Badge>
                      )}

                      {record.isLate && (
                        <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                          สาย {record.lateMinutes} นาที
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )

  // Map markers
  const renderMarkers = () => {
    return filteredRecords.map((record) => {
      if (!record.checkinLat || !record.checkinLng) return null

      const isOffsite = record.checkinType === 'offsite'

      return (
        <Marker
          key={record.id}
          position={{ lat: record.checkinLat, lng: record.checkinLng }}
          icon={isOffsite ? createOffsiteMarkerIcon() : createOnsiteMarkerIcon()}
          label={{
            text: record.userName?.charAt(0) || '?',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 'bold'
          }}
          onClick={() => setSelectedRecord(record)}
        />
      )
    })
  }

  // Info window content
  const renderInfoWindow = () => {
    if (!selectedRecord) return null

    const isOffsite = selectedRecord.checkinType === 'offsite'

    return (
      <InfoWindow
        position={{ lat: selectedRecord.checkinLat, lng: selectedRecord.checkinLng }}
        onCloseClick={() => setSelectedRecord(null)}
      >
        <div className="min-w-[180px] max-w-[220px]">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
              {selectedRecord.userAvatar ? (
                <img
                  src={selectedRecord.userAvatar}
                  alt={selectedRecord.userName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-gray-600 text-xs font-medium">
                  {selectedRecord.userName?.charAt(0) || '?'}
                </span>
              )}
            </div>
            <div>
              <p className="font-medium text-sm">{selectedRecord.userName}</p>
              <p className="text-xs text-gray-500">
                {formatCheckinTime(selectedRecord.checkinTime)}
              </p>
            </div>
          </div>

          {/* Type Badge */}
          {isOffsite ? (
            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200 mb-2">
              <MapPinOff className="w-3 h-3 mr-1" />
              เช็คอินนอกสถานที่
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200 mb-2">
              <Building className="w-3 h-3 mr-1" />
              {selectedRecord.primaryLocationName || 'ในสถานที่'}
            </Badge>
          )}

          {/* Late Badge */}
          {selectedRecord.isLate && (
            <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200 mb-2 ml-1">
              สาย {selectedRecord.lateMinutes} นาที
            </Badge>
          )}

          {/* Navigation Button */}
          <Button
            variant="default"
            size="sm"
            className="w-full h-7 text-xs mt-2"
            onClick={() => {
              const url = `https://www.google.com/maps?q=${selectedRecord.checkinLat},${selectedRecord.checkinLng}`
              window.open(url, '_blank')
            }}
          >
            <Navigation className="w-3 h-3 mr-1" />
            ดูใน Google Maps
          </Button>
        </div>
      </InfoWindow>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] relative">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-80 bg-white border-r border-gray-200 flex-col">
        {/* Header */}
        <div className="p-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">แผนที่การเช็คอิน</h2>

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

          {/* Stats */}
          <div className="mt-3 flex items-center gap-2 text-xs">
            <Badge variant="secondary" className="bg-gray-100">
              ทั้งหมด {stats.total}
            </Badge>
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              ในสถานที่ {stats.onsite}
            </Badge>
            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
              นอกสถานที่ {stats.offsite}
            </Badge>
          </div>

          {/* View All Button */}
          <div className="mt-2 flex justify-end">
            {filteredRecords.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={viewAllPoints}
                disabled={loading}
                className="h-7 text-xs"
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
              placeholder="ค้นหาชื่อพนักงาน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-sm h-8"
            />
          </div>

          {/* Filter */}
          <div className="mt-2">
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="text-sm h-8">
                <SelectValue placeholder="ประเภท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="onsite">ในสถานที่</SelectItem>
                <SelectItem value="offsite">นอกสถานที่</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Records List */}
        <div className="flex-1 overflow-y-auto p-3">
          <RecordsList />
        </div>
      </div>

      {/* Mobile Content */}
      <div className="lg:hidden w-full">
        {/* Mobile Header */}
        <div className="sticky top-0 left-0 right-0 bg-white border-b z-40 p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-gray-900">แผนที่การเช็คอิน</h2>
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
              max={getLocalDateString(new Date())}
              className="flex-1 h-7 text-xs"
            />

            <Button
              variant="outline"
              size="icon"
              onClick={() => changeDate(1)}
              disabled={loading || selectedDate === getLocalDateString(new Date())}
              className="h-7 w-7"
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <Input
                type="text"
                placeholder="ค้นหา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-7 text-xs"
              />
            </div>

            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="h-7 text-xs w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="onsite">ในสถานที่</SelectItem>
                <SelectItem value="offsite">นอกสถานที่</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="mt-2 flex items-center gap-2 text-xs">
            <Badge variant="secondary" className="bg-gray-100 text-xs">
              ทั้งหมด {stats.total}
            </Badge>
            <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
              ในสถานที่ {stats.onsite}
            </Badge>
            <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs">
              นอกสถานที่ {stats.offsite}
            </Badge>
          </div>
        </div>

        {/* Mobile List View */}
        <div className={`${activeView === 'list' ? 'block' : 'hidden'}`}>
          <div className="p-3">
            <RecordsList />
          </div>
        </div>

        {/* Mobile Map View */}
        <div className={`${activeView === 'map' ? 'block' : 'hidden'} h-[calc(100vh-14rem)]`}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={filteredRecords.length > 0 && filteredRecords[0].checkinLat
              ? { lat: filteredRecords[0].checkinLat, lng: filteredRecords[0].checkinLng }
              : defaultCenter}
            zoom={13}
            onLoad={setMap}
            options={{
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: true,
              zoomControl: true
            }}
          >
            {renderMarkers()}
            {selectedRecord && selectedRecord.checkinLat && renderInfoWindow()}
          </GoogleMap>
        </div>
      </div>

      {/* Desktop Map */}
      <div className="hidden lg:block flex-1 relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={filteredRecords.length > 0 && filteredRecords[0].checkinLat
            ? { lat: filteredRecords[0].checkinLat, lng: filteredRecords[0].checkinLng }
            : defaultCenter}
          zoom={13}
          onLoad={setMap}
          options={{
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
            zoomControl: true
          }}
        >
          {renderMarkers()}
          {selectedRecord && selectedRecord.checkinLat && renderInfoWindow()}
        </GoogleMap>
      </div>
    </div>
  )
}
