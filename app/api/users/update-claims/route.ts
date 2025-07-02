import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get user data from Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get()
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const userData = userDoc.data()!

    // Update custom claims
    await adminAuth.setCustomUserClaims(userId, {
      role: userData.role,
      isActive: userData.isActive,
    })

    console.log(`Updated claims for user ${userId}:`, {
      role: userData.role,
      isActive: userData.isActive
    })

    return NextResponse.json({ 
      success: true,
      message: 'Custom claims updated successfully',
      claims: {
        role: userData.role,
        isActive: userData.isActive
      }
    })

  } catch (error) {
    console.error('Error updating custom claims:', error)
    return NextResponse.json(
      { error: 'Failed to update custom claims' },
      { status: 500 }
    )
  }
}

// Batch update all users' claims (for fixing existing users)
export async function PUT(request: NextRequest) {
  try {
    const usersSnapshot = await adminDb.collection('users').get()
    const updatePromises: Promise<void>[] = []

    usersSnapshot.forEach((doc) => {
      const userData = doc.data()
      const userId = doc.id

      updatePromises.push(
        adminAuth.setCustomUserClaims(userId, {
          role: userData.role || 'employee',
          isActive: userData.isActive || false,
        })
      )
    })

    await Promise.all(updatePromises)

    return NextResponse.json({ 
      success: true,
      message: `Updated claims for ${updatePromises.length} users`
    })

  } catch (error) {
    console.error('Error batch updating custom claims:', error)
    return NextResponse.json(
      { error: 'Failed to batch update custom claims' },
      { status: 500 }
    )
  }
}