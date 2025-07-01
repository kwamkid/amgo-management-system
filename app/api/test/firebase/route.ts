// app/api/test/firebase/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Test Firebase Admin initialization
    const config = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'NOT_SET',
      hasClientEmail: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
      privateKeyLength: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.length || 0
    }

    // Test creating a custom token (without actual Firebase Admin)
    let authTest = 'not_tested'
    let firestoreTest = 'not_tested'
    
    try {
      // Don't import at top level to avoid build errors
      const { adminAuth, adminDb } = await import('@/lib/firebase/admin')
      
      // Test auth
      try {
        const token = await adminAuth.createCustomToken('test_user_123')
        authTest = token ? 'success' : 'failed'
      } catch (error: any) {
        authTest = `error: ${error.message}`
      }
      
      // Test firestore
      try {
        const testRef = adminDb.collection('_test').doc('ping')
        await testRef.set({ ping: 'pong', timestamp: new Date() })
        const doc = await testRef.get()
        firestoreTest = doc.exists ? 'success' : 'failed'
      } catch (error: any) {
        firestoreTest = `error: ${error.message}`
      }
    } catch (importError: any) {
      authTest = `import_error: ${importError.message}`
      firestoreTest = 'import_error'
    }

    return NextResponse.json({
      status: 'ok',
      firebase: {
        config,
        authTest,
        firestoreTest
      },
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