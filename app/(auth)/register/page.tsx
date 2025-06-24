'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import Image from 'next/image'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [formData, setFormData] = useState({
    lineId: '',
    lineDisplayName: '',
    linePictureUrl: '',
    fullName: '',
    phone: '',
    birthDate: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Get LINE data from URL params
    const lineId = searchParams.get('lineId')
    const name = searchParams.get('name')
    const picture = searchParams.get('picture')

    if (!lineId) {
      router.push('/login')
      return
    }

    setFormData(prev => ({
      ...prev,
      lineId: lineId,
      lineDisplayName: name || '',
      linePictureUrl: picture || '',
      fullName: name || '' // Pre-fill with LINE display name
    }))
  }, [searchParams, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      // Validate phone number
      const phoneRegex = /^0[0-9]{9}$/
      if (!phoneRegex.test(formData.phone)) {
        throw new Error('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (0xxxxxxxxx)')
      }

      // Save to Firestore
      await setDoc(doc(db, 'users', formData.lineId), {
        lineUserId: formData.lineId,
        lineDisplayName: formData.lineDisplayName,
        linePictureUrl: formData.linePictureUrl,
        fullName: formData.fullName,
        phone: formData.phone,
        birthDate: formData.birthDate,
        role: 'employee', // Default role
        permissionGroupId: null, // Will be assigned by admin
        isActive: false, // Require admin approval
        registeredAt: new Date(),
        createdAt: new Date()
      })

      // Redirect to success page
      router.push('/register/success')
    } catch (err) {
      const error = err as Error
      setError(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Profile Picture */}
      {formData.linePictureUrl && (
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={formData.linePictureUrl}
            alt="Profile"
            className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-gradient-to-r from-red-400 to-pink-400"
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Full Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ชื่อ-นามสกุลเต็ม <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          placeholder="กรอกชื่อ-นามสกุลจริง"
          required
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          เบอร์โทรศัพท์ <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          placeholder="0812345678"
          pattern="[0-9]{10}"
          maxLength={10}
          required
        />
        <p className="text-xs text-gray-500 mt-1">กรอกเบอร์โทร 10 หลัก</p>
      </div>

      {/* Birth Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          วันเกิด <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={formData.birthDate}
          onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          max={new Date().toISOString().split('T')[0]}
          required
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full relative group overflow-hidden rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 transition-all duration-300 group-hover:from-red-600 group-hover:to-pink-600" />
        <div className="relative px-6 py-4 font-semibold text-white">
          {isSubmitting ? 'กำลังลงทะเบียน...' : 'ลงทะเบียน'}
        </div>
      </button>

      <p className="text-xs text-gray-500 text-center">
        * ข้อมูลของคุณจะถูกส่งให้ HR ตรวจสอบก่อนเข้าใช้งาน
      </p>
    </form>
  )
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 px-4 py-8">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-gray-100/50 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
      
      <div className="relative w-full max-w-md">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8">
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
            <h1 className="text-2xl font-bold text-gray-800">ลงทะเบียนพนักงานใหม่</h1>
            <p className="text-gray-500 mt-2 text-sm">กรอกข้อมูลเพื่อเข้าใช้งานระบบ</p>
          </div>

          {/* Form with Suspense */}
          <Suspense fallback={
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-500 border-r-transparent"></div>
            </div>
          }>
            <RegisterForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}