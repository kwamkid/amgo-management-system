'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLoading } from '@/lib/contexts/LoadingContext'
import Image from 'next/image'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// แยก Component ที่ใช้ useSearchParams
function LoginForm() {
  const { showLoading } = useLoading()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      switch (errorParam) {
        case 'access_denied':
          setError('คุณปฏิเสธการเข้าถึงข้อมูล')
          break
        case 'auth_failed':
          setError('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่')
          break
        default:
          setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      }
    }
  }, [searchParams])

  const handleLineLogin = () => {
    showLoading()
    setIsLoading(true)
    
    const state = Math.random().toString(36).substring(2, 15)
    
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('line_auth_state', state)
    }
    
    const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?` +
      `response_type=code&` +
      `client_id=${process.env.NEXT_PUBLIC_LINE_CHANNEL_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_APP_URL + '/api/auth/line/callback')}&` +
      `state=${state}&` +
      `scope=profile%20openid`
    
    window.location.href = lineAuthUrl
  }

  return (
    <>
      {/* Error Message */}
      {error && (
        <Alert variant="error" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Login Button */}
      <Button
        onClick={handleLineLogin}
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-4 text-lg font-medium"
        size="lg"
      >
        {/* LINE Icon */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white" className="mr-3">
          <path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.66 8.87 8.41 9.77.61.11.83-.26.83-.58 0-.29-.01-1.04-.01-2.04-3.34.73-4.04-1.61-4.04-1.61-.55-1.41-1.34-1.78-1.34-1.78-1.11-.76.08-.75.08-.75 1.22.09 1.86 1.25 1.86 1.25 1.08 1.87 2.86 1.33 3.54 1.02.11-.79.42-1.33.77-1.63-2.66-.3-5.46-1.35-5.46-6.01 0-1.33.47-2.41 1.25-3.25-.12-.3-.54-1.54.12-3.21 0 0 1.02-.33 3.35 1.25.97-.27 2.01-.4 3.05-.41 1.03 0 2.07.14 3.05.41 2.32-1.58 3.34-1.25 3.34-1.25.66 1.66.24 2.91.12 3.21.78.84 1.25 1.92 1.25 3.25 0 4.67-2.81 5.7-5.48 6 .43.37.81 1.1.81 2.22v3.29c0 .32.21.69.82.58C20.34 20.87 24 16.84 24 12c0-5.52-4.48-10-10-10z"/>
        </svg>
        {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย LINE'}
      </Button>
    </>
  )
}

// Main Component with Suspense
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8">
      <div className="relative w-full max-w-md">
        <Card className="backdrop-blur-xl bg-white/90 shadow-2xl">
          <CardContent className="p-8 sm:p-10">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center mb-4">
                <Image 
                  src="/logo.svg" 
                  alt="AMGO Logo" 
                  width={150} 
                  height={60}
                  className="h-30 w-auto"
                />
              </div>
              <p className="text-gray-600 mt-2 text-sm sm:text-base">ระบบบริหารจัดการพนักงาน</p>
            </div>

            {/* Login Form */}
            <Suspense fallback={
              <div className="w-full py-4 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-500 border-r-transparent"></div>
              </div>
            }>
              <LoginForm />
            </Suspense>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-px bg-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-400">หรือ</span>
              </div>
            </div>

            {/* Info Box */}
            <Alert variant="info" className="bg-gradient-to-r from-red-50 to-rose-50">
              <AlertDescription>
                <h3 className="font-semibold text-red-900 text-sm mb-2">สำหรับพนักงาน AMGO เท่านั้น</h3>
                <ul className="space-y-1 text-xs text-red-700">
                  <li>• ใช้บัญชี LINE ส่วนตัวในการเข้าสู่ระบบ</li>
                  <li>• ติดต่อ HR หากยังไม่ได้รับอนุมัติ</li>
                  <li>• ข้อมูลของคุณจะถูกเก็บอย่างปลอดภัย</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-xs text-gray-400">
                ติดต่อ HR: hr@amgo.co.th | 02-XXX-XXXX
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            การเชื่อมต่อของคุณได้รับการเข้ารหัสและปลอดภัย
          </p>
        </div>
      </div>
    </div>
  )
}