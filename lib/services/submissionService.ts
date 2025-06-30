// ========== FILE: lib/services/submissionService.ts ==========
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { DiscordNotificationService } from '@/lib/discord/notificationService'

const SUBMISSIONS_COLLECTION = 'submissions'
const CAMPAIGNS_COLLECTION = 'campaigns'

// Get submission by code
export const getSubmissionByCode = async (code: string) => {
  try {
    // Find campaign with this submission link
    const campaignsQuery = query(
      collection(db, CAMPAIGNS_COLLECTION),
      where('influencers', 'array-contains-any', [
        { submissionLink: code }
      ])
    )
    
    const campaignsSnapshot = await getDocs(campaignsQuery)
    
    // Search through campaigns to find the matching submission link
    let campaign = null
    let influencerData = null
    let campaignId = null
    
    for (const doc of campaignsSnapshot.docs) {
      const data = doc.data()
      const influencer = data.influencers?.find(
        (inf: any) => inf.submissionLink === code
      )
      
      if (influencer) {
        campaignId = doc.id
        campaign = {
          id: doc.id,
          name: data.name,
          description: data.description,
          deadline: data.deadline,
          influencerId: influencer.influencerId,
          influencerName: influencer.influencerName,
          influencerNickname: influencer.influencerNickname
        }
        influencerData = influencer
        break
      }
    }
    
    if (!campaign) {
      // Try alternative search method
      const allCampaigns = await getDocs(collection(db, CAMPAIGNS_COLLECTION))
      
      for (const doc of allCampaigns.docs) {
        const data = doc.data()
        const influencer = data.influencers?.find(
          (inf: any) => inf.submissionLink === code
        )
        
        if (influencer) {
          campaignId = doc.id
          campaign = {
            id: doc.id,
            name: data.name,
            description: data.description,
            deadline: data.deadline,
            influencerId: influencer.influencerId,
            influencerName: influencer.influencerName,
            influencerNickname: influencer.influencerNickname
          }
          influencerData = influencer
          break
        }
      }
    }
    
    if (!campaign) {
      return null
    }
    
    // Return data with influencer's current status from campaign
    return {
      campaign,
      submission: {
        status: influencerData?.submissionStatus || 'pending',
        isDraft: false,
        links: influencerData?.submittedLinks || [],
        reviewNotes: influencerData?.reviewNotes,
        reviewedAt: influencerData?.reviewedAt,
        reviewedBy: influencerData?.reviewedBy
      }
    }
  } catch (error) {
    console.error('Error getting submission:', error)
    throw error
  }
}

// Save submission (draft or final)
export const saveSubmission = async (
  code: string,
  links: any[],
  isDraft: boolean
) => {
  try {
    const data = await getSubmissionByCode(code)
    if (!data) throw new Error('Invalid submission code')
    
    // Get current submission data to check status
    const currentData = await getSubmissionByCode(code)
    const currentSubmission = currentData?.submission
    
    const submissionData = {
      code,
      campaignId: data.campaign.id,
      campaignName: data.campaign.name,
      influencerId: data.campaign.influencerId,
      influencerName: data.campaign.influencerName,
      links: links.map(link => ({
        id: link.id,
        url: link.url,
        platform: link.platform,
        addedAt: new Date()
      })),
      isDraft,
      status: isDraft ? 'pending' : (currentSubmission?.status === 'revision' ? 'resubmitted' : 'submitted'),
      lastSavedAt: serverTimestamp(),
      submittedAt: isDraft ? null : serverTimestamp()
    }
    
    // Check if submission exists
    const submissionQuery = query(
      collection(db, SUBMISSIONS_COLLECTION),
      where('code', '==', code)
    )
    
    const existing = await getDocs(submissionQuery)
    
    if (existing.empty) {
      // Create new
      await addDoc(collection(db, SUBMISSIONS_COLLECTION), submissionData)
    } else {
      // Update existing
      await updateDoc(doc(db, SUBMISSIONS_COLLECTION, existing.docs[0].id), submissionData)
    }
    
    // Update campaign influencer status
    await updateCampaignInfluencerStatus(
      data.campaign.id,
      data.campaign.influencerId,
      {
        submissionStatus: isDraft ? 'pending' : (currentSubmission?.status === 'revision' ? 'resubmitted' : 'submitted'),
        submittedAt: isDraft ? null : new Date(),
        submittedLinks: links
      }
    )
    
    // Check if we need to update campaign status to reviewing
    if (!isDraft) {
      await checkAndUpdateCampaignStatus(data.campaign.id)
      
      // Send Discord notification for new submission
      const isResubmission = currentSubmission?.status === 'revision'
      
      if (isResubmission) {
        await DiscordNotificationService.notifyResubmission({
          campaignName: data.campaign.name,
          influencerName: data.campaign.influencerName,
          influencerNickname: data.campaign.influencerNickname,
          submissionCount: links.length,
          timestamp: new Date()
        })
      } else {
        await DiscordNotificationService.notifySubmission({
          campaignId: data.campaign.id,
          campaignName: data.campaign.name,
          influencerName: data.campaign.influencerName,
          influencerNickname: data.campaign.influencerNickname,
          submissionCount: links.length,
          timestamp: new Date()
        })
      }
    }
    
    return true
  } catch (error) {
    console.error('Error saving submission:', error)
    throw error
  }
}

