'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, Button, ActionMenu, IconButton, Modal, EmptyState, useConfirm, type ActionMenuItem } from '@/components/aoo'
import { PageHeader, StatCard, StatusBadge, DataTable, InfoPanel, type Column } from '@/components/shared'
import { useInviteLinks } from '@/hooks/useInviteLinks'
import { InviteLink } from '@/types/invite'
import {
  Link as LinkIcon,
  Copy,
  Trash2,
  Users,
  Clock,
  CheckCircle,
  QrCode,
} from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'
import TableFooter from '@/components/shared/TableFooter'
import { useRouter } from 'next/navigation'

/** สถานะลิงก์ — ลำดับเดิม: หมดอายุ → ใช้ครบ → ปิดใช้งาน → ใช้งานได้ */
function inviteStatus(link: InviteLink): 'expired' | 'used_up' | 'disabled' | 'active' {
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return 'expired'
  if (link.maxUses && link.usedCount >= link.maxUses) return 'used_up'
  if (!link.isActive) return 'disabled'
  return 'active'
}

export default function InviteLinksPage() {
  const router = useRouter()
  const { inviteLinks, loading, copyInviteLink, deleteInviteLink } = useInviteLinks()
  const [showQR, setShowQR] = useState<string | null>(null)
  const { confirm, dialog: confirmDialog } = useConfirm()

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Pagination calculations
  const totalPages = Math.ceil(inviteLinks.length / itemsPerPage)
  const paginatedLinks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return inviteLinks.slice(start, end)
  }, [inviteLinks, currentPage, itemsPerPage])

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleDelete = async (link: InviteLink) => {
    const ok = await confirm({
      title: `ต้องการปิดใช้งานลิงก์ ${link.code} ใช่หรือไม่?`,
      confirmLabel: 'ปิดใช้งาน',
      tone: 'danger',
    })
    if (ok) {
      await deleteInviteLink(link.id!)
    }
  }

  const menuItems = (link: InviteLink): ActionMenuItem[] => [
    {
      label: 'ดูผู้ใช้งาน', icon: 'Users', onSelect: () => router.push(`/employees/invite-links/${link.id}`)
    },
    {
      label: 'แก้ไข', icon: 'Edit', onSelect: () => router.push(`/employees/invite-links/${link.id}/edit`)
    },
    { kind: 'divider' },
    {
      label: 'QR Code', icon: 'QrCode',
      onSelect: () => setShowQR(link.code)
    },
    { kind: 'divider' },
    {
      label: (
        <span className="flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          ปิดใช้งาน
        </span>
      ),
      onSelect: () => handleDelete(link), tone: 'danger',
      disabled: !link.isActive
    }
  ]

  const columns: Column<InviteLink>[] = [
    {
      key: 'code',
      header: 'รหัสลิงก์',
      mobilePrimary: true,
      cell: (link) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
              {link.code}
            </code>
            <IconButton icon={Copy} title="คัดลอกลิงก์" size={28} onClick={() => copyInviteLink(link.code)} />
          </div>
          {link.note && (
            <p className="text-xs text-gray-500">{link.note}</p>
          )}
        </div>
      ),
    },
    {
      key: 'settings',
      header: 'ตั้งค่า',
      cell: (link) => (
        <div className="space-y-1">
          <StatusBadge status={link.defaultRole} />
          <div className="text-xs text-gray-500">
            {link.requireApproval ? 'ต้องอนุมัติ' : 'ใช้งานได้ทันที'}
          </div>
          {link.defaultLocationIds && link.defaultLocationIds.length > 0 && (
            <div className="text-xs text-gray-500">
              {link.defaultLocationIds.length} สาขา
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'usage',
      header: 'การใช้งาน',
      cell: (link) => (
        <div className="space-y-1">
          <div className="text-sm">
            ใช้แล้ว {link.usedCount} / {link.maxUses || '∞'}
          </div>
          {link.expiresAt && (
            <div className="text-xs text-gray-500">
              หมดอายุ {formatDate(link.expiresAt)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'สถานะ',
      cell: (link) => <StatusBadge status={inviteStatus(link)} kind="invite" />,
    },
    {
      key: 'createdBy',
      header: 'สร้างโดย',
      cell: (link) => (
        <div className="text-sm">
          <p className="text-gray-900">{link.createdByName || '-'}</p>
          <p className="text-xs text-gray-500">{formatDate(link.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      mobileFooterAction: true,
      cell: (link) => <ActionMenu items={menuItems(link)} />,
    },
  ]

  if (loading) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="จัดการ Invite Links"
        description="สร้างลิงก์สำหรับเชิญพนักงานใหม่เข้าระบบ"
        icon={LinkIcon}
        backHref="/employees"
        actions={
          <Link href="/employees/invite-links/create">
            <Button size="sm" icon="Plus">
              สร้างลิงก์ใหม่
            </Button>
          </Link>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="ลิงก์ทั้งหมด" value={inviteLinks.length} icon={LinkIcon} tone="sky" />
        <StatCard
          label="ใช้งานได้"
          value={inviteLinks.filter(l => l.isActive && (!l.expiresAt || new Date(l.expiresAt) > new Date())).length}
          icon={CheckCircle}
          tone="success"
        />
        <StatCard
          label="ใช้ไปแล้ว"
          value={inviteLinks.reduce((sum, link) => sum + link.usedCount, 0)}
          icon={Users}
          tone="grape"
        />
        <StatCard
          label="หมดอายุ"
          value={inviteLinks.filter(l => l.expiresAt && new Date(l.expiresAt) < new Date()).length}
          icon={Clock}
          tone="danger"
        />
      </div>

      {/* Links List */}
      {inviteLinks.length === 0 ? (
        <Card padding={0}>
          <EmptyState
            icon={<LinkIcon size={40} />}
            title="ยังไม่มีลิงก์"
            action={
              <Link href="/employees/invite-links/create">
                <Button variant="ghost" icon="Plus">สร้างลิงก์แรก</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* Mobile: Card View */}
          <div className="md:hidden space-y-3">
            {paginatedLinks.map((link) => (
              <Card padding={0} key={link.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* Link Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded truncate">
                          {link.code}
                        </code>
                        <IconButton icon={Copy} title="คัดลอกลิงก์" size={28} onClick={() => copyInviteLink(link.code)} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={inviteStatus(link)} kind="invite" />
                        <StatusBadge status={link.defaultRole} />
                      </div>
                      {link.note && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{link.note}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <ActionMenu items={menuItems(link)} />
                  </div>

                  {/* Details */}
                  <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">การใช้งาน</p>
                      <p className="font-medium">{link.usedCount} / {link.maxUses || '∞'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">หมดอายุ</p>
                      <p className="font-medium">{link.expiresAt ? formatDate(link.expiresAt) : 'ไม่มี'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">สร้างโดย</p>
                      <p className="font-medium truncate">{link.createdByName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">อนุมัติ</p>
                      <p className="font-medium">{link.requireApproval ? 'ต้องอนุมัติ' : 'ทันที'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: Table View */}
          <div className="hidden md:block">
            <DataTable columns={columns} rows={paginatedLinks} rowKey={(l) => l.id!} />
          </div>

          {/* Pagination */}
          {inviteLinks.length > 0 && (
            <div className="mt-4">
              <TableFooter page={currentPage} pageSize={itemsPerPage} total={inviteLinks.length} onPageChange={setCurrentPage} onPageSizeChange={setItemsPerPage} />
            </div>
          )}
        </>
      )}

      {/* QR Code Modal */}
      <Modal open={!!showQR} onClose={() => setShowQR(null)} title="QR Code" maxWidth={384}
        footer={
          <Button onClick={() => setShowQR(null)} variant="secondary" className="w-full">
            ปิด
          </Button>
        }
      >
        <InfoPanel className="aspect-square flex items-center justify-center">
          <QrCode className="w-32 h-32 text-gray-400" />
        </InfoPanel>
        <p className="text-center mt-4 text-sm text-gray-600">
          QR Code สำหรับ: {showQR}
        </p>
      </Modal>

      {confirmDialog}
    </div>
  )
}