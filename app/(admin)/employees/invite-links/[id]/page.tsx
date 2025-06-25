// app/(admin)/settings/invite-links/[id]/page.tsx

'use client'

import { use } from 'react'
import { useInviteLink } from '@/hooks/useInviteLinks'
import { useUsers } from '@/hooks/useUsers'
import { 
  ArrowLeft, 
  Link as LinkIcon,
  Users,
  Copy,
  QrCode,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Calendar,
  User
} from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'

export default function InviteLinkDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = use(params)
  const { inviteLink, stats, loading, error } = useInviteLink(id)
  const { users } = useUsers({ role: undefined })

  const copyInviteLink = () => {
    if (!inviteLink) return
    const url = `${window.location.origin}/register/invite?invite=${inviteLink.code}`
    navigator.clipboard.writeText(url)
    // Show toast
  }

  const getStatusBadge = () => {
    if (!inviteLink) return null
    const now = new Date()
    
    if (inviteLink.expiresAt && new Date(inviteLink.expiresAt) < now) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-full">
          <XCircle className="w-4 h-4" />
          หมดอายุ
        </span>
      )
    }
    
    if (inviteLink.maxUses && inviteLink.usedCount >= inviteLink.maxUses) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full">
          <AlertCircle className="w-4 h-4" />
          ใช้ครบแล้ว
        </span>
      )
    }
    
    if (!inviteLink.isActive) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-600 rounded-full">
          <XCircle className="w-4 h-4" />
          ปิดใช้งาน
        </span>
      )
    }
    
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-600 rounded-full">
        <CheckCircle className="w-4 h-4" />
        ใช้งานได้
      </span>
    )
  }

  if (loading) {
    return <TechLoader />
  }

  if (error || !inviteLink) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 mb-4">
            {error || 'ไม่พบข้อมูล Invite Link'}
          </p>
          <Link
            href="/settings/invite-links"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับไปหน้ารายการ
          </Link>
        </div>
      </div>
    )
  }

  // Filter users who used this invite link
  const linkedUsers = users.filter(user => user.inviteLinkId === id)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/settings/invite-links"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Invite Link: {inviteLink.code}
            </h1>
            <p className="text-gray-600 mt-1">
              สร้างโดย {inviteLink.createdByName} เมื่อ {new Date(inviteLink.createdAt!).toLocaleDateString('th-TH')}
            </p>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ใช้ไปแล้ว</p>
              <p className="text-2xl font-bold text-gray-900">
                {inviteLink.usedCount} / {inviteLink.maxUses || '∞'}
              </p>
            </div>
            <LinkIcon className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">พนักงานทั้งหมด</p>
              <p className="text-2xl font-bold text-blue-600">{linkedUsers.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600">
                {linkedUsers.filter(u => u.isActive).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">รออนุมัติ</p>
              <p className="text-2xl font-bold text-yellow-600">
                {linkedUsers.filter(u => u.needsApproval).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Link Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">รายละเอียด</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">URL สำหรับแชร์</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm break-all">
                  {window.location.origin}/register/invite?invite={inviteLink.code}
                </code>
                <button
                  onClick={copyInviteLink}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                >
                  <Copy className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">หมายเหตุ</p>
              <p className="mt-1">{inviteLink.note || '-'}</p>
            </div>
            
            {inviteLink.expiresAt && (
              <div>
                <p className="text-sm text-gray-600">วันหมดอายุ</p>
                <p className="mt-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {new Date(inviteLink.expiresAt).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">ค่าเริ่มต้น</p>
              <div className="mt-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">สิทธิ์:</span>
                  <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                    {inviteLink.defaultRole === 'employee' ? 'พนักงาน' : 
                     inviteLink.defaultRole === 'manager' ? 'ผู้จัดการ' : 'ฝ่ายบุคคล'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">สาขา:</span>
                  <span className="text-sm">
                    {inviteLink.defaultLocationIds?.length || 0} แห่ง
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">การอนุมัติ:</span>
                  <span className="text-sm">
                    {inviteLink.requireApproval ? 'ต้องอนุมัติ' : 'ใช้งานได้ทันที'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">พนักงานที่ใช้ลิงก์นี้</h2>
        </div>
        
        {linkedUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">ยังไม่มีพนักงานใช้ลิงก์นี้</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">พนักงาน</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">ติดต่อ</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">สถานะ</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">วันที่สมัคร</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-gray-900">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {linkedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.linePictureUrl ? (
                          <img
                            src={user.linePictureUrl}
                            alt={user.fullName}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{user.fullName}</p>
                          <p className="text-sm text-gray-500">@{user.lineDisplayName}</p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">{user.phone || '-'}</p>
                    </td>
                    
                    <td className="px-6 py-4">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : user.needsApproval ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                          <Clock className="w-3 h-3" />
                          รออนุมัติ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('th-TH') : '-'}
                      </p>
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/employees/${user.id}/edit`}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        ดูรายละเอียด
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}