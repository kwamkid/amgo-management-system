'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, UpdateUserData } from '@/types/user'
import { updateUser, getUser } from '@/lib/services/userService'
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
import { PageHeader } from '@/components/shared'

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
        const found = await getUser(id)
        if (found) setUser(found)
        else setError('ไม่พบข้อมูลพนักงาน')
      } catch (err) {
        console.error('โหลดข้อมูลพนักงานไม่สำเร็จ:', err)
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
      const res = await fetch('/api/users/sync-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      <div className="max-w-4xl">
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
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="แก้ไขข้อมูลพนักงาน"
        description={user.fullName}
        backHref="/employees"
        actions={
          // กดที่รูปเพื่อดึงรูปโปรไฟล์ล่าสุดจาก LINE มาใหม่
          <div className="relative">
            <UserAvatar
              name={user.fullName}
              imageUrl={user.linePictureUrl}
              size="lg"
              showSyncHint={['admin', 'hr', 'manager'].includes(currentUser?.role || '')}
              onClick={
                ['admin', 'hr', 'manager'].includes(currentUser?.role || '')
                  ? handleSyncPhoto
                  : undefined
              }
            />
            {syncingPhoto && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
          </div>
        }
      />

      {/* Form */}
      <UserEditForm
        user={user}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}