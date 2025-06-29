// lib/services/influencerService.ts

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
  limit,
  startAfter,
  DocumentSnapshot,
  QueryConstraint,
  writeBatch,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { 
  Influencer, 
  CreateInfluencerData,
  SocialChannel,
  Child,
  calculateInfluencerTier
} from '@/types/influencer'

const COLLECTION_NAME = 'influencers'

// Get all influencers with pagination
export const getInfluencers = async (
  pageSize = 20, 
  lastDoc?: DocumentSnapshot,
  filters?: {
    tier?: string
    platform?: string
    searchTerm?: string
    isActive?: boolean
  }
): Promise<{ 
  influencers: Influencer[], 
  lastDoc: DocumentSnapshot | null, 
  hasMore: boolean 
}> => {
  try {
    const constraints: QueryConstraint[] = []
    
    // Apply filters
    if (filters?.tier) {
      constraints.push(where('tier', '==', filters.tier))
    }
    if (filters?.isActive !== undefined) {
      constraints.push(where('isActive', '==', filters.isActive))
    }
    
    // Order and pagination
    constraints.push(orderBy('createdAt', 'desc'))
    constraints.push(limit(pageSize + 1))
    
    if (lastDoc) {
      constraints.push(startAfter(lastDoc))
    }
    
    const q = query(collection(db, COLLECTION_NAME), ...constraints)
    const snapshot = await getDocs(q)
    
    const influencers = snapshot.docs.slice(0, pageSize).map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    } as Influencer))
    
    // Check if there are more documents
    const hasMore = snapshot.docs.length > pageSize
    const newLastDoc = snapshot.docs[pageSize - 1] || null
    
    return { influencers, lastDoc: newLastDoc, hasMore }
  } catch (error) {
    console.error('Error getting influencers:', error)
    throw error
  }
}

// Get single influencer
export const getInfluencer = async (influencerId: string): Promise<Influencer | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, influencerId)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return null
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate(),
      updatedAt: docSnap.data().updatedAt?.toDate()
    } as Influencer
  } catch (error) {
    console.error('Error getting influencer:', error)
    throw error
  }
}

// Create influencer
export const createInfluencer = async (
  data: CreateInfluencerData,
  createdBy: string
): Promise<string> => {
  try {
    // Clean social channels - remove any undefined values
    const cleanedSocialChannels = (data.socialChannels || []).map(channel => {
      const cleanChannel: any = {
        platform: channel.platform,
        profileUrl: channel.profileUrl
      }
      
      // Add optional fields only if they exist
      if (channel.id) cleanChannel.id = channel.id
      if (channel.username) cleanChannel.username = channel.username
      if (typeof channel.followerCount === 'number') {
        cleanChannel.followerCount = channel.followerCount
      }
      if (typeof channel.isVerified === 'boolean') {
        cleanChannel.isVerified = channel.isVerified
      }
      if (channel.lastFetched) cleanChannel.lastFetched = channel.lastFetched
      if (channel.fetchError) cleanChannel.fetchError = channel.fetchError
      if (channel.platformData) cleanChannel.platformData = channel.platformData
      
      return cleanChannel
    })
    
    // Clean children - remove any undefined values  
    const cleanedChildren = (data.children || []).map(child => {
      const cleanChild: any = {
        nickname: child.nickname,
        gender: child.gender
      }
      
      if (child.id) cleanChild.id = child.id
      if (child.birthDate) cleanChild.birthDate = child.birthDate
      
      return cleanChild
    })
    
    // Calculate total followers from cleaned channels
    const totalFollowers = cleanedSocialChannels.reduce(
      (sum, channel) => sum + (channel.followerCount || 0), 
      0
    )
    
    // Auto-calculate tier
    const tier = data.tier || calculateInfluencerTier(totalFollowers)
    
    // Build clean data object
    const cleanData: any = {
      fullName: data.fullName,
      nickname: data.nickname,
      phone: data.phone,
      email: data.email,
      tier,
      totalFollowers,
      isActive: true,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      children: cleanedChildren,
      socialChannels: cleanedSocialChannels
    }
    
    // Add optional fields only if they have values
    if (data.birthDate && data.birthDate !== '') {
      cleanData.birthDate = data.birthDate
    }
    if (data.lineId && data.lineId !== '') {
      cleanData.lineId = data.lineId
    }
    if (data.shippingAddress && data.shippingAddress !== '') {
      cleanData.shippingAddress = data.shippingAddress
    }
    if (data.province && data.province !== '') {
      cleanData.province = data.province
    }
    if (data.notes && data.notes !== '') {
      cleanData.notes = data.notes
    }
    
    console.log('Creating influencer with data:', cleanData) // Debug log
    
    const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanData)
    return docRef.id
  } catch (error) {
    console.error('Error creating influencer:', error)
    throw error
  }
}

