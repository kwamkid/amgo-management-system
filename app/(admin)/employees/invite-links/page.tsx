'use client'

import { useState, useMemo } from 'react'
import { useInviteLinks } from '@/hooks/useInviteLinks'
import { InviteLink } from '@/types/invite'
import { 
  Link as LinkIcon,
  Plus,
  Copy,
  Edit,
  Trash2,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  QrCode,
  MoreVertical
} from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'
import DropdownMenu from '@/components/ui/DropdownMenu'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Pagination } from '@/components/ui/pagination'

export default function InviteLinksPage() {
  const { inviteLinks, loading, copyInviteLink, deleteInviteLink } = useInviteLinks()
  const [showQR, setShowQR] = useState<string | null>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Pagination calculations
  const totalPages = Math.ceil(inviteLinks.length / itemsPerPage)
  const paginatedLinks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return inviteLinks.slice(start, end)
  }, [inviteLinks, currentPage, itemsPerPage])

  const getStatusBadge = (link: InviteLink) => {
    const now = new Date()
    
    if (link.expiresAt && new Date(link.expiresAt) < now) {
      return <Badge variant="secondary">หมดอายุ</Badge>
    }
    
    if (link.maxUses && link.usedCount >= link.maxUses) {
      return <Badge variant="warning">ใช้ครบแล้ว</Badge>
    }
    
    if (!link.isActive) {
      return <Badge variant="error">ปิดใช้งาน</Badge>
    }
    
    return <Badge variant="success">ใช้งานได้</Badge>
  }

  const getRoleBadge = (role: string) => {
  const roleConfig = {
    employee: { label: 'พนักงาน', variant: 'secondary' as const },
    manager: { label: 'ผู้จัดการ', variant: 'info' as const },
    hr: { label: 'ฝ่ายบุคคล', variant: 'default' as const },
    marketing: { label: 'Influ Marketing', variant: 'warning' as const },
    driver: { label: 'พนักงานขับรถ', variant: 'info' as const }
  }
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.employee
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleDelete = async (link: InviteLink) => {
    if (confirm(`ต้องการปิดใช้งานลิงก์ ${link.code} ใช่หรือไม่?`)) {
      await deleteInviteLink(link.id!)
    }
  }

  if (loading) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            จัดการ Invite Links
          </h1>
          <p className="text-gray-600 mt-1">
            สร้างลิงก์สำหรับเชิญพนักงานใหม่เข้าระบบ
          </p>
        </div>
        
        <Button
          asChild
          className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
        >
          <Link href="/employees/invite-links/create">
            <Plus className="w-5 h-5 mr-2" />
            สร้างลิงก์ใหม่
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ลิงก์ทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900">{inviteLinks.length}</p>
              </div>
              <LinkIcon className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-teal-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-teal-700">ใช้งานได้</p>
                <p className="text-2xl font-bold text-teal-900">
                  {inviteLinks.filter(l => l.isActive && (!l.expiresAt || new Date(l.expiresAt) > new Date())).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-teal-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">ใช้ไปแล้ว</p>
                <p className="text-2xl font-bold text-blue-900">
                  {inviteLinks.reduce((sum, link) => sum + link.usedCount, 0)}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">หมดอายุ</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inviteLinks.filter(l => l.expiresAt && new Date(l.expiresAt) < new Date()).length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Links Table */}
      {inviteLinks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <LinkIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">ยังไม่มีลิงก์</p>
            <Button
              asChild
              variant="ghost"
              className="mt-4 text-red-600 hover:bg-red-50"
            >
              <Link href="/employees/invite-links/create">
                <Plus className="w-5 h-5 mr-2" />
                สร้างลิงก์แรก
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">รหัสลิงก์</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">ตั้งค่า</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">การใช้งาน</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">สถานะ</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">สร้างโดย</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-gray-900">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedLinks.map((link) => (
                  <tr key={link.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            {link.code}
                          </code>
                          <button
                            onClick={() => copyInviteLink(link.code)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="คัดลอกลิงก์"
                          >
                            <Copy className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                        {link.note && (
                          <p className="text-xs text-gray-500">{link.note}</p>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {getRoleBadge(link.defaultRole)}
                        <div className="text-xs text-gray-500">
                          {link.requireApproval ? 'ต้องอนุมัติ' : 'ใช้งานได้ทันที'}
                        </div>
                        {link.defaultLocationIds && link.defaultLocationIds.length > 0 && (
                          <div className="text-xs text-gray-500">
                            {link.defaultLocationIds.length} สาขา
                          </div>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
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
                    </td>
                    
                    <td className="px-6 py-4">
                      {getStatusBadge(link)}
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="text-gray-900">{link.createdByName || '-'}</p>
                        <p className="text-xs text-gray-500">{formatDate(link.createdAt)}</p>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu
                        items={[
                          {
                            label: (
                              <Link href={`/employees/invite-links/${link.id}`} className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                ดูผู้ใช้งาน
                              </Link>
                            ),
                            onClick: () => {}
                          },
                          {
                            label: (
                              <Link href={`/employees/invite-links/${link.id}/edit`} className="flex items-center gap-2">
                                <Edit className="w-4 h-4" />
                                แก้ไข
                              </Link>
                            ),
                            onClick: () => {}
                          },
                          { divider: true },
                          {
                            label: (
                              <span className="flex items-center gap-2">
                                <QrCode className="w-4 h-4" />
                                QR Code
                              </span>
                            ),
                            onClick: () => setShowQR(link.code)
                          },
                          { divider: true },
                          {
                            label: (
                              <span className="flex items-center gap-2">
                                <Trash2 className="w-4 h-4" />
                                ปิดใช้งาน
                              </span>
                            ),
                            onClick: () => handleDelete(link),
                            className: 'text-red-600 hover:bg-red-50',
                            disabled: !link.isActive
                          }
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

          {/* Pagination */}
          {inviteLinks.length > 0 && (
            <div className="p-4 border-t border-gray-100">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={inviteLinks.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
          </div>
        </Card>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQR(null)}
        >
          <Card
            className="max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">QR Code</h3>
              <div className="bg-gray-100 aspect-square rounded-lg flex items-center justify-center">
                <QrCode className="w-32 h-32 text-gray-400" />
              </div>
              <p className="text-center mt-4 text-sm text-gray-600">
                QR Code สำหรับ: {showQR}
              </p>
              <Button
                onClick={() => setShowQR(null)}
                variant="outline"
                className="w-full mt-4"
              >
                ปิด
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}