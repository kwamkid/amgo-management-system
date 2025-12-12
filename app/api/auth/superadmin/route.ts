import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

// Super Admin User ID - fixed ID for super admin account
const SUPER_ADMIN_USER_ID = 'superadmin_system'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' },
        { status: 400 }
      )
    }

    // Get credentials from environment variables
    const envUsername = process.env.SUPER_ADMIN_USERNAME
    const envPassword = process.env.SUPER_ADMIN_PASSWORD

    // Check if environment variables are set
    if (!envUsername || !envPassword) {
      console.error('Super admin credentials not configured in environment variables')
      return NextResponse.json(
        { error: 'ระบบ Super Admin ยังไม่ได้ตั้งค่า' },
        { status: 500 }
      )
    }

    // Verify credentials
    if (username !== envUsername || password !== envPassword) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      )
    }

    // Check if super admin user exists in Firestore
    const userDoc = await adminDb.collection('users').doc(SUPER_ADMIN_USER_ID).get()

    if (!userDoc.exists) {
      // Create super admin user in Firestore
      await adminDb.collection('users').doc(SUPER_ADMIN_USER_ID).set({
        lineUserId: SUPER_ADMIN_USER_ID,
        lineDisplayName: 'Super Admin',
        linePictureUrl: '',
        fullName: 'Super Admin',
        phone: '',
        birthDate: null,
        role: 'admin',
        permissionGroupId: 'super_admin',
        isActive: true,
        isSuperAdmin: true,
        registeredAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp()
      })
    } else {
      // Update last login
      await adminDb.collection('users').doc(SUPER_ADMIN_USER_ID).update({
        lastLoginAt: FieldValue.serverTimestamp()
      })
    }

    // Create Firebase custom token
    const customToken = await adminAuth.createCustomToken(SUPER_ADMIN_USER_ID, {
      lineUserId: SUPER_ADMIN_USER_ID,
      role: 'admin',
      isSuperAdmin: true
    })

    return NextResponse.json({
      success: true,
      token: customToken,
      message: 'เข้าสู่ระบบสำเร็จ'
    })

  } catch (error) {
    console.error('Super admin login error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' },
      { status: 500 }
    )
  }
}