// Update influencer
export const updateInfluencer = async (
  influencerId: string,
  data: Partial<Influencer>,
  updatedBy: string
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, influencerId)
    
    // Clean data - remove undefined values
    const cleanData: any = {}
    
    // Add only fields that have values
    Object.keys(data).forEach(key => {
      if (data[key as keyof Influencer] !== undefined) {
        cleanData[key] = data[key as keyof Influencer]
      }
    })
    
    // Recalculate total followers if social channels updated
    if (cleanData.socialChannels) {
      cleanData.totalFollowers = cleanData.socialChannels.reduce(
        (sum: number, channel: SocialChannel) => sum + (channel.followerCount || 0), 
        0
      )
      // Auto-update tier based on followers
      cleanData.tier = calculateInfluencerTier(cleanData.totalFollowers)
    }
    
    // Add metadata
    cleanData.updatedBy = updatedBy
    cleanData.updatedAt = serverTimestamp()
    
    await updateDoc(docRef, cleanData)
  } catch (error) {
    console.error('Error updating influencer:', error)
    throw error
  }
}

// Delete influencer (soft delete)
export const deleteInfluencer = async (influencerId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, influencerId)
    await updateDoc(docRef, {
      isActive: false,
      deletedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error deleting influencer:', error)
    throw error
  }
}

// Search influencers
export const searchInfluencers = async (searchTerm: string): Promise<Influencer[]> => {
  try {
    if (!searchTerm.trim()) return []
    
    // Search by name or nickname
    // Note: Firestore doesn't support full-text search
    // For production, consider using Algolia or ElasticSearch
    
    const searchLower = searchTerm.toLowerCase()
    const allInfluencers = await getAllInfluencers()
    
    return allInfluencers.filter(influencer => 
      influencer.fullName.toLowerCase().includes(searchLower) ||
      influencer.nickname.toLowerCase().includes(searchLower) ||
      influencer.email.toLowerCase().includes(searchLower) ||
      influencer.phone.includes(searchTerm)
    )
  } catch (error) {
    console.error('Error searching influencers:', error)
    throw error
  }
}

// Get all active influencers (for search)
const getAllInfluencers = async (): Promise<Influencer[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('isActive', '==', true),
      orderBy('fullName')
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    } as Influencer))
  } catch (error) {
    console.error('Error getting all influencers:', error)
    throw error
  }
}

// Get influencers by platform
export const getInfluencersByPlatform = async (platform: string): Promise<Influencer[]> => {
  try {
    // This requires array-contains-any which Firestore doesn't support well
    // Alternative: get all and filter client-side
    const allInfluencers = await getAllInfluencers()
    
    return allInfluencers.filter(influencer => 
      influencer.socialChannels?.some(channel => channel.platform === platform)
    )
  } catch (error) {
    console.error('Error getting influencers by platform:', error)
    throw error
  }
}

// Update social channel for influencer
export const updateSocialChannel = async (
  influencerId: string,
  channel: SocialChannel,
  updatedBy: string
): Promise<void> => {
  try {
    const influencer = await getInfluencer(influencerId)
    if (!influencer) throw new Error('Influencer not found')
    
    const channels = influencer.socialChannels || []
    const existingIndex = channels.findIndex(c => c.id === channel.id)
    
    if (existingIndex >= 0) {
      channels[existingIndex] = channel
    } else {
      channels.push({ ...channel, id: Date.now().toString() })
    }
    
    await updateInfluencer(influencerId, { socialChannels: channels }, updatedBy)
  } catch (error) {
    console.error('Error updating social channel:', error)
    throw error
  }
}

