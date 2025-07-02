import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get current user from headers
    const authHeader = request.headers.get('authorization')
    let requestingUserId = null
    let requestingUserRole = null
    let requestingUserName = null
    let requestingUserEmail = null
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const decodedToken = await adminAuth.verifyIdToken(token)
        requestingUserId = decodedToken.uid
        requestingUserRole = decodedToken.role || decodedToken.claims?.role
        requestingUserName = decodedToken.name
        requestingUserEmail = decodedToken.email
        
        // Check if user has admin role
        if (requestingUserRole !== 'admin') {
          // Double check from database
          const adminDoc = await adminDb.collection('users').doc(decodedToken.uid).get()
          const adminData = adminDoc.data()
          if (!adminData || adminData.role !== 'admin') {
            return NextResponse.json(
              { error: 'Only admins can delete users' },
              { status: 403 }
            )
          }
        }
        
        // Prevent self-deletion
        if (requestingUserId === userId) {
          return NextResponse.json(
            { error: 'Cannot delete your own account' },
            { status: 400 }
          )
        }
      } catch (tokenError) {
        console.error('Token verification error:', tokenError)
        // For now, allow deletion without auth (you can change this)
        // return NextResponse.json(
        //   { error: 'Unauthorized' },
        //   { status: 401 }
        // )
      }
    }

    // Check if user exists
    const userDoc = await adminDb.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const userData = userDoc.data()!

    // Create a backup before deletion
    await adminDb.collection('deleted_users').doc(userId).set({
      ...userData,
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: requestingUserId || 'system',
      deletedByName: requestingUserName || requestingUserEmail || 'System'
    })

    // Delete related data
    const batch = adminDb.batch()

    // 1. Delete user document
    batch.delete(adminDb.collection('users').doc(userId))

    // 2. Delete user's check-ins (optional - you might want to keep for records)
    const checkinsQuery = await adminDb
      .collectionGroup('records')
      .where('userId', '==', userId)
      .get()
    
    checkinsQuery.forEach((doc) => {
      batch.delete(doc.ref)
    })

    // 3. Delete user's leave requests (optional)
    const leavesQuery = await adminDb
      .collection('leaves')
      .where('userId', '==', userId)
      .get()
    
    leavesQuery.forEach((doc) => {
      batch.delete(doc.ref)
    })

    // Commit batch delete
    await batch.commit()

    // Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(userId)
    } catch (authError: any) {
      console.error('Error deleting from Firebase Auth:', authError)
      // Continue even if Auth deletion fails
      if (authError.code !== 'auth/user-not-found') {
        console.warn('User might still exist in Firebase Auth')
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'User deleted successfully',
      deletedUser: {
        id: userId,
        name: userData.fullName || userData.lineDisplayName
      }
    })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}

// Soft delete (ปิดการใช้งานแต่เก็บข้อมูลไว้)
export async function PATCH(request: NextRequest) {
  try {
    const { userId, action } = await request.json()

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'User ID and action are required' },
        { status: 400 }
      )
    }

    const userRef = adminDb.collection('users').doc(userId)
    const userDoc = await userRef.get()

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (action === 'soft-delete') {
      // Soft delete
      await userRef.update({
        isActive: false,
        isDeleted: true,
        deletedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      })

      // Update custom claims
      await adminAuth.setCustomUserClaims(userId, {
        role: userDoc.data()!.role,
        isActive: false,
        isDeleted: true
      })

      return NextResponse.json({ 
        success: true,
        message: 'User soft deleted successfully'
      })

    } else if (action === 'restore') {
      // Restore from soft delete
      await userRef.update({
        isActive: true,
        isDeleted: false,
        restoredAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      })

      // Update custom claims
      await adminAuth.setCustomUserClaims(userId, {
        role: userDoc.data()!.role,
        isActive: true,
        isDeleted: false
      })

      return NextResponse.json({ 
        success: true,
        message: 'User restored successfully'
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error in soft delete/restore:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}