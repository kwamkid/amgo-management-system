// ========== FILE: lib/services/campaignService.ts ==========
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { 
  Campaign, 
  CampaignStatus, 
  CampaignInfluencer,
  CreateCampaignData 
} from '@/types/influencer'

const COLLECTION_NAME = 'campaigns'

// Get all campaigns
export const getCampaigns = async (
  status?: CampaignStatus,
  createdBy?: string
): Promise<Campaign[]> => {
  try {
    let q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'))
    
    if (status) {
      q = query(q, where('status', '==', status))
    }
    
    if (createdBy) {
      q = query(q, where('createdBy', '==', createdBy))
    }
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startDate: doc.data().startDate?.toDate?.() || doc.data().startDate,
      deadline: doc.data().deadline?.toDate?.() || doc.data().deadline,
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    } as Campaign))
  } catch (error) {
    console.error('Error getting campaigns:', error)
    throw error
  }
}

// Get single campaign
export const getCampaign = async (campaignId: string): Promise<Campaign | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, campaignId)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return null
    }
    
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      startDate: data.startDate?.toDate?.() || data.startDate,
      deadline: data.deadline?.toDate?.() || data.deadline,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate()
    } as Campaign
  } catch (error) {
    console.error('Error getting campaign:', error)
    throw error
  }
}

// Create campaign
export const createCampaign = async (
  data: CreateCampaignData,
  createdBy: string,
  createdByName: string
): Promise<string> => {
  try {
    // Prepare influencer assignments
    const influencers: CampaignInfluencer[] = data.influencerIds.map(influencerId => ({
      influencerId,
      influencerName: '', // Will be filled by the component
      assignedAt: new Date(),
      submissionStatus: 'pending' as const,
      submissionLink: generateSubmissionLink(influencerId)
    }))
    
    const campaignData = {
      name: data.name,
      description: data.description,
      briefFileUrl: data.briefFileUrl || null,
      trackingUrl: data.trackingUrl || null,
      budget: data.budget || null,
      currency: 'THB',
      startDate: data.startDate,
      deadline: data.deadline,
      influencers,
      brands: data.brandIds,
      products: data.productIds,
      status: 'active' as CampaignStatus,
      createdBy,
      createdByName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    
    const docRef = await addDoc(collection(db, COLLECTION_NAME), campaignData)
    return docRef.id
  } catch (error) {
    console.error('Error creating campaign:', error)
    throw error
  }
}

// Update campaign
export const updateCampaign = async (
  campaignId: string,
  data: Partial<Campaign>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, campaignId)
    
    // Clean data - remove undefined values
    const cleanData: any = {}
    
    Object.keys(data).forEach(key => {
      const value = data[key as keyof Campaign]
      // Only include fields that are not undefined
      if (value !== undefined) {
        cleanData[key] = value
      }
    })
    
    // Ensure updatedAt is always included
    cleanData.updatedAt = serverTimestamp()
    
    await updateDoc(docRef, cleanData)
  } catch (error) {
    console.error('Error updating campaign:', error)
    throw error
  }
}

// Update campaign status
export const updateCampaignStatus = async (
  campaignId: string,
  status: CampaignStatus
): Promise<void> => {
  try {
    await updateCampaign(campaignId, { status })
  } catch (error) {
    console.error('Error updating campaign status:', error)
    throw error
  }
}

// Cancel campaign
export const cancelCampaign = async (campaignId: string): Promise<void> => {
  try {
    await updateCampaignStatus(campaignId, 'cancelled')
  } catch (error) {
    console.error('Error cancelling campaign:', error)
    throw error
  }
}

// Add influencer to campaign
export const addInfluencerToCampaign = async (
  campaignId: string,
  influencer: CampaignInfluencer
): Promise<void> => {
  try {
    const campaign = await getCampaign(campaignId)
    if (!campaign) throw new Error('Campaign not found')
    
    const influencers = [...(campaign.influencers || []), influencer]
    await updateCampaign(campaignId, { influencers })
  } catch (error) {
    console.error('Error adding influencer to campaign:', error)
    throw error
  }
}

// Remove influencer from campaign
export const removeInfluencerFromCampaign = async (
  campaignId: string,
  influencerId: string
): Promise<void> => {
  try {
    const campaign = await getCampaign(campaignId)
    if (!campaign) throw new Error('Campaign not found')
    
    const influencers = (campaign.influencers || []).filter(
      i => i.influencerId !== influencerId
    )
    await updateCampaign(campaignId, { influencers })
  } catch (error) {
    console.error('Error removing influencer from campaign:', error)
    throw error
  }
}

// Update influencer submission status
export const updateInfluencerSubmission = async (
  campaignId: string,
  influencerId: string,
  updates: Partial<CampaignInfluencer>
): Promise<void> => {
  try {
    const campaign = await getCampaign(campaignId)
    if (!campaign) throw new Error('Campaign not found')
    
    const influencers = (campaign.influencers || []).map(inf => 
      inf.influencerId === influencerId 
        ? { ...inf, ...updates }
        : inf
    )
    
    await updateCampaign(campaignId, { influencers })
  } catch (error) {
    console.error('Error updating influencer submission:', error)
    throw error
  }
}

// Get campaigns by influencer
export const getCampaignsByInfluencer = async (
  influencerId: string
): Promise<Campaign[]> => {
  try {
    const allCampaigns = await getCampaigns()
    return allCampaigns.filter(campaign => 
      campaign.influencers?.some(inf => inf.influencerId === influencerId)
    )
  } catch (error) {
    console.error('Error getting campaigns by influencer:', error)
    throw error
  }
}

// Generate unique submission link
function generateSubmissionLink(influencerId: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}-${random}-${influencerId.substring(0, 8)}`
}

// Get campaign statistics
export const getCampaignStats = async () => {
  try {
    const campaigns = await getCampaigns()
    
    const stats = {
      total: campaigns.length,
      byStatus: {
        pending: 0,
        active: 0,
        reviewing: 0,
        completed: 0,
        cancelled: 0
      },
      totalInfluencers: 0,
      totalBudget: 0
    }
    
    campaigns.forEach(campaign => {
      stats.byStatus[campaign.status]++
      stats.totalInfluencers += campaign.influencers?.length || 0
      stats.totalBudget += campaign.budget || 0
    })
    
    return stats
  } catch (error) {
    console.error('Error getting campaign stats:', error)
    throw error
  }
}

