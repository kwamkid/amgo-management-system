// lib/services/deliveryService.ts

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
  Timestamp,
  writeBatch
} from 'firebase/firestore'
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { 
  DeliveryPoint, 
  DeliveryRoute,
  CreateDeliveryPointData,
  UpdateDeliveryPointData,
  DeliveryFilters,
  DeliveryPhoto,
  CompressedPhotoResult,
  DELIVERY_PHOTO_CONFIG,
  DELIVERY_CLEANUP_CONFIG
} from '@/types/delivery'

const COLLECTION_NAME = 'deliveryPoints'
const ROUTES_COLLECTION = 'deliveryRoutes'

// ==================== Photo Compression ====================

/**
 * Compress image from base64 or blob
 */
export const compressPhoto = async (
  input: string | Blob,
  options = DELIVERY_PHOTO_CONFIG.compressionOptions
): Promise<CompressedPhotoResult> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    const processImage = () => {
      // Calculate new dimensions
      let { width, height } = img
      const maxWidth = options.maxWidth
      const maxHeight = options.maxHeight
      
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height)
          height = maxHeight
        }
      }
      
      // Create canvas and draw resized image
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      
      // Use better image smoothing
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)
      
      // Convert to blob
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'))
            return
          }
          
          const dataUrl = canvas.toDataURL(`image/${options.format || 'jpeg'}`, options.quality)
          const originalSize = input instanceof Blob ? input.size : new Blob([input]).size
          
          resolve({
            blob,
            dataUrl,
            width,
            height,
            originalSize,
            compressedSize: blob.size
          })
        },
        `image/${options.format || 'jpeg'}`,
        options.quality
      )
    }
    
    img.onload = processImage
    img.onerror = () => reject(new Error('Failed to load image'))
    
    if (typeof input === 'string') {
      img.src = input
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(input)
    }
  })
}

/**
 * Create thumbnail from compressed photo
 */
export const createThumbnail = async (
  input: string | Blob
): Promise<CompressedPhotoResult> => {
  return compressPhoto(input, DELIVERY_PHOTO_CONFIG.thumbnailOptions)
}

// ==================== Photo Upload ====================

/**
 * Upload photo to Firebase Storage
 */
export const uploadDeliveryPhoto = async (
  photoData: string,
  driverId: string,
  deliveryId: string
): Promise<DeliveryPhoto> => {
  try {
    // Check if user is authenticated
    const { auth } = await import('@/lib/firebase/client')
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('User not authenticated')
    }

    // Compress photo
    const compressed = await compressPhoto(photoData)
    const thumbnail = await createThumbnail(photoData)
    
    // Generate filenames
    const timestamp = Date.now()
    const photoId = `${timestamp}_${Math.random().toString(36).substr(2, 9)}`
    // ใช้ structure ที่ไม่ซับซ้อน เพื่อหลีกเลี่ยงปัญหา permission
    const photoPath = `deliveries/${driverId}/${photoId}.jpg`
    const thumbnailPath = `deliveries/${driverId}/${photoId}_thumb.jpg`
    
    // Upload both images
    const photoRef = ref(storage, photoPath)
    const thumbnailRef = ref(storage, thumbnailPath)
    
    const [photoSnapshot, thumbnailSnapshot] = await Promise.all([
      uploadBytes(photoRef, compressed.blob),
      uploadBytes(thumbnailRef, thumbnail.blob)
    ])
    
    const [photoUrl, thumbnailUrl] = await Promise.all([
      getDownloadURL(photoSnapshot.ref),
      getDownloadURL(thumbnailSnapshot.ref)
    ])
    
    return {
      id: photoId,
      url: photoUrl,
      thumbnailUrl,
      originalSize: compressed.originalSize,
      compressedSize: compressed.compressedSize,
      width: compressed.width,
      height: compressed.height,
      uploadedAt: new Date(),
      capturedAt: new Date()
    }
  } catch (error) {
    console.error('Error uploading photo:', error)
    throw new Error('Failed to upload photo')
  }
}

// ==================== Delivery Points ====================

/**
 * Create delivery point (check-in at delivery location)
 */
