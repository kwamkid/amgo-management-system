import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    await adminAuth.verifyIdToken(token)

    // Fetch active users with birthDate using Admin SDK (bypasses security rules)
    const usersSnapshot = await adminDb
      .collection('users')
      .where('isActive', '==', true)
      .get()

    const birthdays = usersSnapshot.docs
      .filter(doc => doc.data().birthDate)
      .map(doc => {
        const data = doc.data()
        // Convert Firestore Timestamp to ISO string
        let birthDate: string
        if (data.birthDate?.toDate) {
          birthDate = data.birthDate.toDate().toISOString()
        } else if (data.birthDate?.seconds) {
          birthDate = new Date(data.birthDate.seconds * 1000).toISOString()
        } else {
          birthDate = new Date(data.birthDate).toISOString()
        }

        return {
          id: doc.id,
          fullName: data.fullName,
          lineDisplayName: data.lineDisplayName,
          linePictureUrl: data.linePictureUrl || null,
          birthDate,
          role: data.role,
        }
      })

    return NextResponse.json({ birthdays })
  } catch (error) {
    console.error('Error fetching birthdays:', error)
    return NextResponse.json({ error: 'Failed to fetch birthdays' }, { status: 500 })
  }
}
