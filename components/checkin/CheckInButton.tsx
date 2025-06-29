// components/checkin/CheckInButton.tsx

'use client'

import { useState, useEffect } from 'react'
import { useCheckIn } from '@/hooks/useCheckIn'
import { useLocations } from '@/hooks/useLocations'
import { 
  MapPin, 
  Loader2,
  X,
  AlertCircle,
  Clock,
  CheckCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { colorClasses, gradients } from '@/lib/theme/colors'
import TechLoader from '@/components/shared/TechLoader'
import ShiftSelector from './ShiftSelector'
import { Shift } from '@/types/location'
import * as locationDetectionService from '@/lib/services/locationDetectionService'

// Dynamic import CheckInMap
const CheckInMap = dynamic(
  () => import('./CheckInMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-gray-400 mx-auto" />
          <p className="text-gray-600 mt-2">กำลังโหลดแผนที่...</p>
        </div>
      </div>
    )
  }
)

export default function CheckInButton() {
  const {
    currentCheckIn,
    isCheckingIn,
    isCheckingOut,
    locationCheckResult,
    currentPosition,
    checkIn,
    checkOut,
    getCurrentLocation,
    loading,
    error
  } = useCheckIn()
  
  const { locations } = useLocations(true) // Get active locations
  
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showShiftSelector, setShowShiftSelector] = useState(false)
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([])
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)

  // Auto get location when component mounts
  useEffect(() => {
    if (!loading && !currentPosition) {
      getCurrentLocation()
    }
  }, [loading])

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Calculate working hours
  const getWorkingTime = () => {
    if (!currentCheckIn?.checkinTime) return { hours: 0, minutes: 0, seconds: 0 }
    
    const checkinTime = currentCheckIn.checkinTime instanceof Date 
      ? currentCheckIn.checkinTime 
      : new Date(currentCheckIn.checkinTime)
    
    const totalSeconds = Math.floor((currentTime.getTime() - checkinTime.getTime()) / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    return { hours, minutes, seconds }
  }

  const handleCheckInClick = async () => {
    console.log('=== CheckIn Button Clicked ===')
    
    if (!currentPosition || !locationCheckResult) {
      console.log('No position or location result, getting location...')
      await getCurrentLocation()
      return
    }

    console.log('Location Check Result:', locationCheckResult)
    console.log('Can Check In:', locationCheckResult.canCheckIn)
    console.log('Locations in Range:', locationCheckResult.locationsInRange)

    // Check if at a location that requires shift selection
    if (locationCheckResult.canCheckIn && locationCheckResult.locationsInRange.length > 0) {
      const primaryLocation = locationCheckResult.locationsInRange[0]
      console.log('Primary Location:', primaryLocation)
      
      const location = locations.find(l => l.id === primaryLocation.id)
      console.log('Found Location:', location)
      
      if (location) {
        console.log('Location Name:', location.name)
        console.log('All Shifts in Location:', location.shifts)
        
        // ใช้ทุกกะ ไม่ filter ตามเวลา
        const shifts = location.shifts
        console.log('Available Shifts (All):', shifts)
        console.log('Number of Available Shifts:', shifts.length)
        console.log('Current Time:', new Date().toLocaleTimeString())
        
        if (shifts.length > 1) {
          // Multiple shifts available, show selector
          console.log('>>> Showing Shift Selector')
          setAvailableShifts(shifts)
          setShowShiftSelector(true)
        } else if (shifts.length === 1) {
          // Only one shift, select automatically
          console.log('>>> Auto selecting single shift:', shifts[0])
          setSelectedShift(shifts[0])
          await checkIn(shifts[0])
        } else {
          // No shifts available, check in without shift
          console.log('>>> No shifts available, checking in without shift')
          await checkIn()
        }
      } else {
        // Location not found, check in without shift
        console.log('>>> Location not found in locations list')
        await checkIn()
      }
    } else {
      // Offsite check-in, no shift needed
      console.log('>>> Offsite check-in or cannot check in')
      console.log('>>> Reason:', locationCheckResult?.reason)
      await checkIn()
    }
  }

  const handleShiftSelect = async (shift: Shift) => {
    setSelectedShift(shift)
    setShowShiftSelector(false)
    await checkIn(shift)
  }

  const handleCheckOut = async () => {
    if (!currentPosition) {
      await getCurrentLocation()
    }
    await checkOut(note)
    setNote('')
    setShowNote(false)
  }

  if (loading) {
    return <TechLoader />
  }

  const workingTime = getWorkingTime()

  // Render Map Component (used in both check-in and checkout)
  const renderMap = () => {
    if (!currentPosition) return null
    
    return (
      <div className="mb-4 rounded-lg overflow-hidden h-[400px]">
        <CheckInMap
          userLat={currentPosition.coords.latitude}
          userLng={currentPosition.coords.longitude}
          locationCheckResult={locationCheckResult}
          zoom={16}
        />
      </div>
    )
  }

  // Already checked in - Show checkout UI
  if (currentCheckIn) {
    const checkinTime = currentCheckIn.checkinTime instanceof Date 
      ? currentCheckIn.checkinTime 
      : new Date(currentCheckIn.checkinTime)

    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          {/* Status */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse" />
              <span className="font-medium text-gray-900">กำลังทำงาน</span>
            </div>
            <Badge variant="success" className="text-xs">
              เช็คอิน {format(checkinTime, 'HH:mm')}
            </Badge>
          </div>

          {/* Working Time */}
          <div className="text-center mb-6">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900">{workingTime.hours}</span>
              <span className="text-sm text-gray-600">ชม.</span>
              <span className="text-2xl font-bold text-gray-900 ml-1">{String(workingTime.minutes).padStart(2, '0')}</span>
              <span className="text-sm text-gray-600">นาที</span>
              <span className="text-xl font-bold text-gray-900 ml-1">{String(workingTime.seconds).padStart(2, '0')}</span>
              <span className="text-sm text-gray-600">วินาที</span>
            </div>
          </div>

          {/* Location & Shift Info */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <MapPin className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">
                {currentCheckIn.primaryLocationName || 'นอกสถานที่'}
              </span>
            </div>
            
            {currentCheckIn.selectedShiftName && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-blue-700">
                  {currentCheckIn.selectedShiftName} ({currentCheckIn.shiftStartTime} - {currentCheckIn.shiftEndTime})
                </span>
              </div>
            )}
          </div>

          {/* Map */}
          {renderMap()}

          {/* Note Section */}
          {showNote ? (
            <div className="mb-4 space-y-2">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="หมายเหตุ เช่น ทำ OT, งาน Midnight Sale..."
                rows={2}
                className="text-sm"
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNote(false)
                  setNote('')
                }}
                className="text-xs"
              >
                ยกเลิก
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNote(true)}
              className="w-full mb-3 text-sm"
            >
              + เพิ่มหมายเหตุ
            </Button>
          )}
          
          {/* Checkout Button */}
          <Button
            onClick={handleCheckOut}
            disabled={isCheckingOut}
            className="w-full h-12 text-base font-medium bg-gradient-to-r from-red-500 to-rose-600"
            size="lg"
          >
            {isCheckingOut ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังเช็คเอาท์...
              </span>
            ) : (
              'เช็คเอาท์'
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Not checked in - Show check-in UI
  return (
    <>
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          {/* Clock */}
          <div className="text-center mb-6">
            <p className="text-4xl font-bold text-gray-900">
              {format(currentTime, 'HH:mm:ss')}
            </p>
            <p className="text-gray-600 mt-1">
              {format(currentTime, 'EEEE d MMMM', { locale: th })}
            </p>
          </div>

          {/* Map */}
          {renderMap()}

          {/* Status Messages */}
          {!currentPosition && !error && (
            <Alert className="mb-4">
              <MapPin className="h-4 w-4" />
              <AlertDescription>
                กำลังขอตำแหน่ง กรุณาอนุญาตการเข้าถึงตำแหน่ง
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="error" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {locationCheckResult && !locationCheckResult.canCheckIn && (
            <Alert variant="error" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {locationCheckResult.reason}
                {locationCheckResult.nearestLocation && (
                  <span className="block text-sm mt-1">
                    ใกล้ {locationCheckResult.nearestLocation.name} ({locationCheckResult.nearestLocation.distance} เมตร)
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {locationCheckResult && locationCheckResult.canCheckIn && (
            <div className="flex items-center justify-center gap-2 mb-4 text-teal-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">พื้นที่ที่อนุญาต</span>
            </div>
          )}

          {/* Check-in Button */}
          <Button
            onClick={handleCheckInClick}
            disabled={
              isCheckingIn || 
              !locationCheckResult || 
              !locationCheckResult.canCheckIn
            }
            className="w-full h-12 text-base font-medium bg-gradient-to-r from-teal-500 to-emerald-600"
            size="lg"
          >
            {isCheckingIn ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังเช็คอิน...
              </span>
            ) : !currentPosition ? (
              'กำลังขอตำแหน่ง...'
            ) : (
              'เช็คอิน'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Shift Selector Modal */}
      {showShiftSelector && (
        <ShiftSelector
          shifts={availableShifts}
          onSelect={handleShiftSelect}
          onCancel={() => setShowShiftSelector(false)}
          currentTime={currentTime}
        />
      )}
    </>
  )
}