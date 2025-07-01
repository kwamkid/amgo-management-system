// app/api/auth/line/test/route.ts
import { NextResponse } from 'next/server'
import axios from 'axios'

export async function GET() {
  // Test LINE API connection
  try {
    // Check environment variables
    const config = {
      app_url: process.env.NEXT_PUBLIC_APP_URL || 'NOT_SET',
      channel_id: process.env.NEXT_PUBLIC_LINE_CHANNEL_ID || 'NOT_SET',
      has_secret: !!process.env.LINE_CHANNEL_SECRET,
      secret_length: process.env.LINE_CHANNEL_SECRET?.length || 0,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/line/callback`
    }

    // Test LINE API endpoint (this should fail but shows if we can reach LINE)
    let lineApiStatus = 'unknown'
    try {
      await axios.get('https://api.line.me/v2/profile', {
        headers: { Authorization: 'Bearer invalid_token' }
      })
    } catch (error: any) {
      // We expect this to fail with 401
      lineApiStatus = error.response?.status === 401 ? 'reachable' : 'unreachable'
    }

    return NextResponse.json({
      status: 'ok',
      config,
      lineApiStatus,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}