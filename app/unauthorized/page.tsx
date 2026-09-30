'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldX } from 'lucide-react'
import { getViewAs } from '@/lib/utils/viewAs'
import { Alert, Card, CardContent, Button } from '@/components/aoo'
export default function UnauthorizedPage() {
  const router = useRouter()

  // หน้านี้อยู่นอกเลย์เอาต์หลัก = ไม่มีเมนูให้เดินต่อ
  // แอดมินที่กำลังทดสอบมุมมองสิทธิ์อื่นจึงไม่ควรมาค้างที่นี่ — เด้งกลับหน้าหลัก
  // ไปเลย จะได้ไล่ดูเมนูของสิทธิ์นั้นต่อได้ (มุมมองที่เลือกไว้ยังคงอยู่)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (getViewAs() !== 'off') {
      router.replace('/dashboard')
      return
    }
    setReady(true)
  }, [router])

  if (!ready) return null

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center px-4">
      <Card padding={0} className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          {/* Icon */}
          <span
            data-tone="danger"
            className="mb-8 inline-flex w-32 h-32 items-center justify-center rounded-full bg-[var(--tone-soft)] text-[var(--tone-ink)]"
          >
            <ShieldX size={64} />
          </span>

          {/* Content */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">ไม่มีสิทธิ์เข้าถึง</h1>
          <p className="text-gray-600 mb-8">
            ขออภัย คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้
            <br />
            กรุณาติดต่อผู้ดูแลระบบหากคิดว่านี่คือข้อผิดพลาด
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => router.back()} variant="secondary" icon="ChevronLeft">
              ย้อนกลับ
            </Button>

            <Button onClick={() => router.push('/dashboard')} icon="LayoutDashboard">
              กลับหน้าหลัก
            </Button>
          </div>

          {/* Help text */}
          <Alert tone="info" className="mt-12 text-left">
            ต้องการความช่วยเหลือ?
            <a href="mailto:hr@amgo.com" className="ml-1 font-medium text-[var(--accent)] hover:underline">
              ติดต่อ HR
            </a>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
