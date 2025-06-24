import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import axios from 'axios'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
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

    // Check if user exists in Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get()

    if (!userDoc.exists) {
      // New user - redirect to registration with LINE data
      const params = new URLSearchParams({
        lineId: userId,
        name: displayName,
        ...(pictureUrl && { picture: pictureUrl })
      })
      
      return NextResponse.redirect(
        new URL(`/register?${params.toString()}`, request.url)
      )
    }

    // Existing user - create Firebase custom token
    const userData = userDoc.data()!
    const customToken = await adminAuth.createCustomToken(userId, {
      lineUserId: userId,
      role: userData.role || 'employee',
    })

    // Redirect to client-side auth handler with token
    return NextResponse.redirect(
      new URL(`/auth/verify?token=${customToken}`, request.url)
    )

  } catch (error) {
    console.error('LINE callback error:', error)
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
  }
}