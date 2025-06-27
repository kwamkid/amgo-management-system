// components/checkin/CheckInButton.tsx

'use client'

import { useState } from 'react'
import { useCheckIn } from '@/hooks/useCheckIn'
import { 
  MapPin, 
  Loader2,
  X,
  AlertCircle
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

// Dynamic import CheckInMap untuk menghindari SSR issues dengan Google Maps
const CheckInMap = dynamic(
  () => import('./CheckInMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
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
  
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')

  // Calculate working hours
  const getWorkingTime = () => {
    if (!currentCheckIn?.checkinTime) return { hours: 0, minutes: 0 }
    
    const checkinTime = currentCheckIn.checkinTime instanceof Date 
      ? currentCheckIn.checkinTime 
      : new Date(currentCheckIn.checkinTime)
    
    const now = new Date()
    const totalMinutes = Math.floor((now.getTime() - checkinTime.getTime()) / (1000 * 60))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    
    return { hours, minutes }
  }

  const handleCheckIn = async () => {
    if (!currentPosition) {
      await getCurrentLocation()
    }
    await checkIn()
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

  // Mobile-first design - Already checked in (Checkout view)
  if (currentCheckIn) {
    const checkinTime = currentCheckIn.checkinTime instanceof Date 
      ? currentCheckIn.checkinTime 
      : new Date(currentCheckIn.checkinTime)

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Map Container - Fixed 400px for checkout */}
        <div className="relative h-[400px]">
          {/* Real Google Map */}
          {currentPosition ? (
            <CheckInMap
              userLat={currentPosition.coords.latitude}
              userLng={currentPosition.coords.longitude}
              locationCheckResult={locationCheckResult}
            />
          ) : (
            /* Map Placeholder */
            <div className={`w-full h-full bg-gradient-to-br ${gradients.grayLight} relative`}>
              <div className="absolute inset-0 flex items-center justify-center">
                <MapPin className="w-16 h-16 text-gray-300" />
              </div>
            </div>
          )}
          
          {/* Working Time Overlay */}
          <Card className="absolute top-4 left-4 right-4 bg-white/95 backdrop-blur-sm shadow-xl z-10 border-0">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="inline-flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">{workingTime.hours}</span>
                  <span className="text-lg text-gray-600">ชม.</span>
                  <span className="text-3xl font-bold text-gray-900 ml-2">{workingTime.minutes}</span>
                  <span className="text-lg text-gray-600">นาที</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  เช็คอิน {format(checkinTime, 'HH:mm', { locale: th })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Status Badge */}
          <div className="absolute top-4 right-4 z-10">
            <Badge variant="success" className="shadow-lg">
              กำลังทำงาน
            </Badge>
          </div>
        </div>

        {/* Bottom Content Area */}
        <div className="bg-white shadow-[0_-4px_10px_-2px_rgb(0,0,0,0.1)]">
          <div className="p-5">
            {/* Location Info */}
            <Card className={`bg-gradient-to-r ${gradients.grayLight} border-0 mb-5`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 bg-gradient-to-br ${gradients.successLight} rounded-full flex items-center justify-center`}>
                    <MapPin className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {currentCheckIn.primaryLocationName || 'นอกสถานที่'}
                    </p>
                    {currentCheckIn.selectedShiftName && (
                      <p className="text-sm text-gray-600">
                        {currentCheckIn.selectedShiftName}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Note Section */}
            {showNote && (
              <Card className="mb-5 border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">หมายเหตุ</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowNote(false)
                        setNote('')
                      }}
                      className="h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="เช่น ทำ OT, งาน Midnight Sale..."
                    rows={3}
                    autoFocus
                  />
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            {!showNote && (
              <Button
                variant="ghost"
                onClick={() => setShowNote(true)}
                className="w-full mb-3"
              >
                + เพิ่มหมายเหตุ
              </Button>
            )}
            
            <Button
              onClick={handleCheckOut}
              disabled={isCheckingOut}
              className={`w-full h-16 text-lg font-semibold bg-gradient-to-r ${gradients.primary} shadow-lg shadow-red-600/20`}
              size="lg"
            >
              {isCheckingOut ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  กำลังเช็คเอาท์...
                </span>
              ) : (
                'เช็คเอาท์'
              )}
            </Button>

            {/* Help text */}
            <div className="text-center mt-3">
              <p className="text-xs text-gray-400">
                กดปุ่มเพื่อบันทึกเวลาออกงาน
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Mobile-first design - Not checked in
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Map Container - Fixed 550px */}
      <div className="relative h-[550px]">
        {/* Real Google Map */}
        {currentPosition ? (
          <CheckInMap
            userLat={currentPosition.coords.latitude}
            userLng={currentPosition.coords.longitude}
            locationCheckResult={locationCheckResult}
          />
        ) : (
          /* Map Placeholder while getting location */
          <div className={`w-full h-full bg-gradient-to-br ${gradients.grayLight} relative overflow-hidden`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-teal-200 rounded-full w-64 h-64 opacity-20 animate-ping" />
                <div className="absolute inset-0 bg-teal-300 rounded-full w-48 h-48 opacity-20 animate-ping animation-delay-200" />
                <MapPin className="w-20 h-20 text-teal-500 relative z-10" />
              </div>
            </div>
            
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-sm text-gray-600">
                กำลังขอตำแหน่ง...
              </p>
            </div>
          </div>
        )}
        
        {/* Clock Overlay */}
        <Card className="absolute top-4 left-4 right-4 bg-white/95 backdrop-blur-sm shadow-xl z-10 border-0">
          <CardContent className="p-4">
            <p className="text-5xl font-bold text-gray-900 text-center">
              {format(new Date(), 'HH:mm')}
            </p>
            <p className="text-gray-600 text-center mt-1">
              {format(new Date(), 'EEEE d MMMM', { locale: th })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Action Area */}
      <div className="bg-white shadow-[0_-4px_10px_-2px_rgb(0,0,0,0.1)]">
        <div className="p-5">
          {/* Status Section */}
          {/* Error Status */}
          {locationCheckResult && !locationCheckResult.canCheckIn && (
            <Alert variant="error" className="mb-5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="font-medium">
                {locationCheckResult.reason}
                {locationCheckResult.nearestLocation && (
                  <span className="block text-sm mt-1">
                    ใกล้ {locationCheckResult.nearestLocation.name}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Success Status */}
          {locationCheckResult && locationCheckResult.canCheckIn && (
            <div className="text-center mb-5">
              <Badge variant="success" className="px-4 py-2">
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse mr-2" />
                พื้นที่ที่อนุญาต
              </Badge>
            </div>
          )}

          {/* Check-in Button */}
          <Button
            onClick={handleCheckIn}
            disabled={
              isCheckingIn || 
              !locationCheckResult || 
              !locationCheckResult.canCheckIn
            }
            className={`w-full h-16 text-lg font-semibold bg-gradient-to-r ${gradients.success} shadow-lg shadow-teal-600/20`}
            size="lg"
          >
            {isCheckingIn ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                กำลังเช็คอิน...
              </span>
            ) : !currentPosition ? (
              'กำลังขอตำแหน่ง...'
            ) : (
              'เช็คอิน'
            )}
          </Button>

          {/* Help text */}
          <div className="text-center mt-3">
            {!currentPosition && (
              <>
                <p className="text-xs text-gray-500">
                  กรุณาอนุญาตการเข้าถึงตำแหน่ง
                </p>
                {error && (
                  <p className="text-xs text-red-500 mt-1">
                    {error}
                  </p>
                )}
              </>
            )}
            {currentPosition && locationCheckResult?.canCheckIn && (
              <p className="text-xs text-gray-400">
                กดปุ่มเพื่อบันทึกเวลาเข้างาน
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}