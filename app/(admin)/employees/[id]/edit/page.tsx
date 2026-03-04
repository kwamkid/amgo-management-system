'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { User, UpdateUserData } from '@/types/user'
import { updateUser } from '@/lib/services/userService'
import UserEditForm from '@/components/users/UserEditForm'
import UserAvatar from '@/components/shared/UserAvatar'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { auth } from '@/lib/firebase/client'

export default function EditUserPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const router = useRouter()
  const { id } = use(params)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncingPhoto, setSyncingPhoto] = useState(false)
  const { showToast } = useToast()
  const { userData: currentUser } = useAuth()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const docRef = doc(db, 'users', id)
        const docSnap = await getDoc(docRef)
        
        if (docSnap.exists()) {
          setUser({
            id: docSnap.id,
            ...docSnap.data(),
            createdAt: docSnap.data().createdAt?.toDate(),
            updatedAt: docSnap.data().updatedAt?.toDate(),
            approvedAt: docSnap.data().approvedAt?.toDate(),
            lastLoginAt: docSnap.data().lastLoginAt?.toDate()
          } as User)
        } else {
          setError('ไม่พบข้อมูลพนักงาน')
        }
      } catch (err) {
        console.error('Error fetching user:', err)
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [id])

  const handleSubmit = async (data: UpdateUserData): Promise<boolean> => {
    try {
      await updateUser(id, data)
      showToast('บันทึกข้อมูลสำเร็จ', 'success')
      router.push('/employees')
      return true
    } catch (err) {
      console.error('Error updating user:', err)
      showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error')
      return false
    }
  }

  const handleCancel = () => {
    router.push('/employees')
  }

  const handleSyncPhoto = async () => {
    if (syncingPhoto) return
    setSyncingPhoto(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/users/sync-avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: id }),
      })
      if (res.ok) {
        setUser(prev => prev ? { ...prev, linePictureUrl: '' } : prev)
        showToast('รีเซ็ตรูปแล้ว รูปจะอัพเดทเมื่อพนักงานเข้าสู่ระบบครั้งต่อไป', 'success')
      } else {
        showToast('เกิดข้อผิดพลาด', 'error')
      }
    } catch {
      showToast('เกิดข้อผิดพลาด', 'error')
    } finally {
      setSyncingPhoto(false)
    }
  }

  if (loading) {
    return <TechLoader />
  }

  if (error || !user) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="error">
          <AlertDescription>
            <p className="mb-4 text-base">
              {error || 'ไม่พบข้อมูลพนักงาน'}
            </p>
            <Button
              variant="outline"
              onClick={() => router.push('/employees')}
              className="bg-red-50 hover:bg-red-100 text-red-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับไปหน้ารายการ
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/employees"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            แก้ไขข้อมูลพนักงาน
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="relative group">
              <UserAvatar
                name={user.fullName}
                imageUrl={user.linePictureUrl}
                size="sm"
                showSyncHint={['admin', 'hr', 'manager'].includes(currentUser?.role || '')}
                onClick={['admin', 'hr', 'manager'].includes(currentUser?.role || '') ? handleSyncPhoto : undefined}
              />
              {syncingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <span className="text-gray-600 text-base">{user.fullName}</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <UserEditForm
        user={user}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}