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
  CheckCircle,
  Clock,
  Calendar,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'
import { useToast } from '@/hooks/useToast'
import { User as UserType } from '@/types/user'
import { PageHeader, StatCard, StatusBadge, DataTable, type Column } from '@/components/shared'
import UserAvatar from '@/components/shared/UserAvatar'
import { InviteLink } from '@/types/invite'

import { Alert, Pill, Card, CardContent, CardHeader, CardTitle, Button, IconButton, Modal, EmptyState } from '@/components/aoo'

/** สถานะลิงก์ — ลำดับเดิม: หมดอายุ → ใช้ครบ → ปิดใช้งาน → ใช้งานได้ */
function inviteStatus(link: InviteLink): 'expired' | 'used_up' | 'disabled' | 'active' {
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return 'expired'
  if (link.maxUses && link.usedCount >= link.maxUses) return 'used_up'
  if (!link.isActive) return 'disabled'
  return 'active'
}

export default function InviteLinkDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = use(params)
  const { inviteLink, stats, loading, error } = useInviteLink(id)
  // หน้านี้เป็นบันทึกว่าใครสมัครผ่านลิงก์ — เอาทุกสถานะ แต่ต้องดึงครบทุกคน ไม่ใช่แค่หน้าแรก
  const { users } = useUsers({ pageSize: 500 })
  const { locations } = useLocations()
  const { showToast } = useToast()
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null)

  const copyInviteLink = () => {
    if (!inviteLink) return
    const url = `${window.location.origin}/register/invite?invite=${inviteLink.code}`
    navigator.clipboard.writeText(url)
    showToast('คัดลอกลิงก์แล้ว', 'success')
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
      <div className="max-w-4xl">
        <Alert tone="error">
          <div>
            <p className="mb-4 text-base">
              {error || 'ไม่พบข้อมูล Invite Link'}
            </p>
            <Link href="/employees/invite-links"><Button variant="soft">
                <ArrowLeft className="w-4 h-4" />
                กลับไปหน้ารายการ
              </Button></Link>
          </div>
        </Alert>
      </div>
    )
  }

  // Filter users who used this invite link
  const linkedUsers = users.filter(user => user.inviteLinkId === id)

  const userColumns: Column<UserType>[] = [
    {
      key: 'user',
      header: 'พนักงาน',
      mobilePrimary: true,
      cell: (user) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={user.fullName} userId={user.id} size="md" />
          <div>
            <p className="font-medium text-gray-900">{user.displayName || user.fullName}</p>
            <p className="text-sm text-gray-500">@{user.lineDisplayName}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'ติดต่อ',
      cell: (user) => <p className="text-sm text-gray-600">{user.phone || '-'}</p>,
    },
    {
      key: 'status',
      header: 'สถานะ',
      cell: (user) =>
        user.isActive ? (
          <StatusBadge status="active" label="Active" />
        ) : user.needsApproval ? (
          <StatusBadge status="pending" />
        ) : (
          <StatusBadge status="inactive" label="Inactive" />
        ),
    },
    {
      key: 'createdAt',
      header: 'วันที่สมัคร',
      cell: (user) => (
        <p className="text-sm text-gray-600">
          {user.createdAt ? new Date(user.createdAt).toLocaleDateString('th-TH') : '-'}
        </p>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      mobileFooterAction: true,
      cell: (user) => (
        <Link href={`/employees/${user.id}/edit`}>
          <Button variant="ghost" size="sm">ดูรายละเอียด</Button>
        </Link>
      ),
    },
  ]

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title={`Invite Link: ${inviteLink.code}`}
        description={`สร้างโดย ${inviteLink.createdByName} เมื่อ ${new Date(
          inviteLink.createdAt!
        ).toLocaleDateString('th-TH')}`}
        icon={LinkIcon}
        backHref="/employees/invite-links"
        actions={<StatusBadge status={inviteStatus(inviteLink)} kind="invite" />}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="ใช้ไปแล้ว"
          value={`${inviteLink.usedCount} / ${inviteLink.maxUses || '∞'}`}
          icon={LinkIcon}
          tone="plum"
        />
        <StatCard label="พนักงานทั้งหมด" value={linkedUsers.length} icon={Users} tone="sky" />
        <StatCard
          label="Active"
          value={linkedUsers.filter(u => u.isActive).length}
          icon={CheckCircle}
          tone="success"
        />
        <StatCard
          label="รออนุมัติ"
          value={linkedUsers.filter(u => u.needsApproval).length}
          icon={Clock}
          tone="warning"
        />
      </div>

      {/* Link Details */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={FileText} tone="sky">รายละเอียด</CardTitle>
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
                  <IconButton icon={Copy} title="คัดลอกลิงก์" onClick={copyInviteLink} />
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
                    <StatusBadge status={inviteLink.defaultRole} />
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
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={Users} tone="grape">พนักงานที่ใช้ลิงก์นี้</CardTitle>
        </CardHeader>
        
        {linkedUsers.length === 0 ? (
          <EmptyState icon={<Users size={40} />} title="ยังไม่มีพนักงานใช้ลิงก์นี้" />
        ) : (
          <CardContent>
            <DataTable columns={userColumns} rows={linkedUsers} rowKey={(u) => u.id!} />
          </CardContent>
        )}
      </Card>

      {/* User Detail Modal */}
      <Modal
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="รายละเอียดผู้สมัคร"
        maxWidth={448}
        footer={
          <Button onClick={() => setSelectedUser(null)} variant="secondary" className="w-full">
            ปิด
          </Button>
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
                  <Pill tone="neutral">{selectedUser.inviteLinkCode}</Pill>
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
          </>
        )}
      </Modal>
    </div>
  )
}