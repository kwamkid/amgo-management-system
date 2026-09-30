'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { InviteLink } from '@/types/invite'
import Image from 'next/image'
import { AlertCircle, CheckCircle, Users, Shield, MapPin } from 'lucide-react'
import { useLoading } from '@/lib/contexts/LoadingContext'
import { Alert, Pill, Card, CardContent, Button, EmptyState, Spinner } from '@/components/aoo'
import InfoPanel from '@/components/shared/InfoPanel'
async function validateInviteCode(code: string): Promise<{ valid: boolean; link?: InviteLink; error?: string }> {
  const res = await fetch(`/api/invite/validate?code=${encodeURIComponent(code)}`)
  return res.json()
}

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

      const validation = await validateInviteCode(inviteCode)
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
        <Spinner size="md" label="กำลังตรวจสอบ invite link..." />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        size="sm"
        icon={
          <span data-tone="danger" className="inline-flex text-[var(--tone)]">
            <AlertCircle size={48} />
          </span>
        }
        title="ลิงก์ไม่ถูกต้อง"
        body={error}
        action={
          <Button variant="soft" onClick={() => window.location.href = '/login'}>
            ไปหน้า Login
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Invite Link Info */}
      <InfoPanel tone="success">
          <div className="flex items-start gap-4">
            <span className="aoo-title-icon">
              <CheckCircle size={19} />
            </span>
            <div className="flex-1 text-[var(--tone-ink)]">
              <h3 className="text-lg font-semibold mb-1">
                ลิงก์ถูกต้อง!
              </h3>
              <p className="mb-3">
                รหัส: <Pill tone="success" className="ml-1">{inviteLink?.code}</Pill>
              </p>
              {inviteLink?.note && (
                <p className="text-sm mb-3 italic">"{inviteLink.note}"</p>
              )}
              
              {/* Show details */}
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>
                   สิทธิ์เริ่มต้น: <strong>
                    {inviteLink?.defaultRole === 'employee' ? 'พนักงาน' :
                    inviteLink?.defaultRole === 'manager' ? 'ผู้จัดการ' :
                    inviteLink?.defaultRole === 'hr' ? 'ฝ่ายบุคคล' :
                    inviteLink?.defaultRole === 'driver' ? 'พนักงานขับรถ' :
                    'ผู้ดูแลระบบ'}
                  </strong>
                  </span>
                </div>
                
                {inviteLink?.defaultLocationIds && inviteLink.defaultLocationIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>สาขาที่กำหนด: <strong>{inviteLink.defaultLocationIds.length} แห่ง</strong></span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
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
      </InfoPanel>

      {/* Registration Steps */}
      <Alert tone="info" title="ขั้นตอนการสมัคร:">
          <ol className="space-y-2">
            <li>1. กดปุ่ม "สมัครผ่าน LINE" ด้านล่าง</li>
            <li>2. อนุญาตให้ระบบเข้าถึงข้อมูล LINE ของคุณ</li>
            <li>3. กรอกข้อมูลเพิ่มเติม (ชื่อ-นามสกุล, เบอร์โทร, วันเกิด)</li>
            <li>4. {inviteLink?.requireApproval ? 'รอ HR อนุมัติ' : 'เข้าใช้งานได้ทันที!'}</li>
          </ol>
      </Alert>

      {/* Register Button */}
      <Button onClick={handleLineRegister} className="w-full" size="lg">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
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
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] px-4 py-8">
      <div className="relative w-full max-w-md">
        <Card padding={0}>
          <CardContent className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center mb-4">
                <Image 
                  src="/amgo-logo.svg" 
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
                <Spinner size="md" />
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