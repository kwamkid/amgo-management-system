// lib/services/locationDetectionService.ts

import { Location } from '@/types/location'
import { LocationCheckResult } from '@/types/checkin'

/**
 * Calculate distance between two points using Haversine formula
 * @returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Check if user is within any allowed locations
 */
export function checkUserLocation(
  userLat: number,
  userLng: number,
  locations: Location[],
  allowedLocationIds: string[] = [],
  allowCheckInOutsideLocation: boolean = false
): LocationCheckResult {
  // Calculate distances to all locations
  const locationsWithDistance = locations.map(location => ({
    id: location.id,
    name: location.name,
    distance: calculateDistance(userLat, userLng, location.lat, location.lng),
    radius: location.radius,
    isActive: location.isActive
  }))

  // Sort by distance (nearest first)
  locationsWithDistance.sort((a, b) => a.distance - b.distance)

  // Find locations within range
  const locationsInRange = locationsWithDistance.filter(
    loc => loc.distance <= loc.radius && loc.isActive
  )

  // Filter by allowed locations
  const allowedLocationsInRange = locationsInRange.filter(
    loc => allowedLocationIds.includes(loc.id)
  )

  // Find nearest location (even if outside range)
  const nearestLocation = locationsWithDistance[0] || null

  // Determine if can check in
  let canCheckIn = false
  let reason = ''

  if (allowedLocationsInRange.length > 0) {
    // User is within range of allowed location(s)
    canCheckIn = true
  } else if (allowCheckInOutsideLocation) {
    // User can check in from anywhere
    canCheckIn = true
    if (locationsInRange.length > 0) {
      // Near a location but not allowed
      reason = `นอกสถานที่ (ใกล้${locationsInRange[0].name})`
    } else {
      reason = 'เช็คอินนอกสถานที่'
    }
  } else if (locationsInRange.length > 0) {
    // Within range of location(s) but not allowed
    canCheckIn = false
    reason = `ไม่มีสิทธิ์เช็คอินที่ ${locationsInRange[0].name}`
  } else {
    // Not within range of any location
    canCheckIn = false
    reason = 'ไม่อยู่ในพื้นที่ที่อนุญาต'
  }

  return {
    isWithinRange: locationsInRange.length > 0,
    nearestLocation: nearestLocation
      ? {
          id: nearestLocation.id,
          name: nearestLocation.name,
          distance: Math.round(nearestLocation.distance)
        }
      : null,
    locationsInRange: locationsInRange.map(loc => ({
      id: loc.id,
      name: loc.name,
      distance: Math.round(loc.distance)
    })),
    canCheckIn,
    reason
  }
}

/**
 * Get current user location using browser geolocation API
 */
export async function getCurrentLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => {
        let message = 'Failed to get location'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'กรุณาอนุญาตการเข้าถึงตำแหน่ง'
            break
          case error.POSITION_UNAVAILABLE:
            message = 'ไม่สามารถระบุตำแหน่งได้'
            break
          case error.TIMEOUT:
            message = 'หมดเวลาในการระบุตำแหน่ง'
            break
        }
        reject(new Error(message))
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  })
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} เมตร`
  }
  return `${(meters / 1000).toFixed(1)} กม.`
}

/**
 * Check if location is open at given time
 */
export function isLocationOpen(
  location: Location,
  date: Date = new Date()
): boolean {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayName = days[date.getDay()] as keyof Location['workingHours']
  const hours = location.workingHours[dayName]

  if (hours.isClosed) {
    return false
  }

  const currentTime = date.getHours() * 60 + date.getMinutes()
  const [openHour, openMin] = hours.open.split(':').map(Number)
  const [closeHour, closeMin] = hours.close.split(':').map(Number)
  
  const openTime = openHour * 60 + openMin
  const closeTime = closeHour * 60 + closeMin

  // Handle overnight shifts (e.g., 22:00 - 06:00)
  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime < closeTime
  }

  return currentTime >= openTime && currentTime < closeTime
}

/**
 * Get available shifts for location at current time
 */
export function getAvailableShifts(
  location: Location,
  date: Date = new Date()
): Location['shifts'] {
  if (!isLocationOpen(location, date)) {
    return []
  }

  const currentTime = date.getHours() * 60 + date.getMinutes()

  return location.shifts.filter(shift => {
    const [startHour, startMin] = shift.startTime.split(':').map(Number)
    const [endHour, endMin] = shift.endTime.split(':').map(Number)
    
    const shiftStart = startHour * 60 + startMin
    const shiftEnd = endHour * 60 + endMin
    const graceTime = shift.graceMinutes

    // Allow check-in within grace period before shift start
    const earliestCheckIn = shiftStart - graceTime
    
    // For overnight shifts
    if (shiftEnd < shiftStart) {
      return currentTime >= earliestCheckIn || currentTime < shiftEnd
    }
    
    return currentTime >= earliestCheckIn && currentTime < shiftEnd
  })
}