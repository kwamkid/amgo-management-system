// app/(admin)/employees/invite-links/[id]/page.tsx

'use client'

import { use, useState } from 'react'
import { useInviteLink } from '@/hooks/useInviteLinks'
import { useUsers } from '@/hooks/useUsers'
import { useLocations } from '@/hooks/useLocations'
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
  User,
  Eye
} from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/useToast'
import { User as UserType } from '@/types/user'

export default function InviteLinkDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = use(params)
  const { inviteLink, stats, loading, error } = useInviteLink(id)
  const { users } = useUsers({ role: undefined })
  const { locations } = useLocations()
  const { showToast } = useToast()
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null)

  const copyInviteLink = () => {
    if (!inviteLink) return
    const url = `${window.location.origin}/register/invite?invite=${inviteLink.code}`
    navigator.clipboard.writeText(url)
    showToast('คัดลอกลิงก์แล้ว', 'success')
  }

  const getStatusBadge = () => {
    if (!inviteLink) return null
    const now = new Date()
    
    if (inviteLink.expiresAt && new Date(inviteLink.expiresAt) < now) {
      return (
        <Badge variant="secondary">
          <XCircle className="w-4 h-4 mr-1" />
          หมดอายุ
        </Badge>
      )
    }
    
    if (inviteLink.maxUses && inviteLink.usedCount >= inviteLink.maxUses) {
      return (
        <Badge variant="warning">
          <AlertCircle className="w-4 h-4 mr-1" />
          ใช้ครบแล้ว
        </Badge>
      )
    }
    
    if (!inviteLink.isActive) {
      return (
        <Badge variant="error">
          <XCircle className="w-4 h-4 mr-1" />
          ปิดใช้งาน
        </Badge>
      )
    }
    
    return (
      <Badge variant="success">
        <CheckCircle className="w-4 h-4 mr-1" />
        ใช้งานได้
      </Badge>
    )
  }

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      employee: { label: 'พนักงาน', variant: 'secondary' as const },
      manager: { label: 'ผู้จัดการ', variant: 'info' as const },
      hr: { label: 'ฝ่ายบุคคล', variant: 'default' as const },
      marketing: { label: 'Influ Marketing', variant: 'warning' as const },  // ✅ เพิ่ม
      driver: { label: 'พนักงานขับรถ', variant: 'info' as const }           // ✅ เพิ่ม
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

  if (error || !inviteLink) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="mb-4 text-base">
              {error || 'ไม่พบข้อมูล Invite Link'}
            </p>
            <Button
              asChild
              variant="outline"
              className="bg-red-50 hover:bg-red-100 text-red-700"
            >
              <Link href="/employees/invite-links">
                <ArrowLeft className="w-4 h-4 mr-2" />
                กลับไปหน้ารายการ
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
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
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="hover:bg-gray-100"
          >
            <Link href="/employees/invite-links">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Invite Link: {inviteLink.code}
            </h1>
            <p className="text-gray-600 mt-1 text-base">
              สร้างโดย {inviteLink.createdByName} เมื่อ {new Date(inviteLink.createdAt!).toLocaleDateString('th-TH')}
            </p>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ใช้ไปแล้ว</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inviteLink.usedCount} / {inviteLink.maxUses || '∞'}
                </p>
              </div>
              <LinkIcon className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">พนักงานทั้งหมด</p>
                <p className="text-2xl font-bold text-blue-900">{linkedUsers.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-gradient-to-br from-teal-50 to-emerald-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-teal-700">Active</p>
                <p className="text-2xl font-bold text-teal-900">
                  {linkedUsers.filter(u => u.isActive).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-teal-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-700">รออนุมัติ</p>
                <p className="text-2xl font-bold text-amber-900">
                  {linkedUsers.filter(u => u.needsApproval).length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Link Details */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">รายละเอียด</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">URL สำหรับแชร์</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm break-all">
                    {window.location.origin}/register/invite?invite={inviteLink.code}
                  </code>
                  <Button
                    onClick={copyInviteLink}
                    variant="ghost"
                    size="icon"
                  >
                    <Copy className="w-4 h-4 text-gray-600" />
                  </Button>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">หมายเหตุ</p>
                <p className="mt-1 text-base">{inviteLink.note || '-'}</p>
              </div>
              
              {inviteLink.expiresAt && (
                <div>
                  <p className="text-sm text-gray-600">วันหมดอายุ</p>
                  <p className="mt-1 flex items-center gap-2 text-base">
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
                    {getRoleBadge(inviteLink.defaultRole)}
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
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">พนักงานที่ใช้ลิงก์นี้</CardTitle>
        </CardHeader>
        
        {linkedUsers.length === 0 ? (
          <CardContent className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-base">ยังไม่มีพนักงานใช้ลิงก์นี้</p>
          </CardContent>
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
                        <Badge variant="success">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : user.needsApproval ? (
                        <Badge variant="warning">
                          <Clock className="w-3 h-3 mr-1" />
                          รออนุมัติ
                        </Badge>
                      ) : (
                        <Badge variant="error">
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </td>
                    
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('th-TH') : '-'}
                      </p>
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <Button
                        asChild
                        variant="link"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Link href={`/employees/${user.id}/edit`}>
                          ดูรายละเอียด
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
            <CardHeader>
              <CardTitle>รายละเอียดผู้สมัคร</CardTitle>
            </CardHeader>
            <CardContent>
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
                      <User className="w-10 h-10 text-gray-500" />
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
                    <p className="font-medium text-base">{selectedUser.phone || '-'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">วันเกิด</p>
                    <p className="font-medium text-base">
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
                    <p className="font-medium text-base">{getLocationNames(selectedUser.allowedLocationIds)}</p>
                  </div>
                  
                  {selectedUser.inviteLinkCode && (
                    <div>
                      <p className="text-sm text-gray-500">Invite Link</p>
                      <Badge variant="secondary">{selectedUser.inviteLinkCode}</Badge>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-sm text-gray-500">วันที่สมัคร</p>
                    <p className="font-medium text-base">
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

              <div className="mt-6">
                <Button
                  onClick={() => setSelectedUser(null)}
                  variant="outline"
                  className="w-full"
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