'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, setDoc, updateDoc, increment } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { validateInviteLink } from '@/lib/services/inviteService'
import { InviteLink } from '@/types/invite'
import Image from 'next/image'
import { AlertCircle, CheckCircle } from 'lucide-react'

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
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initializeForm = async () => {
      // Get LINE data from URL params
      const lineId = searchParams.get('lineId')
      const name = searchParams.get('name')
      const picture = searchParams.get('picture')
      const inviteCode = searchParams.get('invite')

      if (!lineId) {
        router.push('/login')
        return
      }

      // Check if invite code is provided and valid
      if (inviteCode) {
        const validation = await validateInviteLink(inviteCode)
        if (!validation.valid) {
          setError(validation.error || 'ลิงก์ไม่ถูกต้อง')
          setLoading(false)
          return
        }
        setInviteLink(validation.link!)
      }

      setFormData(prev => ({
        ...prev,
        lineId: lineId,
        lineDisplayName: name || '',
        linePictureUrl: picture || '',
        fullName: name || '' // Pre-fill with LINE display name
      }))
      setLoading(false)
    }

    initializeForm()
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

      // Prepare user data
      const userData = {
        lineUserId: formData.lineId,
        lineDisplayName: formData.lineDisplayName,
        linePictureUrl: formData.linePictureUrl,
        fullName: formData.fullName,
        phone: formData.phone,
        birthDate: formData.birthDate,
        role: inviteLink?.defaultRole || 'employee',
        allowedLocationIds: inviteLink?.defaultLocationIds || [],
        allowCheckInOutsideLocation: inviteLink?.allowCheckInOutsideLocation || false,
        isActive: inviteLink ? !inviteLink.requireApproval : false,
        needsApproval: inviteLink?.requireApproval !== false,
        inviteLinkId: inviteLink?.id || null,
        inviteLinkCode: inviteLink?.code || null,
        registeredAt: new Date(),
        createdAt: new Date()
      }

      // Save to Firestore
      await setDoc(doc(db, 'users', formData.lineId), userData)

      // Update invite link usage if used
      if (inviteLink?.id) {
        await updateDoc(doc(db, 'inviteLinks', inviteLink.id), {
          usedCount: increment(1)
        })
      }

      // Redirect to success page
      router.push('/register/success')
    } catch (err) {
      const error = err as Error
      setError(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-500 border-r-transparent"></div>
      </div>
    )
  }

  // Show error if invite link is invalid
  if (error && !formData.lineId) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">ลิงก์ไม่ถูกต้อง</h3>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          กลับไปหน้า Login
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Invite Link Info */}
      {inviteLink && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-green-800 text-sm font-medium">
                ใช้ลิงก์: <code className="bg-green-100 px-2 py-1 rounded">{inviteLink.code}</code>
              </p>
              {inviteLink.note && (
                <p className="text-green-700 text-sm mt-1">{inviteLink.note}</p>
              )}
              <div className="mt-2 text-xs text-green-700">
                <p>• สิทธิ์: {inviteLink.defaultRole === 'employee' ? 'พนักงาน' : 
                            inviteLink.defaultRole === 'manager' ? 'ผู้จัดการ' : 'ฝ่ายบุคคล'}</p>
                {inviteLink.defaultLocationIds && inviteLink.defaultLocationIds.length > 0 && (
                  <p>• สาขา: {inviteLink.defaultLocationIds.length} แห่ง</p>
                )}
                <p>• {inviteLink.requireApproval ? 'ต้องรอ HR อนุมัติ' : 'ใช้งานได้ทันที'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Info Text */}
      <div className="text-center">
        {inviteLink && !inviteLink.requireApproval ? (
          <div className="inline-flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>คุณจะสามารถเข้าใช้งานได้ทันทีหลังลงทะเบียน</span>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            * ข้อมูลของคุณจะถูกส่งให้ HR ตรวจสอบก่อนเข้าใช้งาน
          </p>
        )}
      </div>
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