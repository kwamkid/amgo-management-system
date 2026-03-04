// components/checkin/CheckInButton.tsx

'use client'

import { useState, useEffect } from 'react'
import { useCheckIn } from '@/hooks/useCheckIn'
import { useLocations } from '@/hooks/useLocations'
import { useAuth } from '@/hooks/useAuth'
import {
  MapPin,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle,
  Home,
  Camera
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import TechLoader from '@/components/shared/TechLoader'
import ShiftSelector from './ShiftSelector'
import CameraCapture from './CameraCapture'
import { Shift } from '@/types/location'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase/client'

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

  const { userData } = useAuth()
  const { locations } = useLocations(true)

  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  // Shift selector state
  const [showShiftSelector, setShowShiftSelector] = useState(false)
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([])

  // Camera / photo state
  const [showCamera, setShowCamera] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  // Pending check-in params stored while camera is open
  const [pendingShift, setPendingShift] = useState<Shift | undefined>(undefined)
  const [pendingIsWFH, setPendingIsWFH] = useState(false)

  // Auto get location on mount
  useEffect(() => {
    if (!loading && !currentPosition) {
      getCurrentLocation()
    }
  }, [loading])

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Upload selfie blob to Firebase Storage
  const uploadPhoto = async (blob: Blob): Promise<string> => {
    const dateStr = format(new Date(), 'yyyy-MM-dd')
    const timestamp = Date.now()
    const storageRef = ref(storage, `checkin-photos/${userData!.id}/${dateStr}/${timestamp}.jpg`)
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' })
    return getDownloadURL(storageRef)
  }

  // Working time counter
  const getWorkingTime = () => {
    if (!currentCheckIn?.checkinTime) return { hours: 0, minutes: 0, seconds: 0 }
    const checkinTime = currentCheckIn.checkinTime instanceof Date
      ? currentCheckIn.checkinTime
      : new Date(currentCheckIn.checkinTime)
    const totalSeconds = Math.floor((currentTime.getTime() - checkinTime.getTime()) / 1000)
    return {
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    }
  }

  // Determine shift (if any) and open camera
  const handleCheckInClick = async (isWFH = false) => {
    if (!currentPosition || !locationCheckResult) {
      await getCurrentLocation()
      return
    }

    let shift: Shift | undefined = undefined

    if (!isWFH && locationCheckResult.canCheckIn && locationCheckResult.locationsInRange.length > 0) {
      const primaryLocation = locationCheckResult.locationsInRange[0]
      const location = locations.find(l => l.id === primaryLocation.id)

      if (location && location.shifts.length > 1) {
        // Multiple shifts: show selector first, camera comes after
        setAvailableShifts(location.shifts)
        setPendingIsWFH(false)
        setShowShiftSelector(true)
        return
      } else if (location && location.shifts.length === 1) {
        shift = location.shifts[0]
      }
    }

    // Open camera with stored pending action
    setPendingShift(shift)
    setPendingIsWFH(isWFH)
    setShowCamera(true)
  }

  // After shift selected → open camera
  const handleShiftSelect = (shift: Shift) => {
    setShowShiftSelector(false)
    setPendingShift(shift)
    setPendingIsWFH(false)
    setShowCamera(true)
  }

  // Camera confirmed → upload → check in
  const handlePhotoCapture = async (blob: Blob) => {
    setIsUploadingPhoto(true)
    try {
      const photoUrl = await uploadPhoto(blob)
      setShowCamera(false)
      await checkIn(pendingShift, pendingIsWFH, photoUrl)
    } catch (e) {
      console.error('Photo upload failed:', e)
      // Still allow check-in without photo if upload fails
      setShowCamera(false)
      await checkIn(pendingShift, pendingIsWFH)
    } finally {
      setIsUploadingPhoto(false)
      setPendingShift(undefined)
      setPendingIsWFH(false)
    }
  }

  const handleCheckOut = async () => {
    await checkOut(note)
    setNote('')
    setShowNote(false)
  }

  if (loading) return <TechLoader />

  const workingTime = getWorkingTime()

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

  // ─── Already checked in → show checkout UI ───────────────────────────────
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

          {/* Selfie photo (if available) */}
          {currentCheckIn.checkinPhotoUrl && (
            <div className="flex justify-center mb-4">
              <img
                src={currentCheckIn.checkinPhotoUrl}
                alt="selfie check-in"
                className="w-20 h-20 rounded-full object-cover border-2 border-teal-300 shadow"
              />
            </div>
          )}

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
              {currentCheckIn.checkinType === 'wfh' ? (
                <Home className="w-4 h-4 text-blue-500" />
              ) : (
                <MapPin className="w-4 h-4 text-gray-500" />
              )}
              <span className="text-sm text-gray-700">
                {currentCheckIn.checkinType === 'wfh'
                  ? 'Work From Home (WFH)'
                  : currentCheckIn.primaryLocationName || 'เช็คอินนอกสถานที่'}
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

          {/* Location guard warning: must checkout at same location as check-in */}
          {currentCheckIn.checkinType === 'onsite' && !userData?.allowCheckInOutsideLocation && (() => {
            const checkInLocationName = currentCheckIn.primaryLocationName || 'สถานที่ทำงาน'
            // Check if user is near the specific check-in location
            const inRange = locationCheckResult?.locationsInRange.some(
              l => l.id === currentCheckIn.primaryLocationId
            )
            return (
              <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm ${
                inRange
                  ? 'bg-green-50 text-green-700'
                  : !currentPosition
                  ? 'bg-yellow-50 text-yellow-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                <MapPin className="w-4 h-4 shrink-0" />
                <span>
                  {!currentPosition
                    ? `กำลังตรวจสอบตำแหน่ง (ต้องเช็คเอาท์ที่ ${checkInLocationName})`
                    : inRange
                    ? `อยู่ที่ ${checkInLocationName} — สามารถเช็คเอาท์ได้`
                    : `ต้องเช็คเอาท์ที่ ${checkInLocationName} เท่านั้น`}
                </span>
              </div>
            )
          })()}

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
                onClick={() => { setShowNote(false); setNote('') }}
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

  // ─── Not checked in → show check-in UI ───────────────────────────────────
  const isOffsite = locationCheckResult?.canCheckIn && locationCheckResult.locationsInRange.length === 0
  const showWFHOption = isOffsite && userData?.allowWorkFromHome

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

          {locationCheckResult?.canCheckIn && (
            <div className="flex items-center justify-center gap-2 mb-4 text-teal-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">
                {locationCheckResult.locationsInRange.length > 0
                  ? 'พื้นที่ที่อนุญาต'
                  : 'อนุญาตให้เช็คอินนอกสถานที่'}
              </span>
            </div>
          )}

          {/* Camera info notice */}
          {locationCheckResult?.canCheckIn && (
            <p className="text-xs text-gray-500 text-center mb-3 flex items-center justify-center gap-1">
              <Camera className="w-3 h-3" />
              ระบบจะขอถ่ายรูปยืนยันตัวตนก่อนเช็คอิน
            </p>
          )}

          {/* Check-in Button(s) */}
          {showWFHOption ? (
            <div className="space-y-2">
              <Button
                onClick={() => handleCheckInClick(false)}
                disabled={isCheckingIn || isUploadingPhoto}
                className="w-full h-12 text-base font-medium bg-gradient-to-r from-teal-500 to-emerald-600"
                size="lg"
              >
                {isCheckingIn ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />กำลังเช็คอิน...
                  </span>
                ) : 'เช็คอินนอกสถานที่'}
              </Button>
              <Button
                onClick={() => handleCheckInClick(true)}
                disabled={isCheckingIn || isUploadingPhoto}
                variant="outline"
                className="w-full h-12 text-base font-medium border-blue-400 text-blue-700 hover:bg-blue-50"
                size="lg"
              >
                {isCheckingIn ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />กำลังเช็คอิน...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Home className="w-4 h-4" />Work From Home (WFH)
                  </span>
                )}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => handleCheckInClick(false)}
              disabled={isCheckingIn || isUploadingPhoto || !locationCheckResult?.canCheckIn}
              className="w-full h-12 text-base font-medium bg-gradient-to-r from-teal-500 to-emerald-600"
              size="lg"
            >
              {isCheckingIn || isUploadingPhoto ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isUploadingPhoto ? 'กำลังบันทึกรูป...' : 'กำลังเช็คอิน...'}
                </span>
              ) : !currentPosition ? (
                'กำลังขอตำแหน่ง...'
              ) : (
                'เช็คอิน'
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Shift Selector */}
      {showShiftSelector && (
        <ShiftSelector
          shifts={availableShifts}
          onSelect={handleShiftSelect}
          onCancel={() => setShowShiftSelector(false)}
          currentTime={currentTime}
        />
      )}

      {/* Camera Capture */}
      {showCamera && (
        <CameraCapture
          onCapture={handlePhotoCapture}
          onCancel={() => {
            setShowCamera(false)
            setPendingShift(undefined)
            setPendingIsWFH(false)
          }}
          uploading={isUploadingPhoto}
        />
      )}
    </>
  )
}
