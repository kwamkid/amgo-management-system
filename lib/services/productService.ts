// ========== FILE: lib/services/productService.ts ==========
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
  serverTimestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Product } from '@/types/influencer'

const COLLECTION_NAME = 'products'

// Get all products
export const getProducts = async (brandId?: string, includeInactive = false): Promise<Product[]> => {
  try {
    let q = query(collection(db, COLLECTION_NAME), orderBy('name'))
    
    if (brandId) {
      q = query(q, where('brandId', '==', brandId))
    }
    
    if (!includeInactive) {
      q = query(q, where('isActive', '==', true))
    }
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    } as Product))
  } catch (error) {
    console.error('Error getting products:', error)
    throw error
  }
}

// Get products by brand
export const getProductsByBrand = async (brandId: string): Promise<Product[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('brandId', '==', brandId),
      where('isActive', '==', true),
      orderBy('name')
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    } as Product))
  } catch (error) {
    console.error('Error getting products by brand:', error)
    throw error
  }
}

// Get single product
export const getProduct = async (productId: string): Promise<Product | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, productId)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return null
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate(),
      updatedAt: docSnap.data().updatedAt?.toDate()
    } as Product
  } catch (error) {
    console.error('Error getting product:', error)
    throw error
  }
}

// Create product
export const createProduct = async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return docRef.id
  } catch (error) {
    console.error('Error creating product:', error)
    throw error
  }
}

// Update product
export const updateProduct = async (productId: string, data: Partial<Product>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, productId)
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error updating product:', error)
    throw error
  }
}

// Delete product (soft delete)
export const deleteProduct = async (productId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, productId)
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error deleting product:', error)
    throw error
  }
}

// Get products by multiple brands
export const getProductsByBrands = async (brandIds: string[]): Promise<Product[]> => {
  try {
    if (!brandIds.length) return []
    
    const q = query(
      collection(db, COLLECTION_NAME),
      where('brandId', 'in', brandIds),
      where('isActive', '==', true),
      orderBy('brandId'),
      orderBy('name')
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    } as Product))
  } catch (error) {
    console.error('Error getting products by brands:', error)
    throw error
  }
}