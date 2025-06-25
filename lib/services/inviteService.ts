// lib/services/inviteService.ts

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
  increment
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { InviteLink, CreateInviteLinkData, UpdateInviteLinkData } from '@/types/invite'

const COLLECTION_NAME = 'inviteLinks'

// Generate random invite code
export const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Check if code already exists
export const isCodeExists = async (code: string): Promise<boolean> => {
  const q = query(collection(db, COLLECTION_NAME), where('code', '==', code))
  const snapshot = await getDocs(q)
  return !snapshot.empty
}

// Get all invite links
export const getInviteLinks = async (activeOnly = false): Promise<InviteLink[]> => {
  try {
    let q = query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'desc')
    )
    
    if (activeOnly) {
      q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      )
    }
    
    const snapshot = await getDocs(q)
    const links = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      expiresAt: doc.data().expiresAt?.toDate()
    } as InviteLink))
    
    // Filter out expired links if activeOnly
    if (activeOnly) {
      const now = new Date()
      return links.filter(link => {
        if (!link.expiresAt) return true
        return new Date(link.expiresAt) > now
      })
    }
    
    return links
  } catch (error) {
    console.error('Error getting invite links:', error)
    throw error
  }
}

// Get single invite link
export const getInviteLink = async (linkId: string): Promise<InviteLink | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, linkId)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return null
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate(),
      updatedAt: docSnap.data().updatedAt?.toDate(),
      expiresAt: docSnap.data().expiresAt?.toDate()
    } as InviteLink
  } catch (error) {
    console.error('Error getting invite link:', error)
    throw error
  }
}

// Get invite link by code
export const getInviteLinkByCode = async (code: string): Promise<InviteLink | null> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('code', '==', code),
      where('isActive', '==', true)
    )
    
    const snapshot = await getDocs(q)
    if (snapshot.empty) {
      return null
    }
    
    const doc = snapshot.docs[0]
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      expiresAt: doc.data().expiresAt?.toDate()
    } as InviteLink
  } catch (error) {
    console.error('Error getting invite link by code:', error)
    throw error
  }
}

// Create invite link
export const createInviteLink = async (
  data: CreateInviteLinkData,
  createdBy: string,
  createdByName?: string
): Promise<string> => {
  try {
    // Generate code if not provided
    let code = data.code || generateInviteCode()
    
    // Ensure code is unique
    while (await isCodeExists(code)) {
      code = generateInviteCode()
    }
    
    const docData = {
      code,
      createdBy,
      createdByName: createdByName || '',
      defaultRole: data.defaultRole,
      defaultLocationIds: data.defaultLocationIds || [],
      allowCheckInOutsideLocation: data.allowCheckInOutsideLocation || false,
      requireApproval: data.requireApproval !== false, // default true
      maxUses: data.maxUses || null,
      usedCount: 0,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      note: data.note || '',
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    
    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData)
    return docRef.id
  } catch (error) {
    console.error('Error creating invite link:', error)
    throw error
  }
}

// Update invite link
export const updateInviteLink = async (
  linkId: string, 
  data: UpdateInviteLinkData
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, linkId)
    const updateData: any = {
      ...data,
      updatedAt: serverTimestamp()
    }
    
    if (data.expiresAt) {
      updateData.expiresAt = new Date(data.expiresAt)
    }
    
    await updateDoc(docRef, updateData)
  } catch (error) {
    console.error('Error updating invite link:', error)
    throw error
  }
}

// Use invite link (increment counter)
export const useInviteLink = async (linkId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, linkId)
    await updateDoc(docRef, {
      usedCount: increment(1),
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error using invite link:', error)
    throw error
  }
}

// Delete invite link (soft delete)
export const deleteInviteLink = async (linkId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, linkId)
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error deleting invite link:', error)
    throw error
  }
}

// Validate invite link
export const validateInviteLink = async (code: string): Promise<{
  valid: boolean
  link?: InviteLink
  error?: string
}> => {
  try {
    const link = await getInviteLinkByCode(code)
    
    if (!link) {
      return { valid: false, error: 'ลิงก์ไม่ถูกต้องหรือถูกปิดใช้งานแล้ว' }
    }
    
    // Check if expired
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return { valid: false, error: 'ลิงก์หมดอายุแล้ว' }
    }
    
    // Check usage limit
    if (link.maxUses && link.usedCount >= link.maxUses) {
      return { valid: false, error: 'ลิงก์ถูกใช้งานครบจำนวนแล้ว' }
    }
    
    return { valid: true, link }
  } catch (error) {
    console.error('Error validating invite link:', error)
    return { valid: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบลิงก์' }
  }
}

// Get invite link statistics
export const getInviteLinkStats = async (linkId: string) => {
  try {
    const link = await getInviteLink(linkId)
    if (!link) return null
    
    // Get users who used this link
    const usersQuery = query(
      collection(db, 'users'),
      where('inviteLinkId', '==', linkId)
    )
    
    const usersSnapshot = await getDocs(usersQuery)
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
    return {
      link,
      totalUses: link.usedCount,
      activeUsers: users.filter(u => u.isActive).length,
      pendingUsers: users.filter(u => u.needsApproval).length,
      users
    }
  } catch (error) {
    console.error('Error getting invite link stats:', error)
    throw error
  }
}