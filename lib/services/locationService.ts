// lib/services/locationService.ts

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
  Timestamp 
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Location, LocationFormData } from '@/types/location'

const COLLECTION_NAME = 'locations'

// Get all locations
export const getLocations = async (activeOnly = false): Promise<Location[]> => {
  try {
    let q = query(
      collection(db, COLLECTION_NAME),
      orderBy('name')
    )
    
    if (activeOnly) {
      q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true),
        orderBy('name')
      )
    }
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    } as Location))
  } catch (error) {
    console.error('Error getting locations:', error)
    throw error
  }
}

// Get single location
export const getLocation = async (locationId: string): Promise<Location | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, locationId)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return null
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate(),
      updatedAt: docSnap.data().updatedAt?.toDate()
    } as Location
  } catch (error) {
    console.error('Error getting location:', error)
    throw error
  }
}

// Create location
export const createLocation = async (data: LocationFormData): Promise<string> => {
  try {
    const docData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    
    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData)
    return docRef.id
  } catch (error) {
    console.error('Error creating location:', error)
    throw error
  }
}

// Update location
export const updateLocation = async (locationId: string, data: Partial<LocationFormData>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, locationId)
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error updating location:', error)
    throw error
  }
}

// Delete location (soft delete - set isActive to false)
export const deleteLocation = async (locationId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, locationId)
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error deleting location:', error)
    throw error
  }
}

// Hard delete location (permanent)
export const hardDeleteLocation = async (locationId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, locationId)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('Error hard deleting location:', error)
    throw error
  }
}

// Get locations by IDs
export const getLocationsByIds = async (locationIds: string[]): Promise<Location[]> => {
  try {
    if (locationIds.length === 0) return []
    
    const locations = await Promise.all(
      locationIds.map(id => getLocation(id))
    )
    
    return locations.filter((loc): loc is Location => loc !== null)
  } catch (error) {
    console.error('Error getting locations by IDs:', error)
    throw error
  }
}

// Check if location name already exists
export const isLocationNameExists = async (name: string, excludeId?: string): Promise<boolean> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('name', '==', name)
    )
    
    const snapshot = await getDocs(q)
    
    if (excludeId) {
      return snapshot.docs.some(doc => doc.id !== excludeId)
    }
    
    return !snapshot.empty
  } catch (error) {
    console.error('Error checking location name:', error)
    throw error
  }
}