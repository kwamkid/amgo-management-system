'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, setDoc, updateDoc, increment } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { validateInviteLink } from '@/lib/services/inviteService'
import { InviteLink } from '@/types/invite'
import Image from 'next/image'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
      const lineId = searchParams.get('lineId')
      const name = searchParams.get('name')
      const picture = searchParams.get('picture')
      const inviteCode = searchParams.get('invite')

      if (!lineId) {
        router.push('/login')
        return
      }

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
        fullName: name || ''
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
      const phoneRegex = /^0[0-9]{9}$/
      if (!phoneRegex.test(formData.phone)) {
        throw new Error('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (0xxxxxxxxx)')
      }

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

      await setDoc(doc(db, 'users', formData.lineId), userData)

      if (inviteLink?.id) {
        await updateDoc(doc(db, 'inviteLinks', inviteLink.id), {
          usedCount: increment(1)
        })
      }

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

  if (error && !formData.lineId) {
    return (
      <Alert variant="error">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <h3 className="text-lg font-semibold mb-2">ลิงก์ไม่ถูกต้อง</h3>
          <p className="mb-4">{error}</p>
          <Button
            onClick={() => router.push('/login')}
            variant="outline"
            className="bg-red-50 hover:bg-red-100 text-red-700"
          >
            กลับไปหน้า Login
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Invite Link Info */}
      {inviteLink && (
        <Alert variant="success" className="bg-gradient-to-r from-teal-50 to-emerald-50">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="text-teal-800 text-sm font-medium">
              ใช้ลิงก์: <code className="bg-teal-100 px-2 py-1 rounded">{inviteLink.code}</code>
            </p>
            {inviteLink.note && (
              <p className="text-teal-700 text-sm mt-1">{inviteLink.note}</p>
            )}
            <div className="mt-2 text-xs text-teal-700">
              <p>• สิทธิ์: {inviteLink.defaultRole === 'employee' ? 'พนักงาน' : 
                          inviteLink.defaultRole === 'manager' ? 'ผู้จัดการ' : 'ฝ่ายบุคคล'}</p>
              {inviteLink.defaultLocationIds && inviteLink.defaultLocationIds.length > 0 && (
                <p>• สาขา: {inviteLink.defaultLocationIds.length} แห่ง</p>
              )}
              <p>• {inviteLink.requireApproval ? 'ต้องรอ HR อนุมัติ' : 'ใช้งานได้ทันที'}</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Profile Picture */}
      {formData.linePictureUrl && (
        <div className="text-center">
          <div className="relative inline-block">
            <img
              src={formData.linePictureUrl}
              alt="Profile"
              className="w-24 h-24 rounded-full"
            />
            <div className="absolute inset-0 rounded-full ring-4 ring-red-400 ring-offset-2"></div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Full Name */}
      <div>
        <Label htmlFor="fullName">
          ชื่อ-นามสกุลเต็ม <span className="text-red-500">*</span>
        </Label>
        <Input
          id="fullName"
          type="text"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          placeholder="กรอกชื่อ-นามสกุลจริง"
          required
          className="mt-1"
        />
      </div>

      {/* Phone */}
      <div>
        <Label htmlFor="phone">
          เบอร์โทรศัพท์ <span className="text-red-500">*</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="0812345678"
          pattern="[0-9]{10}"
          maxLength={10}
          required
          className="mt-1"
        />
        <p className="text-xs text-gray-500 mt-1">กรอกเบอร์โทร 10 หลัก</p>
      </div>

      {/* Birth Date */}
      <div>
        <Label htmlFor="birthDate">
          วันเกิด <span className="text-red-500">*</span>
        </Label>
        <Input
          id="birthDate"
          type="date"
          value={formData.birthDate}
          onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
          max={new Date().toISOString().split('T')[0]}
          required
          className="mt-1"
        />
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
        size="lg"
      >
        {isSubmitting ? 'กำลังลงทะเบียน...' : 'ลงทะเบียน'}
      </Button>

      {/* Info Text */}
      <div className="text-center">
        {inviteLink && !inviteLink.requireApproval ? (
          <div className="inline-flex items-center gap-2 text-teal-600 text-sm">
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
              <h1 className="text-2xl font-bold text-gray-900">ลงทะเบียนพนักงานใหม่</h1>
              <p className="text-gray-600 mt-2 text-sm">กรอกข้อมูลเพื่อเข้าใช้งานระบบ</p>
            </div>

            {/* Form with Suspense */}
            <Suspense fallback={
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-500 border-r-transparent"></div>
              </div>
            }>
              <RegisterForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}