import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import axios from 'axios'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state')

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
          fullName: displayName,
          phone: '',
          birthDate: null,
          role: 'admin',
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
          lineUserId: userId, // ✅ เปลี่ยนจาก lineId เป็น lineUserId
          lineDisplayName: displayName,
          ...(pictureUrl && { linePictureUrl: pictureUrl })
        })

        // Check for invite code in cookies or state
        const cookies = request.headers.get('cookie') || ''
        let inviteCode = null
        
        // Try to get from cookies
        const inviteMatch = cookies.match(/invite_code=([^;]+)/)
        if (inviteMatch) {
          inviteCode = inviteMatch[1]
        }
        
        // If not in cookies, try sessionStorage data passed via state
        if (!inviteCode && state) {
          try {
            const stateData = JSON.parse(decodeURIComponent(state))
            inviteCode = stateData.inviteCode
          } catch (e) {
            // State might not be JSON, ignore
          }
        }

        if (inviteCode) {
          params.append('invite', inviteCode)
        }

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

    // Update profile picture and display name every login
    await adminDb.collection('users').doc(userId).update({
      linePictureUrl: pictureUrl || userData.linePictureUrl || '',
      lineDisplayName: displayName,
      lastLoginAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    })

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
    
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data)
      console.error('Response status:', error.response?.status)
    }
    
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
  }
}