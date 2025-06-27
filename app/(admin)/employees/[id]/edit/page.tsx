'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { User, UpdateUserData } from '@/types/user'
import { updateUser } from '@/lib/services/userService'
import UserEditForm from '@/components/users/UserEditForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'
import { useToast } from '@/hooks/useToast'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

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
  const { showToast } = useToast()

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
          <p className="text-gray-600 mt-1 text-base flex items-center gap-2">
            {user.linePictureUrl && (
              <img
                src={user.linePictureUrl}
                alt={user.fullName}
                className="w-6 h-6 rounded-full"
              />
            )}
            {user.fullName}
          </p>
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