export const createDeliveryPoint = async (
  data: CreateDeliveryPointData,
  driverId: string,
  driverName: string
): Promise<string> => {
  try {
    // Create delivery point document first to get ID
    const deliveryData: any = {
      driverId,
      driverName,
      checkInTime: serverTimestamp(),
      lat: data.lat,
      lng: data.lng,
      customerName: data.customerName || null,
      customerPhone: data.customerPhone || null,
      orderNumber: data.orderNumber || null,
      deliveryType: data.deliveryType,
      deliveryStatus: 'pending',
      note: data.note || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    
    // Add to Firestore
    const docRef = await addDoc(collection(db, COLLECTION_NAME), deliveryData)
    
    // Upload photo if provided
    if (data.photoCaptureData) {
      const photo = await uploadDeliveryPhoto(
        data.photoCaptureData,
        driverId,
        docRef.id
      )
      
      // Update document with photo info
      await updateDoc(docRef, {
        photo,
        photoUrl: photo.url,
        updatedAt: serverTimestamp()
      })
    }
    
    // Update or create today's route
    await updateDriverRoute(driverId, driverName)
    
    return docRef.id
  } catch (error) {
    console.error('Error creating delivery point:', error)
    throw error
  }
}

/**
 * Update delivery point status
 */
export const updateDeliveryPoint = async (
  deliveryId: string,
  data: UpdateDeliveryPointData
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, deliveryId)
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error updating delivery point:', error)
    throw error
  }
}

/**
 * Get delivery points by filters
 */
export const getDeliveryPoints = async (
  filters: DeliveryFilters,
  pageSize = 20,
  lastDoc?: any
): Promise<{ points: DeliveryPoint[], lastDoc: any, hasMore: boolean }> => {
  try {
    let q = query(collection(db, COLLECTION_NAME))
    
    // Apply filters
    if (filters.driverId) {
      q = query(q, where('driverId', '==', filters.driverId))
    }
    
    if (filters.date) {
      const startOfDay = new Date(filters.date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(filters.date)
      endOfDay.setHours(23, 59, 59, 999)
      
      q = query(
        q,
        where('checkInTime', '>=', Timestamp.fromDate(startOfDay)),
        where('checkInTime', '<=', Timestamp.fromDate(endOfDay))
      )
    }
    
    if (filters.deliveryType) {
      q = query(q, where('deliveryType', '==', filters.deliveryType))
    }
    
    if (filters.deliveryStatus) {
      q = query(q, where('deliveryStatus', '==', filters.deliveryStatus))
    }
    
    // Order and pagination
    q = query(q, orderBy('checkInTime', 'desc'), limit(pageSize + 1))
    
    if (lastDoc) {
      q = query(q, startAfter(lastDoc))
    }
    
    const snapshot = await getDocs(q)
    const points = snapshot.docs.slice(0, pageSize).map(doc => ({
      id: doc.id,
      ...doc.data(),
      checkInTime: doc.data().checkInTime?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    } as DeliveryPoint))
    
    const hasMore = snapshot.docs.length > pageSize
    const newLastDoc = snapshot.docs[pageSize - 1]
    
    return { points, lastDoc: newLastDoc, hasMore }
  } catch (error) {
    console.error('Error getting delivery points:', error)
    throw error
  }
}

/**
 * Get single delivery point
 */
export const getDeliveryPoint = async (deliveryId: string): Promise<DeliveryPoint | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, deliveryId)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return null
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
      checkInTime: docSnap.data().checkInTime?.toDate(),
      createdAt: docSnap.data().createdAt?.toDate(),
      updatedAt: docSnap.data().updatedAt?.toDate()
    } as DeliveryPoint
  } catch (error) {
    console.error('Error getting delivery point:', error)
    throw error
  }
}

// ==================== Routes ====================

/**
 * Update or create driver's route for today
 */
