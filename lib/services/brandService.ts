// ========== FILE: lib/services/brandService.ts ==========
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
  writeBatch
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Brand } from '@/types/influencer'

const COLLECTION_NAME = 'brands'

// Get all brands
export const getBrands = async (includeInactive = false): Promise<Brand[]> => {
  try {
    let q = query(collection(db, COLLECTION_NAME), orderBy('name'))
    
    if (!includeInactive) {
      q = query(q, where('isActive', '==', true))
    }
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    } as Brand))
  } catch (error) {
    console.error('Error getting brands:', error)
    throw error
  }
}

// Get single brand
export const getBrand = async (brandId: string): Promise<Brand | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, brandId)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return null
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate(),
      updatedAt: docSnap.data().updatedAt?.toDate()
    } as Brand
  } catch (error) {
    console.error('Error getting brand:', error)
    throw error
  }
}

// Create brand
export const createBrand = async (data: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return docRef.id
  } catch (error) {
    console.error('Error creating brand:', error)
    throw error
  }
}

// Update brand
export const updateBrand = async (brandId: string, data: Partial<Brand>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, brandId)
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error updating brand:', error)
    throw error
  }
}

// Delete brand (soft delete)
export const deleteBrand = async (brandId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, brandId)
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error deleting brand:', error)
    throw error
  }
}

