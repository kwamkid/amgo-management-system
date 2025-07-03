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
  startAfter,
  or
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { User, UserFilters } from '@/types/user'

const COLLECTION_NAME = 'users'

// Get all users with improved filtering
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
    let allUsers: User[] = []
    
    // ถ้ามี searchTerm ให้ใช้การ search แทน
    if (filters?.searchTerm && filters.searchTerm.trim()) {
      const searchResults = await searchUsersByTerm(filters.searchTerm)
      allUsers = searchResults
    } else {
      // Basic query - แยก query ตาม filters เพื่อหลีกเลี่ยงปัญหา composite index
      let baseQuery = collection(db, COLLECTION_NAME)
      
      // สร้าง queries แยกตาม filter แต่ละตัว
      const queries = []
      
      // Base query with isActive filter (most common)
      if (filters?.isActive !== undefined) {
        queries.push(
          query(baseQuery, 
            where('isActive', '==', filters.isActive),
            orderBy('createdAt', 'desc')
          )
        )
      } else {
        queries.push(
          query(baseQuery, orderBy('createdAt', 'desc'))
        )
      }
      
      // Fetch all documents from base query
      const snapshots = await Promise.all(
        queries.map(q => getDocs(q))
      )
      
      // Combine and deduplicate results
      const userMap = new Map<string, User>()
      
      snapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          const userData = {
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
            approvedAt: doc.data().approvedAt?.toDate(),
            lastLoginAt: doc.data().lastLoginAt?.toDate()
          } as User
          
          userMap.set(doc.id, userData)
        })
      })
      
      allUsers = Array.from(userMap.values())
      
      // Apply client-side filters
      if (filters?.role) {
        allUsers = allUsers.filter(user => user.role === filters.role)
      }
      
      if (filters?.locationId) {
        allUsers = allUsers.filter(user => 
          user.allowedLocationIds?.includes(filters.locationId!)
        )
      }
      
      // Sort by createdAt desc
      allUsers.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return dateB - dateA
      })
    }
    
    // Implement pagination on client side
    const startIndex = lastDoc ? allUsers.findIndex(u => u.id === lastDoc.id) + 1 : 0
    const paginatedUsers = allUsers.slice(startIndex, startIndex + pageSize)
    const hasMore = startIndex + pageSize < allUsers.length
    const newLastDoc = paginatedUsers.length > 0 ? { id: paginatedUsers[paginatedUsers.length - 1].id } : null
    
    return { users: paginatedUsers, lastDoc: newLastDoc, hasMore }
  } catch (error) {
    console.error('Error getting users:', error)
    throw error
  }
}

// Improved search function
const searchUsersByTerm = async (searchTerm: string): Promise<User[]> => {
  try {
    const normalizedSearch = searchTerm.toLowerCase().trim()
    const users: User[] = []
    
    // Get all active users first (more efficient than complex queries)
    const allUsersQuery = query(
      collection(db, COLLECTION_NAME),
      where('isActive', '==', true)
    )
    
    const snapshot = await getDocs(allUsersQuery)
    
    snapshot.docs.forEach(doc => {
      const userData = {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate(),
        lastLoginAt: doc.data().lastLoginAt?.toDate()
      } as User
      
      // Search in multiple fields
      const searchableText = [
        userData.fullName,
        userData.lineDisplayName,
        userData.phone,
        userData.discordUsername
      ].filter(Boolean).join(' ').toLowerCase()
      
      if (searchableText.includes(normalizedSearch)) {
        users.push(userData)
      }
    })
    
    return users
  } catch (error) {
    console.error('Error searching users:', error)
    return []
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

// Search users - ใช้ function searchUsersByTerm ที่ปรับปรุงแล้ว
export const searchUsers = async (searchTerm: string): Promise<User[]> => {
  return searchUsersByTerm(searchTerm)
}

// Get users by location
export const getUsersByLocation = async (locationId: string): Promise<User[]> => {
  try {
    // เนื่องจาก array-contains กับ orderBy อาจต้องการ composite index
    // เราจะ query แบบง่ายๆ แล้ว filter ฝั่ง client
    const q = query(
      collection(db, COLLECTION_NAME),
      where('isActive', '==', true)
    )
    
    const snapshot = await getDocs(q)
    const allUsers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      approvedAt: doc.data().approvedAt?.toDate(),
      lastLoginAt: doc.data().lastLoginAt?.toDate()
    } as User))
    
    // Filter by location on client side
    return allUsers
      .filter(user => user.allowedLocationIds?.includes(locationId))
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''))
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
    
    // นับจำนวนตาม role
    const byRole = {
      admin: 0,
      hr: 0,
      manager: 0,
      employee: 0,
      marketing: 0,
      driver: 0
    }

    totalQuery.docs.forEach(doc => {
      const userData = doc.data()
      if (userData.role && userData.role in byRole) {
        byRole[userData.role as keyof typeof byRole]++
      }
    })

    return {
      total: totalQuery.size,
      active: activeQuery.size,
      pending: pendingQuery.size,
      inactive: totalQuery.size - activeQuery.size - pendingQuery.size,
      byRole
    }
  } catch (error) {
    console.error('Error getting user statistics:', error)
    throw error
  }
}

// Refresh user custom claims
export const refreshUserClaims = async (userId: string): Promise<void> => {
  try {
    const response = await fetch('/api/users/update-claims', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId })
    })

    if (!response.ok) {
      throw new Error('Failed to refresh user claims')
    }

    // Force token refresh
    const { auth } = await import('@/lib/firebase/client')
    const currentUser = auth.currentUser
    if (currentUser) {
      await currentUser.getIdToken(true) // Force refresh token
    }
  } catch (error) {
    console.error('Error refreshing user claims:', error)
    throw error
  }
}

// Update user role with claims refresh
export const updateUserRoleWithClaims = async (userId: string, role: string): Promise<void> => {
  try {
    // First update Firestore
    await updateUserRole(userId, role)
    
    // Then refresh custom claims
    await refreshUserClaims(userId)
  } catch (error) {
    console.error('Error updating user role with claims:', error)
    throw error
  }
}

// Delete user (soft delete - เก็บข้อมูลไว้แต่ทำให้ใช้งานไม่ได้)
export const softDeleteUser = async (userId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId)
    await updateDoc(docRef, {
      isActive: false,
      isDeleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error soft deleting user:', error)
    throw error
  }
}

// Delete user permanently (ลบจริง - ใช้ด้วยความระวัง!)
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    // Get current user token
    const { auth } = await import('@/lib/firebase/client')
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('User not authenticated')
    }
    const token = await currentUser.getIdToken()

    // Call API to delete from Firebase Auth and Firestore
    const response = await fetch('/api/users/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ userId })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete user')
    }
  } catch (error) {
    console.error('Error deleting user:', error)
    throw error
  }
}

// Restore deleted user (กู้คืนจาก soft delete)
export const restoreUser = async (userId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId)
    await updateDoc(docRef, {
      isActive: true,
      isDeleted: false,
      restoredAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    
    // Refresh custom claims
    await refreshUserClaims(userId)
  } catch (error) {
    console.error('Error restoring user:', error)
    throw error
  }
}