// ========== FILE: hooks/useProducts.ts ==========
import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import * as productService from '@/lib/services/productService'
import { Product } from '@/types/influencer'

interface UseProductsOptions {
  brandId?: string
  includeInactive?: boolean
}

export const useProducts = (options?: UseProductsOptions) => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  // Extract options to prevent re-renders
  const brandId = options?.brandId
  const includeInactive = options?.includeInactive

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await productService.getProducts(brandId, includeInactive)
      setProducts(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch products'
      setError(message)
      console.error('Error fetching products:', err)
    } finally {
      setLoading(false)
    }
  }, [brandId, includeInactive])

  const createProduct = async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
    try {
      const id = await productService.createProduct(data)
      showToast('เพิ่มสินค้าสำเร็จ', 'success')
      await fetchProducts()
      return id
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create product'
      showToast(message, 'error')
      return null
    }
  }

  const updateProduct = async (productId: string, data: Partial<Product>): Promise<boolean> => {
    try {
      await productService.updateProduct(productId, data)
      showToast('อัพเดทสินค้าสำเร็จ', 'success')
      await fetchProducts()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update product'
      showToast(message, 'error')
      return false
    }
  }

  const deleteProduct = async (productId: string): Promise<boolean> => {
    try {
      await productService.deleteProduct(productId)
      showToast('ลบสินค้าสำเร็จ', 'success')
      await fetchProducts()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete product'
      showToast(message, 'error')
      return false
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [brandId, includeInactive]) // Remove fetchProducts from dependencies

  return {
    products,
    loading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    refetch: fetchProducts
  }
}

// Hook for products by brand
export const useProductsByBrand = (brandId: string) => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchProducts = async () => {
      if (!brandId) {
        setProducts([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const data = await productService.getProductsByBrand(brandId)
        
        if (mounted) {
          setProducts(data)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch products'
        if (mounted) {
          setError(message)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchProducts()

    return () => {
      mounted = false
    }
  }, [brandId])

  return { products, loading, error }
}

// Hook for products by multiple brands
export const useProductsByBrands = (brandIds: string[]) => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Convert brandIds array to stable string for dependency
  const brandIdsKey = brandIds.sort().join(',')

  useEffect(() => {
    let mounted = true

    const fetchProducts = async () => {
      if (!brandIds.length) {
        setProducts([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const data = await productService.getProductsByBrands(brandIds)
        
        if (mounted) {
          setProducts(data)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch products'
        if (mounted) {
          setError(message)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchProducts()

    return () => {
      mounted = false
    }
  }, [brandIdsKey]) // Use stable string key

  return { products, loading, error }
}