// Submit final
export const submitFinal = async (code: string, links: any[]) => {
  return saveSubmission(code, links, false)
}

// Update campaign influencer status
const updateCampaignInfluencerStatus = async (
  campaignId: string,
  influencerId: string,
  updates: any
) => {
  try {
    const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId)
    const campaignSnap = await getDoc(campaignRef)
    
    if (!campaignSnap.exists()) {
      throw new Error('Campaign not found')
    }
    
    const campaignData = campaignSnap.data()
    
    // Filter out undefined values from updates
    const cleanUpdates: any = {}
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        cleanUpdates[key] = updates[key]
      }
    })
    
    const updatedInfluencers = campaignData.influencers.map((inf: any) => 
      inf.influencerId === influencerId
        ? { ...inf, ...cleanUpdates }
        : inf
    )
    
    await updateDoc(campaignRef, {
      influencers: updatedInfluencers,
      updatedAt: serverTimestamp()
    })
    
    return true
  } catch (error) {
    console.error('Error updating campaign:', error)
    throw error
  }
}

// Check and update campaign status to reviewing if needed
const checkAndUpdateCampaignStatus = async (campaignId: string) => {
  try {
    const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId)
    const campaignSnap = await getDoc(campaignRef)
    
    if (!campaignSnap.exists()) return
    
    const campaignData = campaignSnap.data()
    
    // Check if any influencer has submitted
    const hasSubmission = campaignData.influencers?.some((inf: any) => 
      ['submitted', 'resubmitted'].includes(inf.submissionStatus)
    )
    
    // Update status to reviewing if currently active and has submissions
    if (campaignData.status === 'active' && hasSubmission) {
      await updateDoc(campaignRef, {
        status: 'reviewing',
        updatedAt: serverTimestamp()
      })
    }
  } catch (error) {
    console.error('Error updating campaign status:', error)
  }
}

// Review submission (approve/reject)
export const reviewSubmission = async (
  campaignId: string,
  influencerId: string,
  action: 'approve' | 'reject',
  reviewerName: string,
  notes?: string
) => {
  try {
    const newStatus = action === 'approve' ? 'approved' : 'revision'
    
    // Update influencer status in campaign
    await updateCampaignInfluencerStatus(
      campaignId,
      influencerId,
      {
        submissionStatus: newStatus,
        reviewedAt: new Date(),
        reviewedBy: reviewerName,
        ...(notes && { reviewNotes: notes })
      }
    )
    
    // Get campaign data for notification
    const campaignDoc = await getDoc(doc(db, CAMPAIGNS_COLLECTION, campaignId))
    const campaignData = campaignDoc.data()
    const influencer = campaignData?.influencers?.find(
      (inf: any) => inf.influencerId === influencerId
    )
    
    // Send Discord notification
    if (action === 'approve') {
      await DiscordNotificationService.notifySubmissionApproved({
        campaignName: campaignData?.name || '',
        influencerName: influencer?.influencerName || '',
        influencerNickname: influencer?.influencerNickname,
        approvedBy: reviewerName,
        timestamp: new Date()
      })
    } else {
      await DiscordNotificationService.notifySubmissionRejected({
        campaignName: campaignData?.name || '',
        influencerName: influencer?.influencerName || '',
        influencerNickname: influencer?.influencerNickname,
        rejectedBy: reviewerName,
        reason: notes || 'ไม่ระบุ',
        timestamp: new Date()
      })
    }
    
    // Check if all submissions are reviewed
    await checkCampaignCompletion(campaignId)
    
    return true
  } catch (error) {
    console.error('Error reviewing submission:', error)
    throw error
  }
}

// Check if campaign is completed
const checkCampaignCompletion = async (campaignId: string) => {
  try {
    const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId)
    const campaignSnap = await getDoc(campaignRef)
    
    if (!campaignSnap.exists()) return
    
    const campaignData = campaignSnap.data()
    
    // Check if all influencers have been reviewed
    const allReviewed = campaignData.influencers?.every((inf: any) => 
      ['approved', 'cancelled'].includes(inf.submissionStatus)
    )
    
    // Update status to completed if all are reviewed
    if (allReviewed && campaignData.status === 'reviewing') {
      await updateDoc(campaignRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      // Send completion notification
      const approvedCount = campaignData.influencers?.filter(
        (inf: any) => inf.submissionStatus === 'approved'
      ).length || 0
      
      await DiscordNotificationService.notifyCampaignCompleted({
        campaignName: campaignData.name,
        totalInfluencers: campaignData.influencers?.length || 0,
        approvedCount,
        completedBy: 'System',
        timestamp: new Date()
      })
    }
  } catch (error) {
    console.error('Error checking campaign completion:', error)
  }
}