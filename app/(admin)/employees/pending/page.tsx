// app/(admin)/employees/pending/page.tsx

'use client'

import { usePendingUsers } from '@/hooks/useUsers'
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
      admin: { label: 'ผู้ดูแลระบบ', color: 'bg-purple-100 text-purple-700' },
      hr: { label: 'ฝ่ายบุคคล', color: 'bg-blue-100 text-blue-700' },
      manager: { label: 'ผู้จัดการ', color: 'bg-green-100 text-green-700' },
      employee: { label: 'พนักงาน', color: 'bg-gray-100 text-gray-700' }
    }
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.employee
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${config.color}`}>
        {config.label}
      </span>
    )
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/employees"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">รออนุมัติ</h1>
            <p className="text-gray-600 mt-1 text-base">
              พนักงานที่ลงทะเบียนและรอการอนุมัติ
            </p>
          </div>
        </div>
        
        {pendingUsers.length > 0 && (
          <div className="bg-yellow-50 text-yellow-800 px-4 py-2 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{pendingUsers.length} รายการ</span>
          </div>
        )}
      </div>

      {/* Pending Users */}
      {pendingUsers.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
            <Clock className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">ไม่มีผู้ใช้ที่รออนุมัติ</h3>
          <p className="text-gray-500 text-base">พนักงานใหม่ที่สมัครจะแสดงที่นี่</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pendingUsers.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-all"
            >
              {/* Card Header - User Info */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start gap-4">
                  {user.linePictureUrl ? (
                    <img
                      src={user.linePictureUrl}
                      alt={user.fullName}
                      className="w-16 h-16 rounded-full border-2 border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                      <UserIcon className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
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
              <div className="p-6 space-y-3">
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
                    <span>ใช้ลิงก์: <code className="bg-gray-100 px-2 py-0.5 rounded">{user.inviteLinkCode}</code></span>
                  </div>
                )}

                {user.allowCheckInOutsideLocation && (
                  <div className="flex items-center gap-3 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>อนุญาตเช็คอินนอกสถานที่</span>
                  </div>
                )}
              </div>

              {/* Card Footer - Actions */}
              <div className="p-6 pt-0 flex gap-2">
                <button
                  onClick={() => handleApprove(user)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <CheckCircle className="w-4 h-4" />
                  อนุมัติ
                </button>
                <button
                  onClick={() => handleReject(user)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium"
                >
                  <XCircle className="w-4 h-4" />
                  ปฏิเสธ
                </button>
                <button
                  onClick={() => setSelectedUser(user)}
                  className="inline-flex items-center justify-center p-2.5 bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-4">รายละเอียดผู้สมัคร</h3>
            
            {/* User Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {selectedUser.linePictureUrl ? (
                  <img
                    src={selectedUser.linePictureUrl}
                    alt={selectedUser.fullName}
                    className="w-20 h-20 rounded-full"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
                    <UserIcon className="w-10 h-10 text-gray-500" />
                  </div>
                )}
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
                      <code className="bg-gray-100 px-2 py-1 rounded">{selectedUser.inviteLinkCode}</code>
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
              <button
                onClick={() => {
                  handleApprove(selectedUser)
                  setSelectedUser(null)
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                อนุมัติ
              </button>
              <button
                onClick={() => setSelectedUser(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}