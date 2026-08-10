'use client'

import { usePendingUsers } from '@/hooks/useUsers'
import { PageHeader } from '@/components/shared'
import { Pill } from '@/components/aoo'
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
  ArrowLeft,
  User as UserIcon,
  Shield,
  Link as LinkIcon,
  AlertCircle,
  Eye
} from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import UserAvatar from '@/components/shared/UserAvatar'

export default function PendingUsersPage() {
  const { pendingUsers, loading, refetch } = usePendingUsers()
  const { approveUser, deactivateUser } = useUsers()
  const { locations } = useLocations()
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const handleApprove = async (user: User) => {
    if (confirm(`อนุมัติการลงทะเบียนของ ${user.fullName}?`)) {
      const success = await approveUser(user.id!)
      if (success) {
        refetch()
      }
    }
  }

  const handleReject = async (user: User) => {
    if (confirm(`ปฏิเสธการลงทะเบียนของ ${user.fullName}?\n\nการปฏิเสธจะทำให้พนักงานไม่สามารถเข้าใช้งานระบบได้`)) {
      const success = await deactivateUser(user.id!)
      if (success) {
        refetch()
      }
    }
  }

  const getRoleBadge = (role: string) => {
  const roleConfig = {
    admin: { label: 'ผู้ดูแลระบบ', variant: 'default' as const },
    hr: { label: 'ฝ่ายบุคคล', variant: 'info' as const },
    manager: { label: 'ผู้จัดการ', variant: 'success' as const },
    employee: { label: 'พนักงาน', variant: 'secondary' as const },
    driver: { label: 'พนักงานขับรถ', variant: 'info' as const }
  }
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.employee
    return <Badge variant={config.variant}>{config.label}</Badge>
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
        <Card>
          <CardContent className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
              <Clock className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">ไม่มีผู้ใช้ที่รออนุมัติ</h3>
            <p className="text-gray-500 text-base">พนักงานใหม่ที่สมัครจะแสดงที่นี่</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pendingUsers.map((user) => (
            <Card
              key={user.id}
              className="hover:shadow-lg transition-all"
            >
              {/* Card Header - User Info */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start gap-4">
                  <UserAvatar name={user.fullName} userId={user.id} size="xl" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">{user.fullName}</h3>
                    <p className="text-sm text-gray-500">@{user.lineDisplayName}</p>
                    <div className="mt-2">
                      {getRoleBadge(user.role)}
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
                    <span>ใช้ลิงก์: <Badge variant="secondary">{user.inviteLinkCode}</Badge></span>
                  </div>
                )}

                {user.allowCheckInOutsideLocation && (
                  <div className="flex items-center gap-3 text-sm text-teal-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>อนุญาตเช็คอินนอกสถานที่</span>
                  </div>
                )}
              </CardContent>

              {/* Card Footer - Actions */}
              <div className="p-6 pt-0 flex gap-2">
                <Button
                  onClick={() => handleApprove(user)}
                  className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  อนุมัติ
                </Button>
                <Button
                  onClick={() => handleReject(user)}
                  variant="outline"
                  className="flex-1 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  ปฏิเสธ
                </Button>
                <Button
                  onClick={() => setSelectedUser(user)}
                  variant="outline"
                  size="icon"
                  className="hover:bg-gray-50"
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedUser(null)}
        >
          <Card
            className="max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4">รายละเอียดผู้สมัคร</h3>
              
              {/* User Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <UserAvatar name={selectedUser.fullName} userId={selectedUser.id} size="xl" />
                  <div>
                    <h4 className="font-semibold text-lg">{selectedUser.fullName}</h4>
                    <p className="text-gray-500">@{selectedUser.lineDisplayName}</p>
                    <div className="mt-2">{getRoleBadge(selectedUser.role)}</div>
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
                        <Badge variant="secondary">{selectedUser.inviteLinkCode}</Badge>
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

              <div className="mt-6 flex gap-2">
                <Button
                  onClick={() => {
                    handleApprove(selectedUser)
                    setSelectedUser(null)
                  }}
                  className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700"
                >
                  อนุมัติ
                </Button>
                <Button
                  onClick={() => setSelectedUser(null)}
                  variant="outline"
                  className="flex-1"
                >
                  ปิด
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}