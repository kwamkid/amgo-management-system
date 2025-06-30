// ========== FILE: hooks/useBrands.ts ==========
import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import * as brandService from '@/lib/services/brandService'
import { Brand } from '@/types/influencer'

export const useBrands = (includeInactive = false) => {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const fetchBrands = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await brandService.getBrands(includeInactive)
      setBrands(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch brands'
      setError(message)
      console.error('Error fetching brands:', err)
    } finally {
      setLoading(false)
    }
  }, [includeInactive])

  const createBrand = async (data: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
    try {
      const id = await brandService.createBrand(data)
      showToast('เพิ่ม Brand สำเร็จ', 'success')
      await fetchBrands()
      return id
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create brand'
      showToast(message, 'error')
      return null
    }
  }

  const updateBrand = async (brandId: string, data: Partial<Brand>): Promise<boolean> => {
    try {
      await brandService.updateBrand(brandId, data)
      showToast('อัพเดท Brand สำเร็จ', 'success')
      await fetchBrands()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update brand'
      showToast(message, 'error')
      return false
    }
  }

  const deleteBrand = async (brandId: string): Promise<boolean> => {
    try {
      await brandService.deleteBrand(brandId)
      showToast('ลบ Brand สำเร็จ', 'success')
      await fetchBrands()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete brand'
      showToast(message, 'error')
      return false
    }
  }

  useEffect(() => {
    fetchBrands()
  }, [includeInactive]) // Remove fetchBrands from dependencies

  return {
    brands,
    loading,
    error,
    createBrand,
    updateBrand,
    deleteBrand,
    refetch: fetchBrands
  }
}

// Hook for single brand
export const useBrand = (brandId: string) => {
  const [brand, setBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchBrand = async () => {
      if (!brandId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const data = await brandService.getBrand(brandId)
        
        if (mounted) {
          setBrand(data)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch brand'
        if (mounted) {
          setError(message)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchBrand()

    return () => {
      mounted = false
    }
  }, [brandId])

  return { brand, loading, error }
}
