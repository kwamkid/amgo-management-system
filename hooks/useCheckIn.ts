// hooks/useCheckIn.ts

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { useLocations } from '@/hooks/useLocations'
import { CheckInRecord, LocationCheckResult } from '@/types/checkin'
import { Shift } from '@/types/location'
import * as checkinService from '@/lib/services/checkinService'
import * as locationDetectionService from '@/lib/services/locationDetectionService'
import { format } from 'date-fns'
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
  /** เพิ่งเช็คอินตรงวันหยุดของตัวเอง — หน้าจอเอาไปถามว่าจะไปหยุดวันไหนแทน */
  swapPromptDate: Date | null
  dismissSwapPrompt: () => void

  // Actions
  checkIn: (selectedShift?: Shift, isWFH?: boolean, photoUrl?: string) => Promise<void>
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
  
  /** วันที่เพิ่งเช็คอินไปทั้งที่เป็นวันหยุดของตัวเอง — null = ไม่ต้องถาม */
  const [swapPromptDate, setSwapPromptDate] = useState<Date | null>(null)
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

      // ── เช็คอินค้างอยู่ในวันหยุดของตัวเอง แต่ยังไม่ได้ยื่นใบสลับ = ถามซ้ำ ──
      // เจ้าของสั่งว่าห้ามข้าม (16 ส.ค. 69) — ถ้าเด้งแค่ตอนกดเช็คอินครั้งเดียว
      // แค่ refresh ก็หนีได้ กลายเป็นบังคับแต่ในนาม
      if (activeCheckIn?.checkinTime) {
        const cin = new Date(activeCheckIn.checkinTime as Date)
        if (cin.toDateString() === new Date().toDateString()) {
          try {
            const { expectedMode, hasSwapFor } = await import('@/lib/services/scheduleSwapService')
            const [mode, filed] = await Promise.all([
              expectedMode(userData.id, cin),
              hasSwapFor(userData.id, cin),
            ])
            if (mode === 'off' && !filed) setSwapPromptDate(cin)
          } catch {
            // ถามไม่ได้ก็ไม่ควรทำให้หน้าเช็คอินพัง
          }
        }
      }
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
  const checkIn = async (selectedShift?: Shift, isWFH = false, photoUrl?: string) => {
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

      // Auto-close stale session from a previous calendar day
      if (currentCheckIn) {
        const checkinDate = new Date(currentCheckIn.checkinTime as Date)
        const isFromToday = checkinDate.toDateString() === new Date().toDateString()
        if (!isFromToday) {
          try {
            const dateStr = format(checkinDate, 'yyyy-MM-dd')
            await checkinService.forceCheckOut(
              currentCheckIn.id!,
              dateStr,
              'ระบบปิดการทำงานค้างจากวันก่อนโดยอัตโนมัติ'
            )
          } catch (e) {
            console.error('Auto-close stale session failed:', e)
          }
          setCurrentCheckIn(null)
        }
      }

      // Prepare check-in data
      const offsiteType = isWFH ? 'wfh' : 'offsite'
      const checkinType = locationCheckResult.locationsInRange.length > 0 ? 'onsite' : offsiteType

      // For offsite check-in: use exact GPS location without mapping to nearest location
      // For onsite check-in: use primary location from locations in range
      let primaryLocation = null
      let locationsInRange: string[] = []

      if (checkinType === 'onsite') {
        // Onsite: use first location in range
        primaryLocation = locationCheckResult.locationsInRange[0]
        locationsInRange = locationCheckResult.locationsInRange.map(l => l.id)
      }
      // else: offsite remains null and empty array

      // Create check-in
      const newCheckinId = await checkinService.createCheckIn({
        userId: userData.id!,
        userName: userData.fullName,
        userAvatar: userData.linePictureUrl,
        lat: currentPosition.coords.latitude,
        lng: currentPosition.coords.longitude,
        locationsInRange: locationsInRange,
        primaryLocationId: primaryLocation?.id || null,
        primaryLocationName: primaryLocation?.name,
        checkinType,
        selectedShift,
        note: locationCheckResult.reason,
        checkinPhotoUrl: photoUrl,
      })

      // ── มาทำงานตรงวันหยุดของตัวเอง = ถามเลยว่าจะไปหยุดวันไหนแทน ──────
      // จังหวะนี้จังหวะเดียวที่เขาคิดเรื่องนี้อยู่ — พ้นไปแล้วไม่มีใครเดินไป
      // กรอกใบเอง (schedule_exceptions มี 0 แถวมาตลอดทั้งที่มี UI ให้กรอก)
      // เจ้าของทัก 16 ส.ค. 69: "เค้าไปทำงานก่อน แล้วกดเช็คอิน แล้วมันค่อยขึ้นว่าวันหยุดเค้า"
      // fire-and-forget — ถามไม่ขึ้นก็ไม่กระทบการเช็คอิน
      import('@/lib/services/scheduleSwapService')
        .then(({ expectedMode }) => expectedMode(userData.id!, new Date()))
        .then((mode) => {
          if (mode === 'off') setSwapPromptDate(new Date())
        })
        .catch(() => {})

      // ตรวจหลังบ้าน: เครื่องนี้เช็คอินให้คนอื่นวันนี้ด้วยไหม (จับกดแทนกัน)
      // fire-and-forget — พลาดก็ไม่กวนการเช็คอิน
      fetch('/api/checkin/device-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkinId: newCheckinId }),
      }).catch(() => {})

      // Send Discord notification (no toast if fails)
      try {
        await DiscordNotificationService.notifyCheckIn(
          userData.id!,
          // ชื่อจริง (ชื่อเล่น) — เจ้าของจำพนักงานได้แต่ชื่อเล่น
          userData.displayName || userData.fullName,
          primaryLocation?.name || 'เช็คอินนอกสถานที่',
          userData.linePictureUrl,
          checkinType,
          currentPosition.coords.latitude,
          currentPosition.coords.longitude
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
    if (!userData?.id || !currentCheckIn) {
      showToast('กรุณารอสักครู่', 'error')
      return
    }

    try {
      setIsCheckingOut(true)

      // Get fresh GPS — don't rely on state
      let pos = currentPosition
      if (!pos) {
        try {
          pos = await locationDetectionService.getCurrentLocation()
          setCurrentPosition(pos)
        } catch (e) {
          // GPS unavailable
        }
      }

      // ── เช็คเอาท์นอกพื้นที่: ไม่บล็อก แต่ checkOut ฝั่ง service จะตัดชั่วโมง ──
      // ที่เวลาเลิกงานปกติ + ไม่มี OT (เจ้าของเลือก 14 ส.ค. 69 — บล็อกแล้วคนลืม
      // จะติดค้างเช็คเอาท์ไม่ได้เลย) — GPS จึงต้องมีเพื่อให้ระบบรู้ระยะ
      if (currentCheckIn.checkinType === 'onsite' && !pos) {
        showToast('กรุณาเปิด GPS เพื่อเช็คเอาท์', 'error')
        return
      }

      // ── รูปสต็อก/หน้าร้านประจำวัน — คนที่ถูกตั้งค่าไว้ต้องถ่ายครบก่อนออก ──
      // เจ้าของสั่ง 4 ก.ย. 69: ไม่ครบทั้งสองอย่าง เช็คเอาท์ไม่ได้ (ไม่มีข้าม)
      // เช็คจากฐานข้อมูลตรงนี้ ไม่เชื่อ state ของการ์ด — refresh หนีก็ไม่พ้น
      if (userData.requiresStockPhotos) {
        const { listMyPhotosToday, stockPhotoStatus, missingLabel } = await import(
          '@/lib/services/stockPhotoService'
        )
        const status = stockPhotoStatus(await listMyPhotosToday(userData.id!))
        if (!status.complete) {
          showToast(
            `ยังไม่ได้ถ่ายรูป${missingLabel(status)}ของวันนี้ — ถ่ายให้ครบก่อนเช็คเอาท์`,
            'error'
          )
          return
        }
      }

      const hours = await checkinService.checkOut(userData.id, {
        lat: pos?.coords.latitude,
        lng: pos?.coords.longitude,
        note
      })

      // เช็คเอาท์ไกลจากสาขา — บอกพนักงานตรง ๆ + แจ้งห้อง alerts ให้ HR เห็น
      if (hours.farKm > 0) {
        showToast(
          `เช็คเอาท์นอกพื้นที่ (ห่าง ${hours.farKm} กม.) — ระบบนับชั่วโมงถึงเวลาเลิกงานเท่านั้น`,
          'error'
        )
        DiscordNotificationService.notifyFarCheckout(
          userData.displayName || userData.fullName,
          currentCheckIn.primaryLocationName || 'สาขา',
          hours.farKm,
          userData.linePictureUrl
        )
      }

      // ── ลืมเช็คเอาท์ (มากดข้ามวัน) — บอกตรง ๆ ว่าระบบปิดให้ที่เวลาเลิกงาน
      if (hours.forgot) {
        showToast(
          'ลืมเช็คเอาท์เมื่อวาน — ระบบปิดกะให้ที่เวลาเลิกงาน ไม่นับโอที · แจ้ง HR ถ้าทำงานจริงเลยเวลา',
          'error'
        )
      }

      // Send Discord notification (no toast if fails)
      try {
        // เลขชั่วโมง/โอทีใช้ของที่คำนวณจริง (หักพัก/ตัดเวลาปิดร้านแล้ว) — เดิมคิดจาก
        // เวลาดิบ−8 เลยขึ้นโอทีทุกคน · และโชว์โอทีเฉพาะคนที่มีสิทธิ์ OT เท่านั้น
        const otEligible = await checkinService.resolveOtEligible(userData.id)
        await DiscordNotificationService.notifyCheckOut(
          userData.id,
          // ชื่อจริง (ชื่อเล่น) — เหมือนฝั่งเช็คอิน
          userData.displayName || userData.fullName,
          Math.round(hours.totalHours * 10) / 10,
          otEligible ? Math.round(hours.overtimeHours * 10) / 10 : 0,
          userData.linePictureUrl,
          // การ์ดต้องบอกว่าเลขนี้ระบบปิดให้ ไม่ใช่ชั่วโมงที่ทำจริง — เดิมโชว์
          // 14.9 ชม. ของคนที่ลืมเช็คเอาท์เฉย ๆ (เจ้าของทัก 15 ส.ค. 69)
          hours.forgot
        )
      } catch (err) {
        console.error('Discord notification failed:', err)
      }

      if (!hours.farKm && !hours.forgot) showToast('เช็คเอาท์สำเร็จ', 'success')
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
    /** เช็คอินตรงวันหยุดตัวเอง — หน้าจอเอาไปถามว่าจะไปหยุดวันไหนแทน */
    swapPromptDate,
    dismissSwapPrompt: () => setSwapPromptDate(null),

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