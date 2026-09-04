// components/checkin/CheckInButton.tsx

'use client'

import { Skeleton } from '@/components/shared'

import { useState, useEffect } from 'react'
import { useCheckIn } from '@/hooks/useCheckIn'
import SwapDayPrompt from './SwapDayPrompt'
import StockPhotoCard from './StockPhotoCard'
import { useLocations } from '@/hooks/useLocations'
import { useAuth } from '@/hooks/useAuth'
import {
  MapPin,
  Loader2,
  AlertCircle,
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
import { Textarea } from '@/components/ui/textarea'
import TechLoader from '@/components/shared/TechLoader'
import ShiftSelector from './ShiftSelector'
import CameraCapture from './CameraCapture'
import { Shift } from '@/types/location'
import { uploadImage } from '@/lib/supabase/storage'
import StorageImage from '@/components/shared/StorageImage'

// Dynamic import CheckInMap
const CheckInMap = dynamic(
  () => import('./CheckInMap'),
  {
    ssr: false,
    loading: () => <Skeleton className="h-52 sm:h-[400px]" rows={7} />
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
    swapPromptDate,
    dismissSwapPrompt,
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

  // อัปโหลดรูปเซลฟี่ขึ้น Supabase Storage
  // คืนเป็น "path" ไม่ใช่ URL — bucket ไม่เปิดสาธารณะ ลิงก์ต้อง sign ตอนแสดงผล
  // และมีอายุจำกัด (ของเดิมคืนลิงก์ที่ใครมีก็เปิดได้ตลอดกาล)
  const uploadPhoto = (blob: Blob): Promise<string> =>
    uploadImage('checkin-photos', userData!.id!, blob)

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
      <div className="mb-3 rounded-lg overflow-hidden h-52 sm:h-[400px]">
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

    // ── เช็คอินแล้ว: "งานที่ยังไม่เสร็จ" (รูปหน้าร้าน/สต็อก) ขึ้นก่อน ส่วนเช็คเอาท์ย่อเหลือแถวเดียว
    //    (เจ้าของสั่ง 4 ก.ย. 69) · แผนที่ไม่แสดงในสถานะนี้ — ตัวกันตำแหน่งยังทำงานจากพิกัดอยู่
    const place =
      currentCheckIn.checkinType === 'wfh'
        ? 'Work From Home'
        : currentCheckIn.primaryLocationName || 'นอกสถานที่'
    const shift = currentCheckIn.selectedShiftName
      ? `${currentCheckIn.selectedShiftName} ${currentCheckIn.shiftStartTime}–${currentCheckIn.shiftEndTime}`
      : ''

    return (
      <>
        {/* รูปสต็อก/หน้าร้านประจำวัน — เมนูอยู่หน้าเขาเลยว่าวันนี้ยังไม่ได้ถ่าย โผล่เฉพาะคนที่ถูกตั้งค่า */}
        {userData?.requiresStockPhotos && (
          <div className="mb-3">
            <StockPhotoCard
              locationId={currentCheckIn.primaryLocationId ?? null}
              locationName={currentCheckIn.primaryLocationName ?? ''}
            />
          </div>
        )}

        <Card className="border-0 shadow-md">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {currentCheckIn.checkinPhotoUrl ? (
                  <StorageImage
                    bucket="checkin-photos"
                    path={currentCheckIn.checkinPhotoUrl}
                    alt="รูปตอนเช็คอิน"
                    className="h-11 w-11 shrink-0 rounded-full border-2 border-teal-300 object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50">
                    <div className="h-3 w-3 animate-pulse rounded-full bg-teal-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-gray-900">
                    {currentCheckIn.checkinType === 'wfh' ? (
                      <Home className="h-4 w-4 shrink-0 text-blue-500" />
                    ) : (
                      <MapPin className="h-4 w-4 shrink-0 text-teal-600" />
                    )}
                    <span className="truncate">
                      เช็คอิน {format(checkinTime, 'HH:mm')} · {place}
                    </span>
                  </p>
                  <p className="truncate text-sm text-gray-500">
                    ทำงานมา {workingTime.hours} ชม. {String(workingTime.minutes).padStart(2, '0')} นาที
                    {shift && ` · ${shift}`}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleCheckOut}
                disabled={isCheckingOut}
                className="h-10 shrink-0 bg-gradient-to-r from-red-500 to-rose-600 px-4 text-sm font-medium"
              >
                {isCheckingOut ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังออก…
                  </span>
                ) : (
                  'เช็คเอาท์'
                )}
              </Button>
            </div>

            {/* ต้องเช็คเอาท์ที่สาขาเดียวกับที่เช็คอิน */}
            {currentCheckIn.checkinType === 'onsite' && !userData?.allowCheckInOutsideLocation && (() => {
              const checkInLocationName = currentCheckIn.primaryLocationName || 'สถานที่ทำงาน'
              const inRange = locationCheckResult?.locationsInRange.some(
                l => l.id === currentCheckIn.primaryLocationId
              )
              return (
                <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  inRange
                    ? 'bg-green-50 text-green-700'
                    : !currentPosition
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>
                    {!currentPosition
                      ? `กำลังตรวจสอบตำแหน่ง (ต้องเช็คเอาท์ที่ ${checkInLocationName})`
                      : inRange
                      ? `อยู่ที่ ${checkInLocationName} — เช็คเอาท์ได้`
                      : `ต้องเช็คเอาท์ที่ ${checkInLocationName} เท่านั้น`}
                  </span>
                </div>
              )
            })()}

            {/* หมายเหตุ — ซ่อนไว้หลังลิงก์ เปิดเมื่อจะพิมพ์ */}
            {showNote ? (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="หมายเหตุ เช่น ทำ OT, งาน Midnight Sale..."
                  rows={2}
                  className="text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setShowNote(false); setNote('') }}
                  className="text-sm text-gray-500 underline-offset-2 hover:underline"
                >
                  ยกเลิกหมายเหตุ
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                className="mt-2 text-sm text-gray-500 underline-offset-2 hover:underline"
              >
                + หมายเหตุตอนเช็คเอาท์
              </button>
            )}
          </CardContent>
        </Card>

        {/* เช็คอินตรงวันหยุดตัวเอง — ถามวันหยุดชดเชยทันที ปิดไม่ได้
            ต้องอยู่ในกิ่งนี้ (เช็คอินอยู่) — เดิมวางไว้ท้ายไฟล์ซึ่งเป็นกิ่ง "ยังไม่เช็คอิน"
            จึงไม่เคยเด้งจริง (เจอ 4 ก.ย. 69 ตอนวางการ์ดรูปแล้ว tsc บอก never) */}
        {swapPromptDate && (
          <SwapDayPrompt workedDate={swapPromptDate} onDone={dismissSwapPrompt} />
        )}
      </>
    )
  }

  // ─── Not checked in → show check-in UI ───────────────────────────────────
  const isOffsite = locationCheckResult?.canCheckIn && locationCheckResult.locationsInRange.length === 0
  // ปุ่ม WFH เห็นเฉพาะคนที่ HR ติ๊ก "ทำงานที่บ้านได้" ไว้ (แท็บสถานที่เช็คอิน)
  // คนอื่นที่ออกนอกรัศมีได้ เห็นแค่ปุ่มนอกสถานที่ — กันติ๊ก WFH มั่ว
  const showWFHOption = isOffsite && userData?.allowWorkFromHome

  return (
    <>
      <Card className="border-0 shadow-md">
        <CardContent className="p-4 sm:p-6">
          {/* Clock */}
          <div className="text-center mb-3 sm:mb-6">
            <p className="text-3xl font-bold text-gray-900 sm:text-4xl">
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
            <div className="flex items-center justify-center gap-2 mb-2 text-teal-600">
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
            <p className="text-xs text-gray-500 text-center mb-2 flex items-center justify-center gap-1">
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
