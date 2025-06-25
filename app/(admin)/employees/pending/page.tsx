// app/(admin)/employees/pending/page.tsx

'use client'

import { usePendingUsers } from '@/hooks/useUsers'
import { useUsers } from '@/hooks/useUsers'
import { User } from '@/types/user'
import { 
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Phone,
  MapPin,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'

export default function PendingUsersPage() {
  const { pendingUsers, loading, refetch } = usePendingUsers()
  const { approveUser, deactivateUser } = useUsers()

  const handleApprove = async (user: User) => {
    if (confirm(`อนุมัติการลงทะเบียนของ ${user.fullName}?`)) {
      const success = await approveUser(user.id!)
      if (success) {
        refetch()
      }
    }
  }

  const handleReject = async (user: User) => {
    if (confirm(`ปฏิเสธการลงทะเบียนของ ${user.fullName}?`)) {
      const success = await deactivateUser(user.id!)
      if (success) {
        refetch()
      }
    }
  }

  if (loading) {
    return <TechLoader />
  }

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
          <h1 className="text-2xl font-bold text-gray-900">รออนุมัติ</h1>
          <p className="text-gray-600 mt-1 text-base">
            พนักงานที่ลงทะเบียนและรอการอนุมัติ
          </p>
        </div>
      </div>

      {/* Pending Users */}
      {pendingUsers.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-base">ไม่มีผู้ใช้ที่รออนุมัติ</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pendingUsers.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              {/* User Info */}
              <div className="flex items-start gap-4 mb-4">
                {user.linePictureUrl ? (
                  <img
                    src={user.linePictureUrl}
                    alt={user.fullName}
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-500">
                      {user.fullName.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{user.fullName}</h3>
                  <p className="text-sm text-gray-500">@{user.lineDisplayName}</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                {user.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    {user.phone}
                  </div>
                )}
                
                {user.birthDate && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    วันเกิด: {new Date(user.birthDate).toLocaleDateString('th-TH')}
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  สมัครเมื่อ: {user.createdAt ? new Date(user.createdAt).toLocaleDateString('th-TH') : '-'}
                </div>
                
                {user.allowedLocationIds && user.allowedLocationIds.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    สาขา: {user.allowedLocationIds.length} แห่ง
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(user)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  อนุมัติ
                </button>
                <button
                  onClick={() => handleReject(user)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  ปฏิเสธ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}