// lib/utils/location.ts

/**
 * Get current location with high accuracy
 * สำหรับ delivery tracking ต้องการความแม่นยำสูง
 */
export const getCurrentLocation = async (): Promise<{
  lat: number;
  lng: number;
  accuracy: number;
}> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
      },
      (error) => {
        let message = 'Failed to get location'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'กรุณาอนุญาตการเข้าถึงตำแหน่ง'
            break
          case error.POSITION_UNAVAILABLE:
            message = 'ไม่สามารถระบุตำแหน่งได้ กรุณาเปิด GPS'
            break
          case error.TIMEOUT:
            message = 'หมดเวลาในการระบุตำแหน่ง'
            break
        }
        reject(new Error(message))
      },
      {
        enableHighAccuracy: true, // สำคัญสำหรับ delivery tracking
        timeout: 10000,
        maximumAge: 0 // ไม่ใช้ cache เพื่อความแม่นยำ
      }
    )
  })
}

/**
 * Watch position changes (for real-time tracking)
 * ใช้สำหรับติดตามตำแหน่งแบบ real-time
 */
export const watchPosition = (
  onSuccess: (position: { lat: number; lng: number; accuracy: number }) => void,
  onError: (error: string) => void
): number => {
  if (!navigator.geolocation) {
    onError('Geolocation is not supported')
    return -1
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      onSuccess({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      })
    },
    (error) => {
      let message = 'Location error'
      switch (error.code) {
        case error.PERMISSION_DENIED:
          message = 'Location permission denied'
          break
        case error.POSITION_UNAVAILABLE:
          message = 'Location unavailable'
          break
        case error.TIMEOUT:
          message = 'Location timeout'
          break
      }
      onError(message)
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    }
  )
}

/**
 * Stop watching position
 */
export const clearWatch = (watchId: number) => {
  if (watchId !== -1 && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId)
  }
}

/**
 * Calculate distance between two points (Haversine formula)
 * @returns distance in meters
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
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
 * Format distance for display
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} ม.`
  }
  return `${(meters / 1000).toFixed(1)} กม.`
}

/**
 * Get address from coordinates (Reverse Geocoding)
 * ต้องใช้ Google Maps Geocoding API
 */
export const getAddressFromCoords = async (
  lat: number,
  lng: number
): Promise<string> => {
  try {
    if (!window.google || !window.google.maps) {
      throw new Error('Google Maps not loaded')
    }

    const geocoder = new google.maps.Geocoder()
    
    return new Promise((resolve, reject) => {
      geocoder.geocode(
        { location: { lat, lng } },
        (results, status) => {
          if (status === 'OK' && results && results[0]) {
            // Get formatted address
            const address = results[0].formatted_address
            
            // Clean up Thailand-specific formatting
            const cleanAddress = address
              .replace('Unnamed Road, ', '')
              .replace('ประเทศไทย', '')
              .trim()
              .replace(/,\s*$/, '') // Remove trailing comma
            
            resolve(cleanAddress)
          } else {
            reject(new Error('ไม่สามารถหาที่อยู่ได้'))
          }
        }
      )
    })
  } catch (error) {
    console.error('Geocoding error:', error)
    return 'ไม่สามารถระบุที่อยู่ได้'
  }
}

/**
 * Format coordinates for display
 */
export const formatCoordinates = (lat: number, lng: number): string => {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

/**
 * Check if coordinates are valid
 */
export const isValidCoordinates = (lat: number, lng: number): boolean => {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    (lat !== 0 || lng !== 0) // Not null island
  )
}

/**
 * Get location accuracy level
 */
export const getAccuracyLevel = (accuracy: number): {
  level: 'high' | 'medium' | 'low'
  label: string
  color: string
} => {
  if (accuracy <= 10) {
    return {
      level: 'high',
      label: 'แม่นยำมาก',
      color: 'text-green-600'
    }
  } else if (accuracy <= 50) {
    return {
      level: 'medium',
      label: 'แม่นยำปานกลาง',
      color: 'text-yellow-600'
    }
  } else {
    return {
      level: 'low',
      label: 'แม่นยำน้อย',
      color: 'text-red-600'
    }
  }
}

/**
 * Create Google Maps URL for navigation
 */
export const createNavigationUrl = (lat: number, lng: number): string => {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

/**
 * Create static map URL (for previews)
 */
export const createStaticMapUrl = (
  lat: number,
  lng: number,
  zoom = 15,
  size = '400x300'
): string => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&markers=color:red%7C${lat},${lng}&key=${apiKey}`
}

/**
 * Request location permission
 */
export const requestLocationPermission = async (): Promise<PermissionState> => {
  if ('permissions' in navigator) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' })
      return result.state
    } catch (error) {
      console.error('Permission query error:', error)
      return 'prompt'
    }
  }
  return 'prompt'
}

/**
 * Check if location services are available
 */
export const isLocationAvailable = (): boolean => {
  return 'geolocation' in navigator
}

/**
 * Get location error message in Thai
 */
export const getLocationErrorMessage = (error: GeolocationPositionError): string => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'คุณปฏิเสธการเข้าถึงตำแหน่ง กรุณาอนุญาตในการตั้งค่า'
    case error.POSITION_UNAVAILABLE:
      return 'ไม่สามารถระบุตำแหน่งได้ กรุณาตรวจสอบ GPS'
    case error.TIMEOUT:
      return 'หมดเวลาในการค้นหาตำแหน่ง กรุณาลองใหม่'
    default:
      return 'เกิดข้อผิดพลาดในการระบุตำแหน่ง'
  }
}