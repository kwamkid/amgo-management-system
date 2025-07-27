// hooks/useDelivery.ts

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import * as deliveryService from '@/lib/services/deliveryService'
import {
  DeliveryPoint,
  DeliveryRoute,
  CreateDeliveryPointData,
  UpdateDeliveryPointData,
  DeliveryFilters,
  DeliveryDailySummary,
  DeliveryMapPoint
} from '@/types/delivery'

// Hook for managing delivery points
export const useDeliveryPoints = (filters?: DeliveryFilters) => {
  const [deliveryPoints, setDeliveryPoints] = useState<DeliveryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const { userData } = useAuth()
  const { showToast } = useToast()

  // Fetch delivery points - ไม่ใส่ showToast ใน dependencies
  const fetchDeliveryPoints = useCallback(async (loadMore = false) => {
    try {
      setLoading(true)
      setError(null)

      // Add driver filter if user is a driver
      const actualFilters = { ...filters }
      if (userData?.role === 'driver') {
        actualFilters.driverId = userData.id
      }

      const result = await deliveryService.getDeliveryPoints(
        actualFilters,
        20,
        loadMore ? lastDoc : undefined
      )

      if (loadMore) {
        setDeliveryPoints(prev => [...prev, ...result.points])
      } else {
        setDeliveryPoints(result.points)
      }

      setLastDoc(result.lastDoc)
      setHasMore(result.hasMore)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch delivery points'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [filters, lastDoc, userData?.role, userData?.id]) // เปลี่ยน dependencies

  // Load more
  const loadMore = () => {
    if (hasMore && !loading) {
      fetchDeliveryPoints(true)
    }
  }

  // Create delivery point
  const createDeliveryPoint = async (data: CreateDeliveryPointData): Promise<string | null> => {
    try {
      if (!userData?.id || !userData.fullName) {
        showToast('ไม่พบข้อมูลผู้ใช้', 'error')
        return null
      }

      const deliveryId = await deliveryService.createDeliveryPoint(
        data,
        userData.id,
        userData.fullName
      )

      showToast('บันทึกจุดส่งของสำเร็จ', 'success')
      await fetchDeliveryPoints() // Refresh list
      return deliveryId
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create delivery point'
      showToast(message, 'error')
      return null
    }
  }

  // Update delivery point
  const updateDeliveryPoint = async (
    deliveryId: string,
    data: UpdateDeliveryPointData
  ): Promise<boolean> => {
    try {
      await deliveryService.updateDeliveryPoint(deliveryId, data)
      showToast('อัพเดทสถานะสำเร็จ', 'success')
      await fetchDeliveryPoints() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update delivery point'
      showToast(message, 'error')
      return false
    }
  }

  useEffect(() => {
    fetchDeliveryPoints()
  }, [fetchDeliveryPoints])

  return {
    deliveryPoints,
    loading,
    error,
    hasMore,
    loadMore,
    createDeliveryPoint,
    updateDeliveryPoint,
    refetch: fetchDeliveryPoints
  }
}

// Hook for single delivery point
export const useDeliveryPoint = (deliveryId: string) => {
  const [deliveryPoint, setDeliveryPoint] = useState<DeliveryPoint | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchDeliveryPoint = async () => {
      if (!deliveryId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const data = await deliveryService.getDeliveryPoint(deliveryId)

        if (mounted) {
          setDeliveryPoint(data)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch delivery point'
        if (mounted) {
          setError(message)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchDeliveryPoint()

    return () => {
      mounted = false
    }
  }, [deliveryId])

  return { deliveryPoint, loading, error }
}

// Hook for today's delivery summary
export const useTodayDeliverySummary = () => {
  const [summary, setSummary] = useState<DeliveryDailySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const { userData } = useAuth()

  useEffect(() => {
    const fetchSummary = async () => {
      if (!userData?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const today = new Date().toISOString().split('T')[0]
        
        const { points } = await deliveryService.getDeliveryPoints({
          driverId: userData.id,
          date: today
        })

        const completed = points.filter(p => p.deliveryStatus === 'completed').length
        const failed = points.filter(p => p.deliveryStatus === 'failed').length

        setSummary({
          date: today,
          driverId: userData.id,
          driverName: userData.fullName,
          totalDeliveries: points.length,
          completedDeliveries: completed,
          failedDeliveries: failed,
          firstDeliveryTime: points.length > 0 ? points[points.length - 1].checkInTime as Date : undefined,
          lastDeliveryTime: points.length > 0 ? points[0].checkInTime as Date : undefined
        })
      } catch (error) {
        console.error('Error fetching summary:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [userData])

  return { summary, loading }
}

// Hook for delivery map data
export const useDeliveryMap = (date?: string) => {
  const [mapPoints, setMapPoints] = useState<DeliveryMapPoint[]>([])
  const [loading, setLoading] = useState(true)
  const { userData } = useAuth()
  const { showToast } = useToast()

  const fetchMapData = useCallback(async () => {
    if (!userData?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      const filters: DeliveryFilters = {
        date: date || new Date().toISOString().split('T')[0]
      }

      const { points } = await deliveryService.getDeliveryPoints(filters, 100)

      // Import getAddressFromCoords
      const { getAddressFromCoords } = await import('@/lib/utils/location')

      // Map points and fetch addresses
      const mapData: DeliveryMapPoint[] = await Promise.all(
        points.map(async (point, index) => {
          let address = point.address

          // ถ้ายังไม่มีที่อยู่ ให้ดึงจาก Geocoding
          if (!address && window.google && window.google.maps) {
            try {
              address = await getAddressFromCoords(point.lat, point.lng)
            } catch (error) {
              console.error('Error getting address:', error)
              address = undefined
            }
          }

          return {
            id: point.id!,
            lat: point.lat,
            lng: point.lng,
            checkInTime: point.checkInTime as Date,
            deliveryType: point.deliveryType,
            deliveryStatus: point.deliveryStatus,
            customerName: point.customerName,
            address, // ใช้ที่อยู่จาก Geocoding
            sequence: points.length - index,
            photo: point.photo,
            note: point.note,
            driverName: point.driverName // เพิ่ม driver name
          }
        })
      )

      setMapPoints(mapData)
    } catch (error) {
      console.error('Error fetching map data:', error)
    } finally {
      setLoading(false)
    }
  }, [userData, date])

  // Delete delivery point
  const deleteDeliveryPoint = async (deliveryId: string): Promise<boolean> => {
    try {
      await deliveryService.deleteDeliveryPoint(deliveryId)
      return true
    } catch (error) {
      console.error('Error deleting delivery point:', error)
      showToast('ไม่สามารถลบจุดส่งของได้', 'error')
      return false
    }
  }

  useEffect(() => {
    fetchMapData()
  }, [fetchMapData])

  return { 
    mapPoints, 
    loading, 
    deleteDeliveryPoint,
    refetch: fetchMapData 
  }
}

// Hook for camera capture
export const useCameraCapture = () => {
  const [isCapturing, setIsCapturing] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const { showToast } = useToast()

  // Start camera
  const startCamera = async () => {
    try {
      setIsCapturing(true)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use rear camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })
      setStream(mediaStream)
    } catch (error) {
      console.error('Error accessing camera:', error)
      showToast('ไม่สามารถเข้าถึงกล้องได้', 'error')
      setIsCapturing(false)
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsCapturing(false)
  }

  // Capture photo
  const capturePhoto = (videoElement: HTMLVideoElement): string | null => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = videoElement.videoWidth
      canvas.height = videoElement.videoHeight
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      
      ctx.drawImage(videoElement, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
      
      setCapturedPhoto(dataUrl)
      stopCamera()
      
      return dataUrl
    } catch (error) {
      console.error('Error capturing photo:', error)
      showToast('เกิดข้อผิดพลาดในการถ่ายรูป', 'error')
      return null
    }
  }

  // Reset
  const reset = () => {
    setCapturedPhoto(null)
    stopCamera()
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  return {
    isCapturing,
    stream,
    capturedPhoto,
    startCamera,
    stopCamera,
    capturePhoto,
    reset
  }
}

// Hook for cleanup operations
export const useDeliveryCleanup = () => {
  const [isRunning, setIsRunning] = useState(false)
  const { showToast } = useToast()

  const runCleanup = async () => {
    try {
      setIsRunning(true)
      
      // Check if cleanup should run
      const shouldRun = await deliveryService.shouldRunCleanup()
      if (!shouldRun) {
        showToast('ยังไม่ถึงเวลาทำความสะอาดข้อมูล', 'success')
        return
      }

      // Run photo cleanup
      const deletedPhotos = await deliveryService.cleanupOldPhotos()
      
      // Run data cleanup for very old data
      const deletedData = await deliveryService.cleanupOldDeliveryData()
      
      showToast(
        `ทำความสะอาดข้อมูลเสร็จสิ้น: ลบรูป ${deletedPhotos} รูป, ลบข้อมูล ${deletedData} รายการ`,
        'success'
      )
    } catch (error) {
      console.error('Cleanup error:', error)
      showToast('เกิดข้อผิดพลาดในการทำความสะอาดข้อมูล', 'error')
    } finally {
      setIsRunning(false)
    }
  }

  return { runCleanup, isRunning }
}