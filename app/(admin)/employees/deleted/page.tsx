'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { restoreUser } from '@/lib/services/userService'
import { useToast } from '@/hooks/useToast'
import { 
  Trash2, 
  RefreshCw,
  Calendar,
  User as UserIcon,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface DeletedUser {
  id: string
  fullName: string
  lineDisplayName: string
  phone: string
  role: string
  deletedAt: Date
  deletedBy?: string
  deletedByName?: string
  isDeleted?: boolean
}

export default function DeletedUsersPage() {
  const [deletedUsers, setDeletedUsers] = useState<DeletedUser[]>([])
  const [softDeletedUsers, setSoftDeletedUsers] = useState<DeletedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    fetchDeletedUsers()
  }, [])

  const fetchDeletedUsers = async () => {
    try {
      setLoading(true)

      // 1. Fetch permanently deleted users from deleted_users collection
      const deletedQuery = query(
        collection(db, 'deleted_users'),
        orderBy('deletedAt', 'desc')
      )
      const deletedSnapshot = await getDocs(deletedQuery)
      const deleted = deletedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        deletedAt: doc.data().deletedAt?.toDate()
      })) as DeletedUser[]

      // 2. Fetch soft deleted users from users collection
      const usersQuery = query(
        collection(db, 'users'),
        orderBy('updatedAt', 'desc')
      )
      const usersSnapshot = await getDocs(usersQuery)
      const softDeleted = usersSnapshot.docs
        .filter(doc => doc.data().isDeleted === true)
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          deletedAt: doc.data().deletedAt?.toDate() || doc.data().updatedAt?.toDate()
        })) as DeletedUser[]

      setDeletedUsers(deleted)
      setSoftDeletedUsers(softDeleted)
    } catch (error) {
      console.error('Error fetching deleted users:', error)
      showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (userId: string) => {
    try {
      setRestoringId(userId)
      await restoreUser(userId)
      showToast('กู้คืนพนักงานสำเร็จ', 'success')
      fetchDeletedUsers() // Refresh list
    } catch (error) {
      console.error('Error restoring user:', error)
      showToast('เกิดข้อผิดพลาดในการกู้คืน', 'error')
    } finally {
      setRestoringId(null)
    }
  }

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      admin: { label: 'ผู้ดูแลระบบ', variant: 'default' as const },
      hr: { label: 'ฝ่ายบุคคล', variant: 'info' as const },
      manager: { label: 'ผู้จัดการ', variant: 'success' as const },
      employee: { label: 'พนักงาน', variant: 'secondary' as const }
    }
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.employee
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (loading) return <TechLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/employees"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">พนักงานที่ถูกลบ</h1>
          <p className="text-gray-600 mt-1">จัดการพนักงานที่ถูกลบหรือปิดการใช้งาน</p>
        </div>
      </div>

      {/* Soft Deleted Users */}
      {softDeletedUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-orange-600" />
              พนักงานที่ปิดการใช้งาน (สามารถกู้คืนได้)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {softDeletedUsers.map((user) => (
                <div 
                  key={user.id}
                  className="flex items-center justify-between p-4 bg-orange-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-200 rounded-full flex items-center justify-center">
                      <UserIcon className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.fullName || user.lineDisplayName}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span>{user.phone}</span>
                        {getRoleBadge(user.role)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        ปิดการใช้งานเมื่อ: {user.deletedAt?.toLocaleDateString('th-TH') || '-'}
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => handleRestore(user.id)}
                    disabled={restoringId === user.id}
                    variant="outline"
                    className="text-orange-600 hover:bg-orange-100"
                  >
                    {restoringId === user.id ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        กำลังกู้คืน...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        กู้คืน
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permanently Deleted Users */}
      {deletedUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              พนักงานที่ถูกลบถาวร (ไม่สามารถกู้คืนได้)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="error" className="mb-4">
              <AlertDescription>
                พนักงานเหล่านี้ถูกลบออกจากระบบแล้ว ข้อมูลที่แสดงเป็นเพียงประวัติเท่านั้น
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              {deletedUsers.map((user) => (
                <div 
                  key={user.id}
                  className="flex items-center justify-between p-4 bg-red-50 rounded-lg opacity-75"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-200 rounded-full flex items-center justify-center">
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 line-through">
                        {user.fullName || user.lineDisplayName}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span>{user.phone}</span>
                        {getRoleBadge(user.role)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 space-y-1">
                        <p>ลบเมื่อ: {user.deletedAt?.toLocaleDateString('th-TH') || '-'}</p>
                        {user.deletedByName && (
                          <p>ลบโดย: {user.deletedByName}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Badge variant="secondary" className="bg-red-100 text-red-700">
                    ลบถาวร
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {softDeletedUsers.length === 0 && deletedUsers.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Trash2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">ไม่มีพนักงานที่ถูกลบ</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}