// Remove social channel
export const removeSocialChannel = async (
  influencerId: string,
  channelId: string,
  updatedBy: string
): Promise<void> => {
  try {
    const influencer = await getInfluencer(influencerId)
    if (!influencer) throw new Error('Influencer not found')
    
    const channels = (influencer.socialChannels || []).filter(c => c.id !== channelId)
    
    await updateInfluencer(influencerId, { socialChannels: channels }, updatedBy)
  } catch (error) {
    console.error('Error removing social channel:', error)
    throw error
  }
}

// Add child to influencer
export const addChild = async (
  influencerId: string,
  child: Omit<Child, 'id'>,
  updatedBy: string
): Promise<void> => {
  try {
    const influencer = await getInfluencer(influencerId)
    if (!influencer) throw new Error('Influencer not found')
    
    const children = influencer.children || []
    children.push({ ...child, id: Date.now().toString() })
    
    await updateInfluencer(influencerId, { children }, updatedBy)
  } catch (error) {
    console.error('Error adding child:', error)
    throw error
  }
}

// Remove child
export const removeChild = async (
  influencerId: string,
  childId: string,
  updatedBy: string
): Promise<void> => {
  try {
    const influencer = await getInfluencer(influencerId)
    if (!influencer) throw new Error('Influencer not found')
    
    const children = (influencer.children || []).filter(c => c.id !== childId)
    
    await updateInfluencer(influencerId, { children }, updatedBy)
  } catch (error) {
    console.error('Error removing child:', error)
    throw error
  }
}

// Get influencer statistics
export const getInfluencerStats = async () => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('isActive', '==', true))
    const snapshot = await getDocs(q)
    const influencers = snapshot.docs.map(doc => doc.data() as Influencer)
    
    // Calculate stats
    const stats = {
      total: influencers.length,
      byTier: {
        nano: 0,
        micro: 0,
        macro: 0,
        mega: 0
      },
      byPlatform: {
        facebook: 0,
        instagram: 0,
        tiktok: 0,
        youtube: 0,
        twitter: 0,
        lemon8: 0,
        website: 0,
        others: 0
      },
      totalReach: 0
    }
    
    influencers.forEach(influencer => {
      // Count by tier
      if (influencer.tier) {
        stats.byTier[influencer.tier]++
      }
      
      // Count by platform
      influencer.socialChannels?.forEach(channel => {
        stats.byPlatform[channel.platform]++
      })
      
      // Total reach
      stats.totalReach += influencer.totalFollowers || 0
    })
    
    return stats
  } catch (error) {
    console.error('Error getting influencer stats:', error)
    throw error
  }
}

// Batch update follower counts (for scheduled updates)
export const batchUpdateFollowerCounts = async (
  updates: Array<{
    influencerId: string
    channelId: string
    followerCount: number
  }>
): Promise<void> => {
  try {
    const batch = writeBatch(db)
    
    for (const update of updates) {
      const influencer = await getInfluencer(update.influencerId)
      if (!influencer) continue
      
      const channels = influencer.socialChannels || []
      const channelIndex = channels.findIndex(c => c.id === update.channelId)
      
      if (channelIndex >= 0) {
        channels[channelIndex].followerCount = update.followerCount
        channels[channelIndex].lastFetched = new Date()
        
        const docRef = doc(db, COLLECTION_NAME, update.influencerId)
        batch.update(docRef, {
          socialChannels: channels,
          totalFollowers: channels.reduce((sum, c) => sum + (c.followerCount || 0), 0),
          updatedAt: serverTimestamp()
        })
      }
    }
    
    await batch.commit()
  } catch (error) {
    console.error('Error batch updating follower counts:', error)
    throw error
  }
}