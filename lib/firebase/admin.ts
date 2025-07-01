// lib/firebase/admin.ts (Base64 version)
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  // Decode private key from base64
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64
    ? Buffer.from(process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64, 'base64').toString('utf-8')
    : undefined

  if (!privateKey) {
    throw new Error('Firebase Admin private key not found')
  }

  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey: privateKey,
      }),
    })
    console.log('Firebase Admin initialized successfully')
  } catch (error) {
    console.error('Firebase Admin initialization error:', error)
    throw error
  }
}

export const adminAuth = getAuth()
export const adminDb = getFirestore()