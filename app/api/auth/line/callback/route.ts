import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'  // ✅ เพิ่ม import นี้
import axios from 'axios'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // Handle user denial
  if (error) {
    return NextResponse.redirect(new URL('/login?error=access_denied', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url))
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://api.line.me/oauth2/v2.1/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/line/callback`,
        client_id: process.env.NEXT_PUBLIC_LINE_CHANNEL_ID!,
        client_secret: process.env.LINE_CHANNEL_SECRET!,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    const { access_token } = tokenResponse.data

    // Get user profile from LINE
    const profileResponse = await axios.get('https://api.line.me/v2/profile', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    const { userId, displayName, pictureUrl } = profileResponse.data

    // Check if this is the first user in the system
    const usersSnapshot = await adminDb.collection('users').limit(1).get()
    const isFirstUser = usersSnapshot.empty

    // Check if user exists in Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get()

    if (!userDoc.exists) {
      // New user registration
      if (isFirstUser) {
        // First user becomes Super Admin automatically
        console.log('🎉 Creating first user as Super Admin:', displayName)
        
        await adminDb.collection('users').doc(userId).set({
          lineUserId: userId,
          lineDisplayName: displayName,
          linePictureUrl: pictureUrl || '',
          fullName: displayName, // Can be updated later
          phone: '', // Will be required to fill later
          birthDate: null, // Will be required to fill later
          role: 'admin', // ⭐ First user = Admin
          permissionGroupId: 'super_admin',
          isActive: true,
          registeredAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp()
        })

        // Create Firebase custom token for admin
        const customToken = await adminAuth.createCustomToken(userId, {
          lineUserId: userId,
          role: 'admin',
        })

        // Redirect to auth verify page
        return NextResponse.redirect(
          new URL(`/auth/verify?token=${customToken}&firstLogin=true`, request.url)
        )
      } else {
        // Regular new user - redirect to registration
        const params = new URLSearchParams({
          lineId: userId,
          name: displayName,
          ...(pictureUrl && { picture: pictureUrl })
        })
        
        return NextResponse.redirect(
          new URL(`/register?${params.toString()}`, request.url)
        )
      }
    }

    // Existing user - check if active
    const userData = userDoc.data()!
    
    if (!userData.isActive) {
      return NextResponse.redirect(
        new URL('/login?error=account_inactive', request.url)
      )
    }

    // Create Firebase custom token
    const customToken = await adminAuth.createCustomToken(userId, {
      lineUserId: userId,
      role: userData.role || 'employee',
    })

    // Redirect to auth verify page
    return NextResponse.redirect(
      new URL(`/auth/verify?token=${customToken}`, request.url)
    )

  } catch (error) {
    console.error('LINE callback error:', error)
    
    // Log more details for debugging
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data)
      console.error('Response status:', error.response?.status)
    }
    
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
  }
}