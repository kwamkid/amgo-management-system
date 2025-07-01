// lib/services/deleteService.ts

import { 
  collection, 
  getDocs, 
  deleteDoc, 
  doc,
  writeBatch,
  query,
  limit
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

const BATCH_SIZE = 500 // Firestore batch limit

/**
 * Delete all documents in a collection (except users and discord settings)
 */
export async function deleteAllData(collectionName: string): Promise<void> {
  // Prevent deleting users collection
  if (collectionName === 'users') {
    throw new Error('Cannot delete users collection')
  }

  try {
    // Special handling for settings - keep discord settings
    if (collectionName === 'settings') {
      await deleteSettingsExceptDiscord()
      return
    }

    // Special handling for checkins (date-partitioned)
    if (collectionName === 'checkins') {
      await deleteCheckinsData()
      return
    }

    // Special handling for quotas (subcollections)
    if (collectionName === 'quotas') {
      await deleteQuotasData()
      return
    }

    // Delete regular collection
    await deleteCollection(collectionName)
  } catch (error) {
    console.error(`Error deleting ${collectionName}:`, error)
    throw error
  }
}

/**
 * Delete a regular collection
 */
async function deleteCollection(collectionName: string): Promise<void> {
  const collectionRef = collection(db, collectionName)
  const q = query(collectionRef, limit(BATCH_SIZE))
  
  while (true) {
    const snapshot = await getDocs(q)
    
    if (snapshot.empty) {
      break
    }
    
    const batch = writeBatch(db)
    
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref)
    })
    
    await batch.commit()
    
    // If we got less than batch size, we're done
    if (snapshot.size < BATCH_SIZE) {
      break
    }
  }
}

/**
 * Delete checkins data (date-partitioned)
 */
async function deleteCheckinsData(): Promise<void> {
  // Get all date folders
  const checkinsRef = collection(db, 'checkins')
  const dateFolders = await getDocs(checkinsRef)
  
  // Delete each date folder
  for (const dateFolder of dateFolders.docs) {
    const recordsRef = collection(db, 'checkins', dateFolder.id, 'records')
    
    // Delete all records in this date
    let hasMore = true
    while (hasMore) {
      const q = query(recordsRef, limit(BATCH_SIZE))
      const snapshot = await getDocs(q)
      
      if (snapshot.empty) {
        hasMore = false
        break
      }
      
      const batch = writeBatch(db)
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref)
      })
      
      await batch.commit()
      
      if (snapshot.size < BATCH_SIZE) {
        hasMore = false
      }
    }
    
    // Delete the date document itself
    await deleteDoc(dateFolder.ref)
  }
}

/**
 * Delete quotas data (subcollections)
 */
async function deleteQuotasData(): Promise<void> {
  // Get all user quota documents
  const quotasRef = collection(db, 'quotas')
  const userQuotas = await getDocs(quotasRef)
  
  // Delete each user's quota data
  for (const userQuota of userQuotas.docs) {
    const yearsRef = collection(db, 'quotas', userQuota.id, 'years')
    
    // Delete all year documents
    let hasMore = true
    while (hasMore) {
      const q = query(yearsRef, limit(BATCH_SIZE))
      const snapshot = await getDocs(q)
      
      if (snapshot.empty) {
        hasMore = false
        break
      }
      
      const batch = writeBatch(db)
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref)
      })
      
      await batch.commit()
      
      if (snapshot.size < BATCH_SIZE) {
        hasMore = false
      }
    }
    
    // Delete the user quota document itself
    await deleteDoc(userQuota.ref)
  }
}

/**
 * Get collection statistics (for preview)
 */
export async function getCollectionStats(): Promise<Record<string, number>> {
  const collections = [
    'checkins',
    'leaves', 
    'locations',
    'inviteLinks',
    'influencers',
    'campaigns',
    'brands',
    'products',
    'submissions',
    'settings'
  ]
  
  const stats: Record<string, number> = {}
  
  for (const collectionName of collections) {
    try {
      if (collectionName === 'checkins') {
        // Count checkins differently
        let count = 0
        const checkinsRef = collection(db, 'checkins')
        const dateFolders = await getDocs(checkinsRef)
        
        for (const dateFolder of dateFolders.docs) {
          const recordsRef = collection(db, 'checkins', dateFolder.id, 'records')
          const recordsSnapshot = await getDocs(recordsRef)
          count += recordsSnapshot.size
        }
        
        stats[collectionName] = count
      } else {
        const snapshot = await getDocs(collection(db, collectionName))
        stats[collectionName] = snapshot.size
      }
    } catch (error) {
      stats[collectionName] = 0
    }
  }
  
  return stats
}

/**
 * Delete specific document
 */
export async function deleteDocument(collectionName: string, documentId: string): Promise<void> {
  const docRef = doc(db, collectionName, documentId)
  await deleteDoc(docRef)
}

/**
 * Delete settings except discord settings
 */
async function deleteSettingsExceptDiscord(): Promise<void> {
  const settingsRef = collection(db, 'settings')
  const snapshot = await getDocs(settingsRef)
  
  const batch = writeBatch(db)
  
  snapshot.docs.forEach((doc) => {
    // Skip discord settings document
    if (doc.id !== 'discord') {
      batch.delete(doc.ref)
    }
  })
  
  await batch.commit()
}

/**
 * Clean up orphaned data
 */
export async function cleanupOrphanedData(): Promise<void> {
  // This can be expanded to clean up:
  // - Check-ins for deleted users
  // - Leaves for deleted users
  // - Campaign assignments for deleted influencers
  // etc.
  
  console.log('Cleanup orphaned data - not implemented yet')
}