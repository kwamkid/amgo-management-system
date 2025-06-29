// hooks/useCheckIn.ts

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { useLocations } from '@/hooks/useLocations'
import { CheckInRecord, LocationCheckResult } from '@/types/checkin'
import { Shift } from '@/types/location'
import * as checkinService from '@/lib/services/checkinService'
import * as locationDetectionService from '@/lib/services/locationDetectionService'
import { DiscordNotificationService } from '@/lib/discord/notificationService'

interface UseCheckInReturn {
  // State
  currentCheckIn: CheckInRecord | null
  isCheckingIn: boolean
  isCheckingOut: boolean
  locationCheckResult: LocationCheckResult | null
  currentPosition: GeolocationPosition | null
  availableShifts: Shift[]
  selectedLocation: any | null
  showShiftSelector: boolean
  
  // Actions
  checkIn: (selectedShift?: Shift) => Promise<void>
  checkOut: (note?: string) => Promise<void>
  refreshStatus: () => Promise<void>
  getCurrentLocation: () => Promise<GeolocationPosition | undefined>
  prepareCheckIn: () => void
  cancelShiftSelection: () => void
  
  // Loading states
  loading: boolean
  error: string | null
}

export function useCheckIn(): UseCheckInReturn {
  const { userData } = useAuth()
  const { showToast } = useToast()
  const { locations } = useLocations(true) // Active locations only
  
  const [currentCheckIn, setCurrentCheckIn] = useState<CheckInRecord | null>(null)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null)
  const [locationCheckResult, setLocationCheckResult] = useState<LocationCheckResult | null>(null)
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([])
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null)
  const [showShiftSelector, setShowShiftSelector] = useState(false)
  
  // Refs to prevent multiple calls
  const isGettingLocation = useRef(false)
  const hasInitialized = useRef(false)

  // Fetch current check-in status
  const fetchCurrentStatus = async () => {
    if (!userData?.id) return
    
    try {
      setLoading(true)
      setError(null)
      
      const activeCheckIn = await checkinService.getActiveCheckIn(userData.id)
      setCurrentCheckIn(activeCheckIn)
    } catch (err) {
      console.error('Error fetching check-in status:', err)
      setError('ไม่สามารถโหลดข้อมูลการเช็คอินได้')
    } finally {
      setLoading(false)
    }
  }

  // Get current location - NO TOAST HERE
  const getCurrentLocation = async (): Promise<GeolocationPosition | undefined> => {
    // Prevent multiple simultaneous calls
    if (isGettingLocation.current) {
      console.log('[useCheckIn] Already getting location, skipping...')
      return undefined
    }
    
    try {
      isGettingLocation.current = true
      console.log('[useCheckIn] Getting location...')
      
      const position = await locationDetectionService.getCurrentLocation()
      setCurrentPosition(position)
      
      // Check location against allowed locations - NO TOAST
      if (userData && locations.length > 0) {
        const checkResult = locationDetectionService.checkUserLocation(
          position.coords.latitude,
          position.coords.longitude,
          locations,
          userData.allowedLocationIds || [],
          userData.allowCheckInOutsideLocation || false
        )
        
        setLocationCheckResult(checkResult)
      }
      
      return position
    } catch (err) {
      const error = err as Error
      setError(error.message || 'ไม่สามารถระบุตำแหน่งได้')
      return undefined
    } finally {
      isGettingLocation.current = false
    }
  }

  // Prepare check-in - check shifts and show selector if needed
  const prepareCheckIn = () => {
    if (!userData || !currentPosition || !locationCheckResult) {
      showToast('กรุณารอสักครู่', 'error')
      return
    }
    
    if (!locationCheckResult.canCheckIn) {
      showToast(locationCheckResult.reason || 'ไม่สามารถเช็คอินได้', 'error')
      return
    }
    
    // Get primary location
    const primaryLocation = locationCheckResult.locationsInRange[0] || locationCheckResult.nearestLocation
    const checkinType = locationCheckResult.locationsInRange.length > 0 ? 'onsite' : 'offsite'
    
    // Check available shifts if checking in at location
    if (primaryLocation && checkinType === 'onsite') {
      const location = locations.find(l => l.id === primaryLocation.id)
      if (location) {
        const shifts = locationDetectionService.getAvailableShifts(location)
        
        setSelectedLocation(location)
        setAvailableShifts(shifts)
        
        if (shifts.length === 0) {
          showToast('ไม่มีกะที่สามารถเช็คอินได้ในเวลานี้', 'error')
        } else if (shifts.length === 1) {
          // Auto select single shift
          checkIn(shifts[0])
        } else {
          // Show shift selector for multiple shifts
          setShowShiftSelector(true)
        }
      }
    } else {
      // Offsite check-in, no shift needed
      checkIn()
    }
  }

  // Cancel shift selection
  const cancelShiftSelection = () => {
    setShowShiftSelector(false)
    setAvailableShifts([])
    setSelectedLocation(null)
  }

  // Check in
  const checkIn = async (selectedShift?: Shift) => {
    if (!userData || !currentPosition || !locationCheckResult) {
      showToast('กรุณารอสักครู่', 'error')
      return
    }
    
    if (!locationCheckResult.canCheckIn) {
      showToast(locationCheckResult.reason || 'ไม่สามารถเช็คอินได้', 'error')
      return
    }
    
    try {
      setIsCheckingIn(true)
      setShowShiftSelector(false)
      
      // Prepare check-in data
      const primaryLocation = locationCheckResult.locationsInRange[0] || locationCheckResult.nearestLocation
      const checkinType = locationCheckResult.locationsInRange.length > 0 ? 'onsite' : 'offsite'
      
      // Create check-in
      await checkinService.createCheckIn({
        userId: userData.id!,
        userName: userData.fullName,
        userAvatar: userData.linePictureUrl,
        lat: currentPosition.coords.latitude,
        lng: currentPosition.coords.longitude,
        locationsInRange: locationCheckResult.locationsInRange.map(l => l.id),
        primaryLocationId: primaryLocation?.id || null,
        primaryLocationName: primaryLocation?.name,
        checkinType,
        selectedShift,
        note: locationCheckResult.reason
      })
      
      // Send Discord notification (no toast if fails)
      try {
        await DiscordNotificationService.notifyCheckIn(
          userData.id!,
          userData.fullName,
          primaryLocation?.name || 'นอกสถานที่',
          userData.linePictureUrl
        )
      } catch (err) {
        console.error('Discord notification failed:', err)
      }
      
      showToast('เช็คอินสำเร็จ', 'success')
      await fetchCurrentStatus()
    } catch (err) {
      console.error('Check-in error:', err)
      showToast('เช็คอินไม่สำเร็จ', 'error')
    } finally {
      setIsCheckingIn(false)
    }
  }

  // Check out
  const checkOut = async (note?: string) => {
    if (!userData?.id || !currentCheckIn || !currentPosition) {
      showToast('กรุณารอสักครู่', 'error')
      return
    }
    
    try {
      setIsCheckingOut(true)
      
      await checkinService.checkOut(userData.id, {
        lat: currentPosition.coords.latitude,
        lng: currentPosition.coords.longitude,
        note
      })
      
      // Calculate hours for notification
      const checkinTime = currentCheckIn.checkinTime instanceof Date 
        ? currentCheckIn.checkinTime 
        : new Date(currentCheckIn.checkinTime)
      const hoursWorked = (Date.now() - checkinTime.getTime()) / (1000 * 60 * 60)
      const overtime = Math.max(0, hoursWorked - 8)
      
      // Send Discord notification (no toast if fails)
      try {
        await DiscordNotificationService.notifyCheckOut(
          userData.id,
          userData.fullName,
          Math.round(hoursWorked * 10) / 10,
          Math.round(overtime * 10) / 10,
          userData.linePictureUrl
        )
      } catch (err) {
        console.error('Discord notification failed:', err)
      }
      
      showToast('เช็คเอาท์สำเร็จ', 'success')
      setCurrentCheckIn(null)
    } catch (err) {
      console.error('Check-out error:', err)
      showToast('เช็คเอาท์ไม่สำเร็จ', 'error')
    } finally {
      setIsCheckingOut(false)
    }
  }

  // Refresh status
  const refreshStatus = async () => {
    await fetchCurrentStatus()
    if (!currentCheckIn && !currentPosition) {
      await getCurrentLocation()
    }
  }

  // Initial load - fetch check-in status
  useEffect(() => {
    if (userData?.id && !hasInitialized.current) {
      hasInitialized.current = true
      fetchCurrentStatus()
    }
  }, [userData?.id])

  // Get location when ready - NO MULTIPLE CALLS
  useEffect(() => {
    // Only get location if ALL conditions are met
    if (
      userData?.id && 
      !loading && 
      !currentCheckIn && 
      !currentPosition && 
      locations.length > 0 &&
      !isGettingLocation.current &&
      hasInitialized.current // Make sure we've initialized
    ) {
      console.log('[useCheckIn] All conditions met, getting location once...')
      getCurrentLocation()
    }
  }, [
    userData?.id, 
    loading, 
    currentCheckIn, 
    currentPosition, 
    locations.length,
  ])

  return {
    // State
    currentCheckIn,
    isCheckingIn,
    isCheckingOut,
    locationCheckResult,
    currentPosition,
    availableShifts,
    selectedLocation,
    showShiftSelector,
    
    // Actions
    checkIn,
    checkOut,
    refreshStatus,
    getCurrentLocation,
    prepareCheckIn,
    cancelShiftSelection,
    
    // Loading states
    loading,
    error
  }
}