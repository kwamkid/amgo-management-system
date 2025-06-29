// hooks/useInfluencers.ts

import { useState, useEffect, useCallback } from 'react'
import { DocumentSnapshot } from 'firebase/firestore'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'
import * as influencerService from '@/lib/services/influencerService'
import { 
  Influencer, 
  CreateInfluencerData,
  SocialChannel,
  Child
} from '@/types/influencer'

interface UseInfluencersOptions {
  pageSize?: number
  tier?: string
  platform?: string
  searchTerm?: string
}

export const useInfluencers = (options?: UseInfluencersOptions) => {
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
  const { showToast } = useToast()
  const { userData } = useAuth()

  // Fetch influencers with pagination
  const fetchInfluencers = useCallback(async (loadMore = false) => {
    try {
      setLoading(true)
      setError(null)
      
      const filters = {
        tier: options?.tier,
        platform: options?.platform,
        isActive: true
      }
      
      const result = await influencerService.getInfluencers(
        options?.pageSize || 20,
        loadMore ? lastDoc || undefined : undefined,
        filters
      )
      
      if (loadMore) {
        setInfluencers(prev => [...prev, ...result.influencers])
      } else {
        setInfluencers(result.influencers)
      }
      
      setLastDoc(result.lastDoc)
      setHasMore(result.hasMore)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch influencers'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [options, lastDoc, showToast])

  // Load more
  const loadMore = () => {
    if (hasMore && !loading) {
      fetchInfluencers(true)
    }
  }

  // Create influencer
  const createInfluencer = async (data: CreateInfluencerData): Promise<string | null> => {
    try {
      if (!userData?.id) {
        showToast('ไม่พบข้อมูลผู้ใช้', 'error')
        return null
      }
      
      const id = await influencerService.createInfluencer(data, userData.id)
      showToast('เพิ่ม Influencer สำเร็จ', 'success')
      // Don't refetch here to avoid infinite loop
      // await fetchInfluencers() 
      return id
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create influencer'
      showToast(message, 'error')
      return null
    }
  }

  // Update influencer
  const updateInfluencer = async (
    influencerId: string, 
    data: Partial<Influencer>
  ): Promise<boolean> => {
    try {
      if (!userData?.id) {
        showToast('ไม่พบข้อมูลผู้ใช้', 'error')
        return false
      }
      
      await influencerService.updateInfluencer(influencerId, data, userData.id)
      showToast('อัพเดทข้อมูลสำเร็จ', 'success')
      // Don't refetch here to avoid infinite loop
      // await fetchInfluencers()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update influencer'
      showToast(message, 'error')
      return false
    }
  }

  // Delete influencer
  const deleteInfluencer = async (influencerId: string): Promise<boolean> => {
    try {
      await influencerService.deleteInfluencer(influencerId)
      showToast('ลบ Influencer สำเร็จ', 'success')
      await fetchInfluencers() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete influencer'
      showToast(message, 'error')
      return false
    }
  }

  // Search influencers
  const searchInfluencers = async (searchTerm: string): Promise<Influencer[]> => {
    try {
      if (!searchTerm.trim()) {
        await fetchInfluencers()
        return influencers
      }
      
      setLoading(true)
      const results = await influencerService.searchInfluencers(searchTerm)
      setInfluencers(results)
      return results
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search influencers'
      showToast(message, 'error')
      return []
    } finally {
      setLoading(false)
    }
  }

  // Update social channel
  const updateSocialChannel = async (
    influencerId: string,
    channel: SocialChannel
  ): Promise<boolean> => {
    try {
      if (!userData?.id) {
        showToast('ไม่พบข้อมูลผู้ใช้', 'error')
        return false
      }
      
      await influencerService.updateSocialChannel(influencerId, channel, userData.id)
      showToast('อัพเดท Social Media สำเร็จ', 'success')
      await fetchInfluencers() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update social channel'
      showToast(message, 'error')
      return false
    }
  }

  // Remove social channel
  const removeSocialChannel = async (
    influencerId: string,
    channelId: string
  ): Promise<boolean> => {
    try {
      if (!userData?.id) {
        showToast('ไม่พบข้อมูลผู้ใช้', 'error')
        return false
      }
      
      await influencerService.removeSocialChannel(influencerId, channelId, userData.id)
      showToast('ลบ Social Media สำเร็จ', 'success')
      await fetchInfluencers() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove social channel'
      showToast(message, 'error')
      return false
    }
  }

  // Add child
  const addChild = async (
    influencerId: string,
    child: Omit<Child, 'id'>
  ): Promise<boolean> => {
    try {
      if (!userData?.id) {
        showToast('ไม่พบข้อมูลผู้ใช้', 'error')
        return false
      }
      
      await influencerService.addChild(influencerId, child, userData.id)
      showToast('เพิ่มข้อมูลลูกสำเร็จ', 'success')
      await fetchInfluencers() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add child'
      showToast(message, 'error')
      return false
    }
  }

  // Remove child
  const removeChild = async (
    influencerId: string,
    childId: string
  ): Promise<boolean> => {
    try {
      if (!userData?.id) {
        showToast('ไม่พบข้อมูลผู้ใช้', 'error')
        return false
      }
      
      await influencerService.removeChild(influencerId, childId, userData.id)
      showToast('ลบข้อมูลลูกสำเร็จ', 'success')
      await fetchInfluencers() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove child'
      showToast(message, 'error')
      return false
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchInfluencers()
  }, [fetchInfluencers]) // Add proper dependency

  return {
    influencers,
    loading,
    error,
    hasMore,
    loadMore,
    createInfluencer,
    updateInfluencer,
    deleteInfluencer,
    searchInfluencers,
    updateSocialChannel,
    removeSocialChannel,
    addChild,
    removeChild,
    refetch: fetchInfluencers
  }
}

// Hook for single influencer
export const useInfluencer = (influencerId: string) => {
  const [influencer, setInfluencer] = useState<Influencer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    let mounted = true;

    const fetchInfluencer = async () => {
      if (!influencerId) {
        setLoading(false)
        return
      }
      
      try {
        setLoading(true)
        setError(null)
        const data = await influencerService.getInfluencer(influencerId)
        
        if (mounted) {
          setInfluencer(data)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch influencer'
        if (mounted) {
          setError(message)
          // Remove toast to prevent re-renders
          console.error('Error fetching influencer:', message)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchInfluencer()

    return () => {
      mounted = false
    }
  }, [influencerId]) // Remove showToast from dependencies

  return { influencer, loading, error }
}

// Hook for influencer statistics
export const useInfluencerStats = () => {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await influencerService.getInfluencerStats()
        setStats(data)
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return { stats, loading }
}

// Hook for influencer search (with debounce)
export const useInfluencerSearch = (debounceMs = 300) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Influencer[]>([])
  const [searching, setSearching] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchTerm.trim()) {
        setSearching(true)
        try {
          const results = await influencerService.searchInfluencers(searchTerm)
          setSearchResults(results)
        } catch (error) {
          showToast('ค้นหาไม่สำเร็จ', 'error')
        } finally {
          setSearching(false)
        }
      } else {
        setSearchResults([])
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [searchTerm, debounceMs, showToast])

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    searching
  }
}