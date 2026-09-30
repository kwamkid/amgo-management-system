'use client'

import { usePendingUsers } from '@/hooks/useUsers'
import { PageHeader, StatusBadge } from '@/components/shared'
import { Pill, Card, CardContent, Button, IconButton, Modal, EmptyState, useConfirm } from '@/components/aoo'
import { useUsers } from '@/hooks/useUsers'
import { useLocations } from '@/hooks/useLocations'
import { User } from '@/types/user'
import {
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Phone,
  MapPin,
  Link as LinkIcon,
  Eye
} from 'lucide-react'
import TechLoader from '@/components/shared/TechLoader'
import { useState } from 'react'
import UserAvatar from '@/components/shared/UserAvatar'

export default function PendingUsersPage() {
  const { pendingUsers, loading, refetch } = usePendingUsers()
  const { approveUser, deactivateUser } = useUsers()
  const { locations } = useLocations()
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const { confirm, dialog: confirmDialog } = useConfirm()

  const handleApprove = async (user: User) => {
    const ok = await confirm({
      title: `อนุมัติการลงทะเบียนของ ${user.displayName || user.fullName}?`,
      confirmLabel: 'อนุมัติ',
    })
    if (ok) {
      const success = await approveUser(user.id!)
      if (success) {
        refetch()
      }
    }
  }

  const handleReject = async (user: User) => {
    const ok = await confirm({
      title: `ปฏิเสธการลงทะเบียนของ ${user.displayName || user.fullName}?`,
      description: 'การปฏิเสธจะทำให้พนักงานไม่สามารถเข้าใช้งานระบบได้',
      confirmLabel: 'ปฏิเสธ',
      tone: 'danger',
    })
    if (ok) {
      const success = await deactivateUser(user.id!)
      if (success) {
        refetch()
      }
    }
  }

  const getLocationNames = (locationIds?: string[]) => {
    if (!locationIds || locationIds.length === 0) return 'ไม่ระบุ'
    const locationNames = locationIds
      .map(id => locations.find(loc => loc.id === id)?.name)
      .filter(Boolean)
    return locationNames.join(', ')
  }

  if (loading) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="รออนุมัติ"
        description="พนักงานที่ลงทะเบียนและรอการอนุมัติ"
        icon={Clock}
        backHref="/employees"
        actions={
          pendingUsers.length > 0 ? (
            <Pill tone="warning">{pendingUsers.length} รายการ</Pill>
          ) : undefined
        }
      />

      {/* Pending Users */}
      {pendingUsers.length === 0 ? (
        <Card padding={0}>
          <EmptyState
            size="lg"
            icon={<Clock size={40} />}
            title="ไม่มีผู้ใช้ที่รออนุมัติ"
            body="พนักงานใหม่ที่สมัครจะแสดงที่นี่"
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pendingUsers.map((user) => (
            <Card padding={0} key={user.id} className="transition-all">
              {/* Card Header - User Info */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start gap-4">
                  <UserAvatar name={user.fullName} userId={user.id} size="xl" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">{user.displayName || user.fullName}</h3>
                    <p className="text-sm text-gray-500">@{user.lineDisplayName}</p>
                    <div className="mt-2">
                      <StatusBadge status={user.role} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Body - Details */}
              <CardContent className="p-6 space-y-3">
                {user.phone && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{user.phone}</span>
                  </div>
                )}
                
                {user.birthDate && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>เกิด: {new Date(user.birthDate).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>สมัคร: {user.createdAt ? new Date(user.createdAt).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '-'}</span>
                </div>
                
                <div className="flex items-start gap-3 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span className="flex-1">{getLocationNames(user.allowedLocationIds)}</span>
                </div>

                {user.inviteLinkCode && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <LinkIcon className="w-4 h-4 text-gray-400" />
                    <span>ใช้ลิงก์: <Pill tone="neutral">{user.inviteLinkCode}</Pill></span>
                  </div>
                )}

                {user.allowCheckInOutsideLocation && (
                  <div className="flex items-center gap-3 text-sm">
                    <Pill tone="success">อนุญาตเช็คอินนอกสถานที่</Pill>
                  </div>
                )}
              </CardContent>

              {/* Card Footer - Actions */}
              <div className="p-6 pt-0 flex gap-2">
                <Button onClick={() => handleApprove(user)} className="flex-1">
                  <CheckCircle className="w-4 h-4" />
                  อนุมัติ
                </Button>
                <Button onClick={() => handleReject(user)} variant="secondary" className="flex-1">
                  <XCircle className="w-4 h-4" />
                  ปฏิเสธ
                </Button>
                <IconButton icon={Eye} title="ดูรายละเอียด" tone="sunken" size={40} onClick={() => setSelectedUser(user)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* User Detail Modal */}
      <Modal
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="รายละเอียดผู้สมัคร"
        maxWidth={448}
        footer={
          <>
            <Button
              onClick={() => {
                if (selectedUser) handleApprove(selectedUser)
                setSelectedUser(null)
              }}
              className="flex-1"
            >
              อนุมัติ
            </Button>
            <Button onClick={() => setSelectedUser(null)} variant="secondary" className="flex-1">
              ปิด
            </Button>
          </>
        }
      >
        {selectedUser && (
          <>
          {/* User Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <UserAvatar name={selectedUser.fullName} userId={selectedUser.id} size="xl" />
              <div>
                <h4 className="font-semibold text-lg">{selectedUser.displayName || selectedUser.fullName}</h4>
                <p className="text-gray-500">@{selectedUser.lineDisplayName}</p>
                <div className="mt-2"><StatusBadge status={selectedUser.role} /></div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div>
                <p className="text-sm text-gray-500">เบอร์โทรศัพท์</p>
                <p className="font-medium">{selectedUser.phone || '-'}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">วันเกิด</p>
                <p className="font-medium">
                  {selectedUser.birthDate 
                    ? new Date(selectedUser.birthDate).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    : '-'
                  }
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">สาขาที่อนุญาต</p>
                <p className="font-medium">{getLocationNames(selectedUser.allowedLocationIds)}</p>
              </div>
              
              {selectedUser.inviteLinkCode && (
                <div>
                  <p className="text-sm text-gray-500">Invite Link</p>
                  <p className="font-medium">
                    <Pill tone="neutral">{selectedUser.inviteLinkCode}</Pill>
                  </p>
                </div>
              )}
              
              <div>
                <p className="text-sm text-gray-500">วันที่สมัคร</p>
                <p className="font-medium">
                  {selectedUser.createdAt 
                    ? new Date(selectedUser.createdAt).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '-'
                  }
                </p>
              </div>
            </div>
          </div>
          </>
        )}
      </Modal>

      {confirmDialog}
    </div>
  )
}