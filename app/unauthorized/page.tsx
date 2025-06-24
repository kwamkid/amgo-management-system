// app/unauthorized/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { ShieldX, Home, ArrowLeft } from 'lucide-react'

export default function UnauthorizedPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-8 inline-flex">
          <div className="relative">
            <div className="w-32 h-32 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center">
              <ShieldX className="w-16 h-16 text-red-500" />
            </div>
            {/* Decorative circles */}
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full animate-bounce" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full animate-bounce animation-delay-200" />
          </div>
        </div>

        {/* Content */}
        <h1 className="text-3xl font-bold text-gray-800 mb-4">ไม่มีสิทธิ์เข้าถึง</h1>
        <p className="text-gray-600 mb-8">
          ขออภัย คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้
          <br />
          กรุณาติดต่อผู้ดูแลระบบหากคิดว่านี่คือข้อผิดพลาด
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>ย้อนกลับ</span>
          </button>
          
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-medium rounded-xl hover:from-red-600 hover:to-pink-600 transition-all transform hover:scale-105"
          >
            <Home className="w-5 h-5" />
            <span>กลับหน้าหลัก</span>
          </button>
        </div>

        {/* Help text */}
        <div className="mt-12 p-4 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-500">
            ต้องการความช่วยเหลือ? 
            <a href="mailto:hr@amgo.com" className="text-red-500 hover:text-red-600 font-medium ml-1">
              ติดต่อ HR
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}