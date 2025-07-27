// hooks/useHolidays.ts

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'
import * as holidayService from '@/lib/services/holidayService'
import { 
  Holiday, 
  HolidayFormData, 
  HolidayFilters,
  PublicHolidayImport
} from '@/types/holiday'

export const useHolidays = (filters?: HolidayFilters) => {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()
  const { userData } = useAuth()

  // Fetch holidays
  const fetchHolidays = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await holidayService.getHolidays(filters)
      setHolidays(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch holidays'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [filters?.year, filters?.type, filters?.locationId, filters?.isActive])

  // Create holiday
  const createHoliday = async (data: HolidayFormData): Promise<boolean> => {
    try {
      if (!userData?.id) {
        showToast('ไม่พบข้อมูลผู้ใช้', 'error')
        return false
      }

      await holidayService.createHoliday(data, userData.id)
      showToast('เพิ่มวันหยุดสำเร็จ', 'success')
      await fetchHolidays()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create holiday'
      showToast(message, 'error')
      return false
    }
  }

  // Update holiday
  const updateHoliday = async (
    holidayId: string,
    data: Partial<HolidayFormData>
  ): Promise<boolean> => {
    try {
      if (!userData?.id) {
        showToast('ไม่พบข้อมูลผู้ใช้', 'error')
        return false
      }

      await holidayService.updateHoliday(holidayId, data, userData.id)
      showToast('อัพเดทวันหยุดสำเร็จ', 'success')
      await fetchHolidays()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update holiday'
      showToast(message, 'error')
      return false
    }
  }

  // Delete holiday
  const deleteHoliday = async (holidayId: string): Promise<boolean> => {
    try {
      await holidayService.deleteHoliday(holidayId)
      showToast('ลบวันหยุดสำเร็จ', 'success')
      await fetchHolidays()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete holiday'
      showToast(message, 'error')
      return false
    }
  }

  // Import public holidays
  const importPublicHolidays = async (
    holidays: PublicHolidayImport[],
    year: number
  ): Promise<boolean> => {
    try {
      if (!userData?.id) {
        showToast('ไม่พบข้อมูลผู้ใช้', 'error')
        return false
      }

      setLoading(true)
      const result = await holidayService.importPublicHolidays(
        holidays,
        year,
        userData.id
      )

      if (result.success > 0) {
        showToast(
          `นำเข้าวันหยุดสำเร็จ ${result.success} วัน${
            result.failed > 0 ? ` (ล้มเหลว ${result.failed} วัน)` : ''
          }`,
          'success'
        )
      } else {
        showToast('ไม่สามารถนำเข้าวันหยุดได้', 'error')
      }

      await fetchHolidays()
      return result.success > 0
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import holidays'
      showToast(message, 'error')
      return false
    } finally {
      setLoading(false)
    }
  }

  // Check if specific date is holiday
  const checkHoliday = async (
    date: Date,
    locationId?: string,
    role?: string
  ): Promise<{ isHoliday: boolean; holiday?: Holiday }> => {
    try {
      return await holidayService.isHoliday(date, locationId, role)
    } catch (err) {
      console.error('Error checking holiday:', err)
      return { isHoliday: false }
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchHolidays()
  }, [])

  return {
    holidays,
    loading,
    error,
    createHoliday,
    updateHoliday,
    deleteHoliday,
    importPublicHolidays,
    checkHoliday,
    refetch: fetchHolidays
  }
}

// Hook for single holiday
export const useHoliday = (holidayId: string) => {
  const [holiday, setHoliday] = useState<Holiday | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchHoliday = async () => {
      if (!holidayId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const data = await holidayService.getHoliday(holidayId)
        
        if (mounted) {
          setHoliday(data)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch holiday'
        if (mounted) {
          setError(message)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchHoliday()

    return () => {
      mounted = false
    }
  }, [holidayId])

  return { holiday, loading, error }
}

// Hook for holiday statistics
export const useHolidayStats = (year?: number) => {
  const [stats, setStats] = useState({
    total: 0,
    public: 0,
    company: 0,
    special: 0,
    workingDays: 0,
    upcomingCount: 0,
    nextHoliday: null as Holiday | null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const holidays = await holidayService.getHolidays({ 
          year: year || new Date().getFullYear(),
          isActive: true
        })

        const today = new Date()
        const upcomingHolidays = holidays.filter(h => 
          new Date(h.date) >= today
        ).sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        setStats({
          total: holidays.length,
          public: holidays.filter(h => h.type === 'public').length,
          company: holidays.filter(h => h.type === 'company').length,
          special: holidays.filter(h => h.type === 'special').length,
          workingDays: holidays.filter(h => h.isWorkingDay).length,
          upcomingCount: upcomingHolidays.length,
          nextHoliday: upcomingHolidays[0] || null
        })
      } catch (error) {
        console.error('Error fetching holiday stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [year])

  return { stats, loading }
}