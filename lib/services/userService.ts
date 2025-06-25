// lib/services/userService.ts

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
  limit,
  startAfter
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { User, UserFilters } from '@/types/user'

const COLLECTION_NAME = 'users'

// Get all users with pagination
export const getUsers = async (
  pageSize = 20, 
  lastDoc?: any,
  filters?: {
    role?: string
    isActive?: boolean
    locationId?: string
    searchTerm?: string
  }
): Promise<{ users: User[], lastDoc: any, hasMore: boolean }> => {
  try {
    let q = query(collection(db, COLLECTION_NAME))
    
    // Apply filters
    if (filters?.role) {
      q = query(q, where('role', '==', filters.role))
    }
    if (filters?.isActive !== undefined) {
      q = query(q, where('isActive', '==', filters.isActive))
    }
    if (filters?.locationId) {
      q = query(q, where('locationId', '==', filters.locationId))
    }
    
    // Order and pagination
    q = query(q, orderBy('createdAt', 'desc'), limit(pageSize + 1))
    
    if (lastDoc) {
      q = query(q, startAfter(lastDoc))
    }
    
    const snapshot = await getDocs(q)
    const users = snapshot.docs.slice(0, pageSize).map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      approvedAt: doc.data().approvedAt?.toDate(),
      lastLoginAt: doc.data().lastLoginAt?.toDate()
    } as User))
    
    // Check if there are more documents
    const hasMore = snapshot.docs.length > pageSize
    const newLastDoc = snapshot.docs[pageSize - 1]
    
    return { users, lastDoc: newLastDoc, hasMore }
  } catch (error) {
    console.error('Error getting users:', error)
    throw error
  }
}

// Get single user
export const getUser = async (userId: string): Promise<User | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return null
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate(),
      updatedAt: docSnap.data().updatedAt?.toDate(),
      approvedAt: docSnap.data().approvedAt?.toDate(),
      lastLoginAt: docSnap.data().lastLoginAt?.toDate()
    } as User
  } catch (error) {
    console.error('Error getting user:', error)
    throw error
  }
}

// Update user
export const updateUser = async (userId: string, data: Partial<User>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId)
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error updating user:', error)
    throw error
  }
}

// Approve user
export const approveUser = async (userId: string, approvedBy: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId)
    await updateDoc(docRef, {
      isActive: true,
      needsApproval: false,
      approvedBy,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error approving user:', error)
    throw error
  }
}

// Reject/Deactivate user
export const deactivateUser = async (userId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId)
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error deactivating user:', error)
    throw error
  }
}

// Update user role
export const updateUserRole = async (userId: string, role: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId)
    await updateDoc(docRef, {
      role,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error updating user role:', error)
    throw error
  }
}

// Update user location(s)
export const updateUserLocations = async (userId: string, locationIds: string[]): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId)
    await updateDoc(docRef, {
      allowedLocationIds: locationIds,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error updating user locations:', error)
    throw error
  }
}

// Get pending users (waiting for approval)
export const getPendingUsers = async (): Promise<User[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('needsApproval', '==', true),
      orderBy('createdAt', 'desc')
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    } as User))
  } catch (error) {
    console.error('Error getting pending users:', error)
    throw error
  }
}

// Search users
export const searchUsers = async (searchTerm: string): Promise<User[]> => {
  try {
    // Note: Firestore doesn't support full-text search
    // This is a simple implementation that searches by exact match
    // For production, consider using Algolia or ElasticSearch
    
    const users: User[] = []
    
    // Search by fullName
    const nameQuery = query(
      collection(db, COLLECTION_NAME),
      where('fullName', '>=', searchTerm),
      where('fullName', '<=', searchTerm + '\uf8ff'),
      limit(10)
    )
    
    const nameSnapshot = await getDocs(nameQuery)
    nameSnapshot.docs.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate(),
        lastLoginAt: doc.data().lastLoginAt?.toDate()
      } as User)
    })
    
    return users
  } catch (error) {
    console.error('Error searching users:', error)
    throw error
  }
}

// Get users by location
export const getUsersByLocation = async (locationId: string): Promise<User[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('allowedLocationIds', 'array-contains', locationId),
      where('isActive', '==', true),
      orderBy('fullName')
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      approvedAt: doc.data().approvedAt?.toDate(),
      lastLoginAt: doc.data().lastLoginAt?.toDate()
    } as User))
  } catch (error) {
    console.error('Error getting users by location:', error)
    throw error
  }
}

// Get user statistics
export const getUserStatistics = async () => {
  try {
    const [totalQuery, activeQuery, pendingQuery] = await Promise.all([
      getDocs(collection(db, COLLECTION_NAME)),
      getDocs(query(collection(db, COLLECTION_NAME), where('isActive', '==', true))),
      getDocs(query(
        collection(db, COLLECTION_NAME), 
        where('needsApproval', '==', true)
      ))
    ])
    
    return {
      total: totalQuery.size,
      active: activeQuery.size,
      pending: pendingQuery.size,
      inactive: totalQuery.size - activeQuery.size - pendingQuery.size
    }
  } catch (error) {
    console.error('Error getting user statistics:', error)
    throw error
  }
}