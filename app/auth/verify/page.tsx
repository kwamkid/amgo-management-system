'use client'

import { useEffect, Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInBoth } from '@/lib/auth/dual-session'

/**
 * แลก token_hash จาก LINE callback เป็น session ของ Supabase
 *
 * ต้องทำฝั่ง client เพราะ verifyOtp เป็นตัวที่เขียน cookie session ลงเบราว์เซอร์
 */
function VerifyAuth() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const tokenHash = params.get('token_hash')
      if (!tokenHash) {
        router.replace('/login?error=no_token')
        return
      }

      try {
        await signInBoth({ tokenHash, firebaseToken: params.get('fb') })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(msg)
        setError(msg)
        setTimeout(() => router.replace('/login?error=invalid_token'), 1500)
        return
      }

      // refresh() เพื่อให้ Server Component อ่าน cookie ใหม่เห็น session
      // ล็อกอินสำเร็จแล้วไปไหนต่อ — ปกติ /dashboard
      // แต่ถ้ายังไม่ได้ผูก Discord จะถูกส่งมาพร้อม next=/link-discord
      const next = params.get('next')
      router.replace(next && next.startsWith('/') ? next : '/dashboard')
      router.refresh()
    }
    run()
  }, [router, params])

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-red-500 border-r-transparent" />
      <h2 className="text-xl font-semibold text-gray-800">
        {error ? 'ยืนยันตัวตนไม่สำเร็จ' : 'กำลังยืนยันตัวตน…'}
      </h2>
      <p className="mt-2 text-gray-600">{error ?? 'กรุณารอสักครู่'}</p>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
        <Suspense
          fallback={
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-400 border-r-transparent" />
            </div>
          }
        >
          <VerifyAuth />
        </Suspense>
      </div>
    </div>
  )
}
