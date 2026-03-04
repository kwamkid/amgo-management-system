import { NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

// Dev-only endpoint — disabled in production
export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const DEV_USER_ID = 'dev-admin-user'

  try {
    // Ensure Firebase Auth user exists
    try {
      await adminAuth.getUser(DEV_USER_ID)
    } catch {
      await adminAuth.createUser({
        uid: DEV_USER_ID,
        displayName: 'Dev Admin',
      })
    }

    // Set admin claims
    await adminAuth.setCustomUserClaims(DEV_USER_ID, {
      role: 'admin',
      isActive: true,
    })

    // Ensure Firestore user document exists
    const userRef = adminDb.collection('users').doc(DEV_USER_ID)
    const userDoc = await userRef.get()
    if (!userDoc.exists) {
      await userRef.set({
        lineUserId: DEV_USER_ID,
        lineDisplayName: 'Dev Admin',
        linePictureUrl: '',
        fullName: 'Dev Admin',
        phone: '',
        role: 'admin',
        isActive: true,
        needsApproval: false,
        permissionGroupId: null,
        allowedLocationIds: [],
        allowCheckInOutsideLocation: true,
        registeredAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    // Create custom token for client to sign in with
    const customToken = await adminAuth.createCustomToken(DEV_USER_ID)
    return NextResponse.json({ token: customToken })
  } catch (error) {
    console.error('Dev login error:', error)
    return NextResponse.json({ error: 'Dev login failed' }, { status: 500 })
  }
}