const updateDriverRoute = async (
  driverId: string,
  driverName: string
): Promise<void> => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dateStr = today.toISOString().split('T')[0]
    
    // Check if route exists
    const routeQuery = query(
      collection(db, ROUTES_COLLECTION),
      where('driverId', '==', driverId),
      where('date', '==', dateStr)
    )
    
    const routeSnapshot = await getDocs(routeQuery)
    
    if (routeSnapshot.empty) {
      // Create new route
      await addDoc(collection(db, ROUTES_COLLECTION), {
        driverId,
        driverName,
        date: dateStr,
        totalPoints: 1,
        completedPoints: 0,
        failedPoints: 0,
        status: 'in-progress',
        startTime: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    } else {
      // Update existing route
      const routeDoc = routeSnapshot.docs[0]
      const currentData = routeDoc.data()
      
      await updateDoc(doc(db, ROUTES_COLLECTION, routeDoc.id), {
        totalPoints: (currentData.totalPoints || 0) + 1,
        updatedAt: serverTimestamp()
      })
    }
  } catch (error) {
    console.error('Error updating driver route:', error)
    // Don't throw - this is not critical
  }
}

// ==================== Cleanup Functions ====================

/**
 * Delete old delivery photos
 */
export const cleanupOldPhotos = async (): Promise<number> => {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - DELIVERY_CLEANUP_CONFIG.photosRetentionDays)
    
    // Query old delivery points with photos
    const oldDeliveriesQuery = query(
      collection(db, COLLECTION_NAME),
      where('checkInTime', '<', Timestamp.fromDate(cutoffDate)),
      where('photoUrl', '!=', null)
    )
    
    const snapshot = await getDocs(oldDeliveriesQuery)
    const batch = writeBatch(db)
    let deletedCount = 0
    
    for (const doc of snapshot.docs) {
      const data = doc.data()
      
      // Delete photo from storage
      if (data.photo?.url) {
        try {
          const photoRef = ref(storage, data.photo.url)
          await deleteObject(photoRef)
          
          if (data.photo.thumbnailUrl) {
            const thumbRef = ref(storage, data.photo.thumbnailUrl)
            await deleteObject(thumbRef)
          }
        } catch (error) {
          console.error('Error deleting photo:', error)
        }
      }
      
      // Update document to remove photo
      batch.update(doc.ref, {
        photo: null,
        photoUrl: null,
        updatedAt: serverTimestamp()
      })
      
      deletedCount++
    }
    
    if (deletedCount > 0) {
      await batch.commit()
    }
    
    // Update last cleanup run
    await updateCleanupTimestamp()
    
    return deletedCount
  } catch (error) {
    console.error('Error cleaning up photos:', error)
    throw error
  }
}

/**
 * Delete old delivery data
 */
export const cleanupOldDeliveryData = async (): Promise<number> => {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - DELIVERY_CLEANUP_CONFIG.dataRetentionDays)
    
    const oldDeliveriesQuery = query(
      collection(db, COLLECTION_NAME),
      where('checkInTime', '<', Timestamp.fromDate(cutoffDate))
    )
    
    const snapshot = await getDocs(oldDeliveriesQuery)
    const batch = writeBatch(db)
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref)
    })
    
    if (snapshot.docs.length > 0) {
      await batch.commit()
    }
    
    return snapshot.docs.length
  } catch (error) {
    console.error('Error cleaning up delivery data:', error)
    throw error
  }
}

/**
 * Update cleanup timestamp
 */
const updateCleanupTimestamp = async (): Promise<void> => {
  try {
    const configRef = doc(db, 'config', 'deliveryCleanup')
    await updateDoc(configRef, {
      lastCleanupRun: serverTimestamp()
    })
  } catch (error) {
    // If document doesn't exist, create it
    const configRef = doc(db, 'config', 'deliveryCleanup')
    await addDoc(collection(db, 'config'), {
      id: 'deliveryCleanup',
      lastCleanupRun: serverTimestamp()
    })
  }
}

/**
 * Check if cleanup should run
 */
export const shouldRunCleanup = async (): Promise<boolean> => {
  try {
    const configRef = doc(db, 'config', 'deliveryCleanup')
    const configDoc = await getDoc(configRef)
    
    if (!configDoc.exists()) {
      return true // First run
    }
    
    const lastRun = configDoc.data().lastCleanupRun?.toDate()
    if (!lastRun) {
      return true
    }
    
    const daysSinceLastRun = Math.floor(
      (Date.now() - lastRun.getTime()) / (1000 * 60 * 60 * 24)
    )
    
    return daysSinceLastRun >= DELIVERY_CLEANUP_CONFIG.runCleanupEveryDays
  } catch (error) {
    console.error('Error checking cleanup status:', error)
    return false
  }
}