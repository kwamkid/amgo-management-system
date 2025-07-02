'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { validateInviteLink } from '@/lib/services/inviteService'
import { InviteLink } from '@/types/invite'
import Image from 'next/image'
import { AlertCircle, CheckCircle, Users, Shield, MapPin } from 'lucide-react'
import { useLoading } from '@/lib/contexts/LoadingContext'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function PreRegisterForm() {
  const searchParams = useSearchParams()
  const { showLoading } = useLoading()
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const validateInvite = async () => {
      const inviteCode = searchParams.get('invite')
      
      if (!inviteCode) {
        setError('ไม่พบรหัส invite link')
        setLoading(false)
        return
      }

      const validation = await validateInviteLink(inviteCode)
      if (!validation.valid) {
        setError(validation.error || 'ลิงก์ไม่ถูกต้อง')
      } else {
        setInviteLink(validation.link!)
      }
      setLoading(false)
    }

    validateInvite()
  }, [searchParams])

  const handleLineRegister = () => {
    if (!inviteLink) return
    
    showLoading()
    
    // Generate state with invite code
    const stateData = {
      random: Math.random().toString(36).substring(2, 15),
      inviteCode: inviteLink.code
    }
    const state = encodeURIComponent(JSON.stringify(stateData))
    
    // Store in sessionStorage as backup
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('invite_code', inviteLink.code)
      sessionStorage.setItem('invite_link_data', JSON.stringify({
        id: inviteLink.id,
        code: inviteLink.code,
        defaultRole: inviteLink.defaultRole,
        defaultLocationIds: inviteLink.defaultLocationIds,
        allowCheckInOutsideLocation: inviteLink.allowCheckInOutsideLocation,
        requireApproval: inviteLink.requireApproval
      }))
    }
    
    const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?` +
      `response_type=code&` +
      `client_id=${process.env.NEXT_PUBLIC_LINE_CHANNEL_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_APP_URL + '/api/auth/line/callback')}&` +
      `state=${state}&` +
      `scope=profile%20openid`
    
    window.location.href = lineAuthUrl
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-600">กำลังตรวจสอบ invite link...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="bg-red-50">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">ลิงก์ไม่ถูกต้อง</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/login'}
            className="bg-red-100 hover:bg-red-200 text-red-700"
          >
            ไปหน้า Login
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Invite Link Info */}
      <Card className="bg-gradient-to-r from-teal-50 to-emerald-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm">
              <CheckCircle className="w-8 h-8 text-teal-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-teal-900 mb-1">
                ลิงก์ถูกต้อง!
              </h3>
              <p className="text-teal-800 mb-3">
                รหัส: <Badge variant="success" className="ml-1">{inviteLink?.code}</Badge>
              </p>
              {inviteLink?.note && (
                <p className="text-teal-700 text-sm mb-3 italic">"{inviteLink.note}"</p>
              )}
              
              {/* Show details */}
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2 text-teal-700">
                  <Shield className="w-4 h-4" />
                  <span>
                   สิทธิ์เริ่มต้น: <strong className="text-red-600">
                    {inviteLink?.defaultRole === 'employee' ? 'พนักงาน' : 
                    inviteLink?.defaultRole === 'manager' ? 'ผู้จัดการ' : 
                    inviteLink?.defaultRole === 'hr' ? 'ฝ่ายบุคคล' : 
                    inviteLink?.defaultRole === 'marketing' ? 'Influ Marketing' :  // ✅ เพิ่ม
                    inviteLink?.defaultRole === 'driver' ? 'พนักงานขับรถ' :       // ✅ เพิ่ม
                    'ผู้ดูแลระบบ'}
                  </strong>
                  </span>
                </div>
                
                {inviteLink?.defaultLocationIds && inviteLink.defaultLocationIds.length > 0 && (
                  <div className="flex items-center gap-2 text-teal-700">
                    <MapPin className="w-4 h-4" />
                    <span>สาขาที่กำหนด: <strong>{inviteLink.defaultLocationIds.length} แห่ง</strong></span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-teal-700">
                  <Users className="w-4 h-4" />
                  <span>
                    {inviteLink?.requireApproval 
                      ? 'ต้องรอ HR อนุมัติหลังสมัคร' 
                      : '✨ ใช้งานได้ทันทีหลังสมัคร'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registration Steps */}
      <Alert variant="info">
        <AlertDescription>
          <h3 className="font-semibold text-blue-900 mb-3">ขั้นตอนการสมัคร:</h3>
          <ol className="space-y-2 text-blue-800 text-sm">
            <li>1. กดปุ่ม "สมัครผ่าน LINE" ด้านล่าง</li>
            <li>2. อนุญาตให้ระบบเข้าถึงข้อมูล LINE ของคุณ</li>
            <li>3. กรอกข้อมูลเพิ่มเติม (ชื่อ-นามสกุล, เบอร์โทร, วันเกิด)</li>
            <li>4. {inviteLink?.requireApproval ? 'รอ HR อนุมัติ' : 'เข้าใช้งานได้ทันที!'}</li>
          </ol>
        </AlertDescription>
      </Alert>

      {/* Register Button */}
      <Button
        onClick={handleLineRegister}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
        size="lg"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white" className="mr-3">
          <path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.66 8.87 8.41 9.77.61.11.83-.26.83-.58 0-.29-.01-1.04-.01-2.04-3.34.73-4.04-1.61-4.04-1.61-.55-1.41-1.34-1.78-1.34-1.78-1.11-.76.08-.75.08-.75 1.22.09 1.86 1.25 1.86 1.25 1.08 1.87 2.86 1.33 3.54 1.02.11-.79.42-1.33.77-1.63-2.66-.3-5.46-1.35-5.46-6.01 0-1.33.47-2.41 1.25-3.25-.12-.3-.54-1.54.12-3.21 0 0 1.02-.33 3.35 1.25.97-.27 2.01-.4 3.05-.41 1.03 0 2.07.14 3.05.41 2.32-1.58 3.34-1.25 3.34-1.25.66 1.66.24 2.91.12 3.21.78.84 1.25 1.92 1.25 3.25 0 4.67-2.81 5.7-5.48 6 .43.37.81 1.1.81 2.22v3.29c0 .32.21.69.82.58C20.34 20.87 24 16.84 24 12c0-5.52-4.48-10-10-10z"/>
        </svg>
        สมัครผ่าน LINE
      </Button>

      {/* Privacy Note */}
      <p className="text-xs text-gray-500 text-center">
        ข้อมูลของคุณจะถูกเก็บอย่างปลอดภัยตามนโยบายความเป็นส่วนตัว
      </p>
    </div>
  )
}

export default function PreRegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8">
      <div className="relative w-full max-w-md">
        <Card className="backdrop-blur-xl bg-white/90 shadow-2xl">
          <CardContent className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center mb-4">
                <Image 
                  src="/logo.svg" 
                  alt="AMGO Logo" 
                  width={150} 
                  height={60}
                  className="h-12 w-auto"
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">สมัครพนักงานใหม่</h1>
              <p className="text-gray-600 mt-2 text-sm">ลงทะเบียนเข้าใช้งานระบบ HR</p>
            </div>

            {/* Form with Suspense */}
            <Suspense fallback={
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-500 border-r-transparent"></div>
              </div>
            }>
              <PreRegisterForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}