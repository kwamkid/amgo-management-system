// hooks/useLocations.ts

import { useState, useEffect, useCallback } from 'react'
import { Location, LocationFormData } from '@/types/location'
import * as locationService from '@/lib/services/locationService'
import { useToast } from '@/hooks/useToast'

export const useLocations = (activeOnly = false) => {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  // Fetch locations - ไม่ใส่ showToast ใน dependencies
  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await locationService.getLocations(activeOnly)
      setLocations(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch locations'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [activeOnly]) // ❌ ไม่ใส่ showToast ใน dependencies

  // Create location
  const createLocation = async (data: LocationFormData): Promise<boolean> => {
    try {
      setLoading(true)
      
      // Check duplicate name
      const isDuplicate = await locationService.isLocationNameExists(data.name)
      if (isDuplicate) {
        showToast('ชื่อสถานที่นี้มีอยู่แล้ว', 'error')
        setLoading(false)
        return false
      }
      
      await locationService.createLocation(data)
      showToast('เพิ่มสถานที่สำเร็จ', 'success')
      await fetchLocations() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create location'
      showToast(message, 'error')
      return false
    } finally {
      setLoading(false)
    }
  }

  // Update location
  const updateLocation = async (id: string, data: Partial<LocationFormData>): Promise<boolean> => {
    try {
      setLoading(true)
      
      // Check duplicate name if name is being updated
      if (data.name) {
        const isDuplicate = await locationService.isLocationNameExists(data.name, id)
        if (isDuplicate) {
          showToast('ชื่อสถานที่นี้มีอยู่แล้ว', 'error')
          setLoading(false)
          return false
        }
      }
      
      await locationService.updateLocation(id, data)
      showToast('อัพเดทสถานที่สำเร็จ', 'success')
      await fetchLocations() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update location'
      showToast(message, 'error')
      return false
    } finally {
      setLoading(false)
    }
  }

  // Delete location (soft delete)
  const deleteLocation = async (id: string): Promise<boolean> => {
    try {
      setLoading(true)
      await locationService.deleteLocation(id)
      showToast('ลบสถานที่สำเร็จ', 'success')
      await fetchLocations() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete location'
      showToast(message, 'error')
      return false
    } finally {
      setLoading(false)
    }
  }

  // Get single location
  const getLocation = async (id: string): Promise<Location | null> => {
    try {
      return await locationService.getLocation(id)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get location'
      showToast(message, 'error')
      return null
    }
  }

  // Fetch locations on mount
  useEffect(() => {
    fetchLocations()
  }, []) // ❌ ใส่ [] เปล่าๆ ไม่ต้องใส่ fetchLocations

  return {
    locations,
    loading,
    error,
    createLocation,
    updateLocation,
    deleteLocation,
    getLocation,
    refetch: fetchLocations
  }
}

// Hook for single location
export const useLocation = (locationId: string) => {
  const [location, setLocation] = useState<Location | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLocation = async () => {
      if (!locationId) {
        setLoading(false)
        return
      }
      
      try {
        setLoading(true)
        setError(null)
        const data = await locationService.getLocation(locationId)
        setLocation(data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch location'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchLocation()
  }, [locationId])

  return { location, loading, error }
}