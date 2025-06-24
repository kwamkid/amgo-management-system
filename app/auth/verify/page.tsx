'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithCustomToken } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'

function VerifyAuth() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token')
      const firstLogin = searchParams.get('firstLogin')

      if (!token) {
        router.push('/login?error=no_token')
        return
      }

      try {
        // Sign in with Firebase custom token
        await signInWithCustomToken(auth, token)
        
        // Redirect based on first login or not
        if (firstLogin === 'true') {
          // First time admin - might want to complete profile
          router.push('/dashboard')  // ไปหน้า dashboard ก่อน
        } else {
          // Regular login - go to dashboard
          router.push('/dashboard')
        }
      } catch (error) {
        console.error('Token verification failed:', error)
        router.push('/login?error=invalid_token')
      }
    }

    verifyToken()
  }, [router, searchParams])

  return (
    <div className="text-center">
      <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-red-500 border-r-transparent mb-4"></div>
      <h2 className="text-xl font-semibold text-gray-700">กำลังยืนยันตัวตน...</h2>
      <p className="text-gray-500 mt-2">กรุณารอสักครู่</p>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-500 border-r-transparent"></div>
        </div>
      }>
        <VerifyAuth />
      </Suspense>
    </div>
  )
}