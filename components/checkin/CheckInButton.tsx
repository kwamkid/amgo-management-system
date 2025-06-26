// components/checkin/CheckInButton.tsx

'use client'

import { useState, useEffect } from 'react'
import { useCheckIn } from '@/hooks/useCheckIn'
import { 
  MapPin, 
  Loader2,
  X
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import dynamic from 'next/dynamic'

// Dynamic import for map
const CheckInMap = dynamic(() => import('./CheckInMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  )
})

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
    loading
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

  // Mobile-first design - Already checked in
  if (currentCheckIn) {
    const checkinTime = currentCheckIn.checkinTime instanceof Date 
      ? currentCheckIn.checkinTime 
      : new Date(currentCheckIn.checkinTime)

    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
        {/* Status Bar */}
        <div className="bg-green-600 text-white px-5 py-4 safe-area-top">
          <p className="text-center font-medium">กำลังทำงาน</p>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col px-5 py-6">
          {/* Time Display */}
          <div className="text-center mb-8">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-6xl font-bold text-gray-900">{workingTime.hours}</span>
              <span className="text-2xl text-gray-600">ชม.</span>
              <span className="text-4xl font-bold text-gray-900 ml-2">{workingTime.minutes}</span>
              <span className="text-2xl text-gray-600">นาที</span>
            </div>
            <p className="text-gray-500 mt-2">
              เช็คอิน {format(checkinTime, 'HH:mm', { locale: th })}
            </p>
          </div>

          {/* Location Info */}
          <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm">
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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Note Section */}
          {showNote && (
            <div className="mb-4 animate-in slide-in-from-bottom">
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">หมายเหตุ</span>
                  <button
                    onClick={() => {
                      setShowNote(false)
                      setNote('')
                    }}
                    className="p-1"
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
          <div className="space-y-3">
            {!showNote && (
              <button
                onClick={() => setShowNote(true)}
                className="w-full py-4 text-gray-600 font-medium"
              >
                + เพิ่มหมายเหตุ
              </button>
            )}
            
            <button
              onClick={handleCheckOut}
              disabled={isCheckingOut}
              className="w-full bg-red-600 text-white font-semibold py-5 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/20"
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
          </div>
        </div>
      </div>
    )
  }

  // Mobile-first design - Not checked in
  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Map Container - 60% of screen */}
      <div className="flex-1 relative" style={{ maxHeight: '60vh' }}>
        {currentPosition ? (
          <CheckInMap
            userLat={currentPosition.coords.latitude}
            userLng={currentPosition.coords.longitude}
            locationCheckResult={locationCheckResult}
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">กำลังขอตำแหน่ง...</p>
            </div>
          </div>
        )}
        
        {/* Clock Overlay */}
        <div className="absolute top-4 left-4 right-4 bg-white/90 backdrop-blur rounded-2xl p-4 shadow-lg">
          <p className="text-4xl font-bold text-gray-900 text-center">
            {format(new Date(), 'HH:mm')}
          </p>
          <p className="text-gray-600 text-center text-sm">
            {format(new Date(), 'EEEE d MMMM', { locale: th })}
          </p>
        </div>
      </div>

      {/* Bottom Section - 40% of screen */}
      <div className="bg-white shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.1)]">
        {/* Location Status */}
        {locationCheckResult && (
          <div className="px-5 py-4 border-b border-gray-100">
            {locationCheckResult.canCheckIn ? (
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">พร้อมเช็คอิน</p>
                  {locationCheckResult.locationsInRange.length > 0 && (
                    <p className="text-sm text-gray-600">
                      {locationCheckResult.locationsInRange[0].name}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <div className="flex-1">
                  <p className="font-semibold text-red-600">{locationCheckResult.reason}</p>
                  {locationCheckResult.nearestLocation && (
                    <p className="text-sm text-gray-600">
                      ใกล้ {locationCheckResult.nearestLocation.name}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Check-in Button */}
        <div className="px-5 py-5">
          <button
            onClick={handleCheckIn}
            disabled={
              isCheckingIn || 
              !locationCheckResult || 
              !locationCheckResult.canCheckIn
            }
            className="w-full bg-green-600 text-white font-semibold py-4 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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

          {/* Permission note */}
          {!currentPosition && (
            <p className="text-xs text-gray-500 text-center mt-3">
              กรุณาอนุญาตการเข้าถึงตำแหน่ง
            </p>
          )}
        </div>
      </div>
    </div>
  )
}// components/checkin/CheckInButton.tsx

'use client'

import { useState } from 'react'
import { useCheckIn } from '@/hooks/useCheckIn'
import { 
  MapPin, 
  Loader2,
  X
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

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
    loading
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

  // Mobile-first design - Already checked in
  if (currentCheckIn) {
    const checkinTime = currentCheckIn.checkinTime instanceof Date 
      ? currentCheckIn.checkinTime 
      : new Date(currentCheckIn.checkinTime)

    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
        {/* Status Bar */}
        <div className="bg-green-600 text-white px-5 py-4 safe-area-top">
          <p className="text-center font-medium">กำลังทำงาน</p>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col px-5 py-6">
          {/* Time Display */}
          <div className="text-center mb-8">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-6xl font-bold text-gray-900">{workingTime.hours}</span>
              <span className="text-2xl text-gray-600">ชม.</span>
              <span className="text-4xl font-bold text-gray-900 ml-2">{workingTime.minutes}</span>
              <span className="text-2xl text-gray-600">นาที</span>
            </div>
            <p className="text-gray-500 mt-2">
              เช็คอิน {format(checkinTime, 'HH:mm', { locale: th })}
            </p>
          </div>

          {/* Location Info */}
          <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm">
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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Note Section */}
          {showNote && (
            <div className="mb-4 animate-in slide-in-from-bottom">
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">หมายเหตุ</span>
                  <button
                    onClick={() => {
                      setShowNote(false)
                      setNote('')
                    }}
                    className="p-1"
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
          <div className="space-y-3">
            {!showNote && (
              <button
                onClick={() => setShowNote(true)}
                className="w-full py-4 text-gray-600 font-medium"
              >
                + เพิ่มหมายเหตุ
              </button>
            )}
            
            <button
              onClick={handleCheckOut}
              disabled={isCheckingOut}
              className="w-full bg-red-600 text-white font-semibold py-5 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/20"
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
          </div>
        </div>
      </div>
    )
  }

  // Mobile-first design - Not checked in
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col">
      {/* Map Display - Show even without permission */}
      <div className="flex-1 relative">
        {/* Simple Map Placeholder */}
        <div className="absolute inset-0 bg-gray-100">
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">แผนที่จะแสดงที่นี่</p>
            </div>
          </div>
        </div>
        
        {/* Clock Overlay */}
        <div className="absolute top-4 left-4 right-4 bg-white/90 backdrop-blur rounded-2xl p-4 shadow-lg">
          <p className="text-5xl font-bold text-gray-900 text-center">
            {format(new Date(), 'HH:mm')}
          </p>
          <p className="text-gray-600 text-center mt-1">
            {format(new Date(), 'EEEE d MMMM', { locale: th })}
          </p>
        </div>

        {/* Location Status */}
        {locationCheckResult && (
          <div className="absolute bottom-24 left-4 right-4 bg-white rounded-2xl p-4 shadow-lg">
            {locationCheckResult.canCheckIn ? (
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">พร้อมเช็คอิน</p>
                  {locationCheckResult.locationsInRange.length > 0 && (
                    <p className="text-sm text-gray-600">
                      {locationCheckResult.locationsInRange[0].name}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <div className="flex-1">
                  <p className="font-semibold text-red-600">{locationCheckResult.reason}</p>
                  {locationCheckResult.nearestLocation && (
                    <p className="text-sm text-gray-600">
                      ใกล้ {locationCheckResult.nearestLocation.name}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Area */}
      <div className="px-5 pb-8 pt-4 bg-white safe-area-bottom">
        <button
          onClick={handleCheckIn}
          disabled={
            isCheckingIn || 
            !locationCheckResult || 
            !locationCheckResult.canCheckIn
          }
          className="w-full bg-green-600 text-white font-semibold py-5 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-600/20"
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

        {/* Permission note */}
        {!currentPosition && (
          <p className="text-xs text-gray-500 text-center mt-4">
            กรุณาอนุญาตการเข้าถึงตำแหน่ง
          </p>
        )}
      </div>
    </div>
  )
}