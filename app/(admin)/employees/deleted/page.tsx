'use client'

import { useState, useEffect } from 'react'
import { PageHeader, StatusBadge, ListRow, ListRows, UserAvatar } from '@/components/shared'
import { createClient } from '@/lib/supabase/client'
import { restoreUser } from '@/lib/services/userService'
import { useToast } from '@/hooks/useToast'
import { Trash2, RefreshCw } from 'lucide-react'
import TechLoader from '@/components/shared/TechLoader'
import { Alert, Pill, Card, CardContent, CardHeader, CardTitle, Button, EmptyState } from '@/components/aoo'

interface DeletedUser {
  id: string
  fullName: string
  lineDisplayName: string
  linePictureUrl?: string | null
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
            <CardTitle icon={RefreshCw} tone="warning">
              พนักงานที่ปิดการใช้งาน (สามารถกู้คืนได้)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ListRows variant="boxed">
              {softDeletedUsers.map((user) => (
                <ListRow
                  key={user.id}
                  leading={<UserAvatar name={user.fullName || user.lineDisplayName} imageUrl={user.linePictureUrl} />}
                  title={user.fullName || user.lineDisplayName}
                  meta={
                    <>
                      <span className="flex items-center gap-3">
                        <span>{user.phone}</span>
                        <StatusBadge status={user.role} />
                      </span>
                      <span className="mt-1 block text-xs">
                        ปิดการใช้งานเมื่อ: {user.deletedAt?.toLocaleDateString('th-TH') || '-'}
                      </span>
                    </>
                  }
                  trailing={
                    <Button
                      onClick={() => handleRestore(user.id)}
                      loading={restoringId === user.id}
                      icon={restoringId === user.id ? undefined : 'RefreshCw'}
                      variant="secondary"
                    >
                      {restoringId === user.id ? 'กำลังกู้คืน...' : 'กู้คืน'}
                    </Button>
                  }
                />
              ))}
            </ListRows>
          </CardContent>
        </Card>
      )}

      {/* Permanently Deleted Users */}
      {deletedUsers.length > 0 && (
        <Card padding={0}>
          <CardHeader>
            <CardTitle icon={Trash2} tone="danger">
              พนักงานที่ถูกลบถาวร (ไม่สามารถกู้คืนได้)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert tone="error" className="mb-4">
              พนักงานเหล่านี้ถูกลบออกจากระบบแล้ว ข้อมูลที่แสดงเป็นเพียงประวัติเท่านั้น
            </Alert>

            <ListRows variant="boxed" className="opacity-75">
              {deletedUsers.map((user) => (
                <ListRow
                  key={user.id}
                  leading={<UserAvatar name={user.fullName || user.lineDisplayName} imageUrl={user.linePictureUrl} />}
                  title={<span className="line-through">{user.fullName || user.lineDisplayName}</span>}
                  meta={
                    <>
                      <span className="flex items-center gap-3">
                        <span>{user.phone}</span>
                        <StatusBadge status={user.role} />
                      </span>
                      <span className="mt-1 block text-xs">ลบเมื่อ: {user.deletedAt?.toLocaleDateString('th-TH') || '-'}</span>
                      {user.deletedByName && (
                        <span className="block text-xs">ลบโดย: {user.deletedByName}</span>
                      )}
                    </>
                  }
                  trailing={<Pill tone="danger">ลบถาวร</Pill>}
                />
              ))}
            </ListRows>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {softDeletedUsers.length === 0 && deletedUsers.length === 0 && (
        <Card padding={0}>
          <EmptyState icon={<Trash2 size={40} />} title="ไม่มีพนักงานที่ถูกลบ" />
        </Card>
      )}
    </div>
  )
}