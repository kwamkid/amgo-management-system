'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared'
import { createClient } from '@/lib/supabase/client'
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
import { Alert, Pill, badgeTone, Card, CardContent, CardHeader, CardTitle, Button } from '@/components/aoo'
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

      // Postgres ไม่มีตาราง deleted_users แยกแล้ว — คนที่ถูกลบคือแถวที่มี deleted_at
      // (ของเดิมสำเนาไปไว้อีก collection ตอนลบถาวร ซึ่งทำให้ข้อมูลซ้ำสองที่
      //  และการลบถาวรตอนนี้ถูกห้ามอยู่แล้วถ้ายังมีประวัติเช็คอิน/ใบลาผูกอยู่)
      const { data, error } = await createClient()
        .from('users')
        .select('id, full_name, line_display_name, line_picture_url, role, phone, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })

      if (error) throw error

      const softDeleted = (data ?? []).map((u) => ({
        id: u.id,
        fullName: u.full_name,
        lineDisplayName: u.line_display_name,
        linePictureUrl: u.line_picture_url,
        role: u.role,
        phone: u.phone,
        deletedAt: u.deleted_at ? new Date(u.deleted_at) : undefined,
      })) as DeletedUser[]

      setDeletedUsers([])
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
    return <Pill tone={badgeTone(config.variant)}>{config.label}</Pill>
  }

  if (loading) return <TechLoader />

  return (
    <div className="space-y-6">
      <PageHeader
        title="พนักงานที่ถูกลบ"
        description="จัดการพนักงานที่ถูกลบหรือปิดการใช้งาน"
        icon={Trash2}
        backHref="/employees"
      />

      {/* Soft Deleted Users */}
      {softDeletedUsers.length > 0 && (
        <Card padding={0}>
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
                  
                  <Button onClick={() => handleRestore(user.id)}
 disabled={restoringId === user.id}
 variant="secondary">
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
        <Card padding={0}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              พนักงานที่ถูกลบถาวร (ไม่สามารถกู้คืนได้)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert tone="error" className="mb-4">
              <div>
                พนักงานเหล่านี้ถูกลบออกจากระบบแล้ว ข้อมูลที่แสดงเป็นเพียงประวัติเท่านั้น
              </div>
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
                  
                  <Pill tone="neutral" className="bg-red-100 text-red-700">
                    ลบถาวร
                  </Pill>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {softDeletedUsers.length === 0 && deletedUsers.length === 0 && (
        <Card padding={0}>
          <CardContent className="text-center py-12">
            <Trash2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">ไม่มีพนักงานที่ถูกลบ</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}