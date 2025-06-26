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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-red-600" />
      </div>
    )
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
            <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-50 to-white relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <MapPin className="w-16 h-16 text-gray-300" />
              </div>
            </div>
          )}
          
          {/* Working Time Overlay */}
          <div className="absolute top-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-xl z-10">
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
          </div>

          {/* Status Badge */}
          <div className="absolute top-4 right-4 z-10">
            <div className="bg-green-500 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-lg">
              กำลังทำงาน
            </div>
          </div>
        </div>

        {/* Bottom Content Area */}
        <div className="bg-white shadow-[0_-4px_10px_-2px_rgb(0,0,0,0.1)]">
          <div className="p-5">
            {/* Location Info */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-green-600" />
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
            </div>

            {/* Note Section */}
            {showNote && (
              <div className="mb-5">
                <div className="bg-white rounded-2xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">หมายเหตุ</span>
                    <button
                      onClick={() => {
                        setShowNote(false)
                        setNote('')
                      }}
                      className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="เช่น ทำ OT, งาน Midnight Sale..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-gray-900"
                    rows={3}
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!showNote && (
              <button
                onClick={() => setShowNote(true)}
                className="w-full py-3 text-gray-600 font-medium hover:text-gray-800 transition-colors mb-3"
              >
                + เพิ่มหมายเหตุ
              </button>
            )}
            
            <button
              onClick={handleCheckOut}
              disabled={isCheckingOut}
              className="w-full bg-red-600 text-white font-semibold py-5 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/20"
            >
              {isCheckingOut ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  กำลังเช็คเอาท์...
                </span>
              ) : (
                'เช็คเอาท์'
              )}
            </button>

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
          <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-50 to-white relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-green-200 rounded-full w-64 h-64 opacity-20 animate-ping" />
                <div className="absolute inset-0 bg-green-300 rounded-full w-48 h-48 opacity-20 animate-ping animation-delay-200" />
                <MapPin className="w-20 h-20 text-green-500 relative z-10" />
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
        <div className="absolute top-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-xl z-10">
          <p className="text-5xl font-bold text-gray-900 text-center">
            {format(new Date(), 'HH:mm')}
          </p>
          <p className="text-gray-600 text-center mt-1">
            {format(new Date(), 'EEEE d MMMM', { locale: th })}
          </p>
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="bg-white shadow-[0_-4px_10px_-2px_rgb(0,0,0,0.1)]">
        <div className="p-5">
          {/* Status Section */}
          {/* Error Status */}
          {locationCheckResult && !locationCheckResult.canCheckIn && (
            <div className="bg-red-50 rounded-2xl p-4 mb-5 border border-red-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-red-800">{locationCheckResult.reason}</p>
                  {locationCheckResult.nearestLocation && (
                    <p className="text-sm text-red-600 mt-1">
                      ใกล้ {locationCheckResult.nearestLocation.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Success Status */}
          {locationCheckResult && locationCheckResult.canCheckIn && (
            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <p className="text-sm font-medium text-green-800">
                  พื้นที่ที่อนุญาต
                </p>
              </div>
            </div>
          )}

          {/* Check-in Button */}
          <button
            onClick={handleCheckIn}
            disabled={
              isCheckingIn || 
              !locationCheckResult || 
              !locationCheckResult.canCheckIn
            }
            className="w-full bg-green-600 text-white font-semibold py-5 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-600/20"
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
          </button>

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