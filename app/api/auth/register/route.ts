import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  try {
    const { userData, inviteLinkId } = await request.json()

    console.log('Registration data received:', {
      lineUserId: userData.lineUserId,
      role: userData.role,
      inviteLinkId,
      defaultLocationIds: userData.allowedLocationIds
    })

    if (!userData.lineUserId) {
      return NextResponse.json(
        { error: 'Line User ID is required' },
        { status: 400 }
      )
    }

    // 1. สร้างหรืออัพเดท Firebase Auth user
    let authUser
    try {
      // ตรวจสอบว่ามี user อยู่แล้วหรือไม่
      authUser = await adminAuth.getUser(userData.lineUserId)
    } catch (error) {
      // ถ้าไม่มี user ให้สร้างใหม่
      authUser = await adminAuth.createUser({
        uid: userData.lineUserId,
        displayName: userData.lineDisplayName,
        photoURL: userData.linePictureUrl,
      })
    }

    // 2. Set custom claims
    await adminAuth.setCustomUserClaims(userData.lineUserId, {
      role: userData.role,
      isActive: userData.isActive,
    })

    // 3. สร้าง user document ใน Firestore
    const userRef = adminDb.collection('users').doc(userData.lineUserId)
    await userRef.set({
      ...userData,
      registeredAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    // 4. อัพเดท invite link usage count
    if (inviteLinkId) {
      const inviteLinkRef = adminDb.collection('inviteLinks').doc(inviteLinkId)
      await inviteLinkRef.update({
        usedCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    // 5. สร้าง custom token สำหรับ sign in
    const customToken = await adminAuth.createCustomToken(userData.lineUserId)

    return NextResponse.json({
      success: true,
      customToken,
      message: 'ลงทะเบียนสำเร็จ'
    })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'การลงทะเบียนล้มเหลว' },
      { status: 500 }
    )
  }
}