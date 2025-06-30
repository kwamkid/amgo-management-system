// ========== FILE: hooks/useCampaigns.ts ==========
import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'
import * as campaignService from '@/lib/services/campaignService'
import { 
  Campaign, 
  CampaignStatus,
  CreateCampaignData,
  CampaignInfluencer
} from '@/types/influencer'

interface UseCampaignsOptions {
  status?: CampaignStatus
  createdBy?: string
}

export const useCampaigns = (options?: UseCampaignsOptions) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()
  const { userData } = useAuth()

  // Memoize options to prevent re-renders
  const status = options?.status
  const createdBy = options?.createdBy

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await campaignService.getCampaigns(status, createdBy)
      setCampaigns(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch campaigns'
      setError(message)
      console.error('Error fetching campaigns:', err)
    } finally {
      setLoading(false)
    }
  }, [status, createdBy])

  const createCampaign = async (data: CreateCampaignData): Promise<string | null> => {
    try {
      if (!userData) {
        showToast('ไม่พบข้อมูลผู้ใช้', 'error')
        return null
      }
      
      // Clean data before sending
      const cleanedData: any = {
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        deadline: data.deadline,
        influencerIds: data.influencerIds,
        brandIds: data.brandIds,
        productIds: data.productIds
      }
      
      // Only add optional fields if they have values
      if (data.budget !== undefined && data.budget !== null) {
        cleanedData.budget = data.budget
      }
      if (data.briefFileUrl) {
        cleanedData.briefFileUrl = data.briefFileUrl
      }
      if (data.trackingUrl) {
        cleanedData.trackingUrl = data.trackingUrl
      }
      
      const id = await campaignService.createCampaign(
        cleanedData,
        userData.id!,
        userData.fullName || userData.lineDisplayName || 'Unknown'
      )
      showToast('สร้าง Campaign สำเร็จ', 'success')
      await fetchCampaigns()
      return id
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create campaign'
      showToast(message, 'error')
      return null
    }
  }

  const updateCampaign = async (
    campaignId: string,
    data: Partial<Campaign>
  ): Promise<boolean> => {
    try {
      await campaignService.updateCampaign(campaignId, data)
      showToast('อัพเดท Campaign สำเร็จ', 'success')
      await fetchCampaigns()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update campaign'
      showToast(message, 'error')
      return false
    }
  }

  const cancelCampaign = async (campaignId: string): Promise<boolean> => {
    try {
      await campaignService.cancelCampaign(campaignId)
      showToast('ยกเลิก Campaign สำเร็จ', 'success')
      await fetchCampaigns()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel campaign'
      showToast(message, 'error')
      return false
    }
  }

  const deleteCampaign = async (campaignId: string): Promise<boolean> => {
    try {
      await campaignService.deleteCampaign(campaignId)
      showToast('ลบ Campaign สำเร็จ', 'success')
      await fetchCampaigns()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete campaign'
      showToast(message, 'error')
      return false
    }
  }

  const updateInfluencerSubmission = async (
    campaignId: string,
    influencerId: string,
    updates: Partial<CampaignInfluencer>
  ): Promise<boolean> => {
    try {
      await campaignService.updateInfluencerSubmission(
        campaignId,
        influencerId,
        updates
      )
      showToast('อัพเดทสถานะสำเร็จ', 'success')
      await fetchCampaigns()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update submission'
      showToast(message, 'error')
      return false
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [status, createdBy]) // Use extracted values instead of options

  return {
    campaigns,
    loading,
    error,
    createCampaign,
    updateCampaign,
    cancelCampaign,
    deleteCampaign,  // <-- เพิ่มบรรทัดนี้
    updateInfluencerSubmission,
    refetch: fetchCampaigns
  }
}

// Hook for single campaign
export const useCampaign = (campaignId: string) => {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchCampaign = async () => {
      if (!campaignId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const data = await campaignService.getCampaign(campaignId)
        
        if (mounted) {
          setCampaign(data)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch campaign'
        if (mounted) {
          setError(message)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchCampaign()

    return () => {
      mounted = false
    }
  }, [campaignId])

  return { campaign, loading, error }
}

// Hook for campaign statistics
export const useCampaignStats = () => {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await campaignService.getCampaignStats()
        setStats(data)
      } catch (error) {
        console.error('Error fetching campaign stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return { stats, loading }
}