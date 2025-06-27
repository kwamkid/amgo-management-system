'use client'

import { useRouter } from 'next/navigation'
import { ShieldX, Home, ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function UnauthorizedPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <Card className="max-w-md w-full shadow-2xl">
        <CardContent className="p-8 text-center">
          {/* Icon */}
          <div className="mb-8 inline-flex">
            <div className="relative">
              <div className="w-32 h-32 bg-gradient-to-br from-red-100 to-rose-100 rounded-full flex items-center justify-center">
                <ShieldX className="w-16 h-16 text-red-500" />
              </div>
              {/* Decorative circles */}
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-400 rounded-full animate-bounce" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full animate-bounce animation-delay-200" />
            </div>
          </div>

          {/* Content */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">ไม่มีสิทธิ์เข้าถึง</h1>
          <p className="text-gray-600 mb-8">
            ขออภัย คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้
            <br />
            กรุณาติดต่อผู้ดูแลระบบหากคิดว่านี่คือข้อผิดพลาด
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="bg-white hover:bg-gray-50"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              ย้อนกลับ
            </Button>
            
            <Button
              onClick={() => router.push('/dashboard')}
              className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
            >
              <Home className="w-5 h-5 mr-2" />
              กลับหน้าหลัก
            </Button>
          </div>

          {/* Help text */}
          <Alert variant="default" className="mt-12 bg-gray-50">
            <AlertDescription className="text-sm text-gray-600">
              ต้องการความช่วยเหลือ? 
              <a href="mailto:hr@amgo.com" className="text-red-600 hover:text-red-700 font-medium ml-1">
                ติดต่อ HR
              </a>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}