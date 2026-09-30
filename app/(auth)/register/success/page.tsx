'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { Alert, Card, CardContent, Button } from '@/components/aoo'
export default function RegisterSuccessPage() {
  const router = useRouter()

  useEffect(() => {
    // Auto redirect after 10 seconds
    const timer = setTimeout(() => {
      router.push('/login')
    }, 10000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] px-4">
      <Card padding={0} className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          {/* Logo */}
          <Image
            src="/amgo-logo.svg"
            alt="AMGO Logo"
            width={150}
            height={60}
            className="h-10 w-auto mx-auto mb-6"
          />

          {/* Success Icon */}
          <span
            data-tone="success"
            className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 bg-[var(--tone-soft)] text-[var(--tone-ink)]"
          >
            <Check size={40} strokeWidth={3} />
          </span>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">ลงทะเบียนสำเร็จ!</h1>

          <div className="space-y-4 text-gray-600">
            <p>ข้อมูลของคุณถูกส่งให้ HR แล้ว</p>
            <p className="text-sm">กรุณารอการอนุมัติภายใน 1-2 วันทำการ</p>

            <Alert tone="info" title="ขั้นตอนถัดไป:" className="mt-6 text-left">
              <ol className="space-y-1">
                <li>1. HR จะตรวจสอบข้อมูล</li>
                <li>2. คุณจะได้รับแจ้งผ่าน LINE</li>
                <li>3. เมื่ออนุมัติแล้วจะสามารถเข้าใช้งานได้</li>
              </ol>
            </Alert>
          </div>

          <div className="mt-8">
            <Button variant="ghost" onClick={() => router.push('/login')}>
              กลับหน้าเข้าสู่ระบบ
            </Button>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            จะกลับหน้า Login อัตโนมัติใน 10 วินาที...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
