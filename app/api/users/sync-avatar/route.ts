import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Verify caller is authenticated and has management role
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const decoded = await adminAuth.verifyIdToken(token)
    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get()
    const callerRole = callerDoc.data()?.role

    if (!['admin', 'hr', 'manager'].includes(callerRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Clear the stored photo URL so next LINE login refreshes it
    await adminDb.collection('users').doc(userId).update({
      linePictureUrl: '',
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('sync-avatar error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
