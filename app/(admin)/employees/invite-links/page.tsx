// app/(admin)/employees/invite-links/page.tsx

'use client'

import { useState } from 'react'
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

export default function InviteLinksPage() {
  const { inviteLinks, loading, copyInviteLink, deleteInviteLink } = useInviteLinks()
  const [showQR, setShowQR] = useState<string | null>(null)

  const getStatusBadge = (link: InviteLink) => {
    const now = new Date()
    
    // Expired
    if (link.expiresAt && new Date(link.expiresAt) < now) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
          <XCircle className="w-3 h-3" />
          หมดอายุ
        </span>
      )
    }
    
    // Max uses reached
    if (link.maxUses && link.usedCount >= link.maxUses) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
          <AlertCircle className="w-3 h-3" />
          ใช้ครบแล้ว
        </span>
      )
    }
    
    // Inactive
    if (!link.isActive) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs">
          <XCircle className="w-3 h-3" />
          ปิดใช้งาน
        </span>
      )
    }
    
    // Active
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs">
        <CheckCircle className="w-3 h-3" />
        ใช้งานได้
      </span>
    )
  }

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      employee: { label: 'พนักงาน', color: 'bg-gray-100 text-gray-700' },
      manager: { label: 'ผู้จัดการ', color: 'bg-blue-100 text-blue-700' },
      hr: { label: 'ฝ่ายบุคคล', color: 'bg-purple-100 text-purple-700' }
    }
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.employee
    return (
      <span className={`px-2 py-1 text-xs rounded ${config.color}`}>
        {config.label}
      </span>
    )
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
        
        <Link
          href="/employees/invite-links/create"
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          สร้างลิงก์ใหม่
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ลิงก์ทั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900">{inviteLinks.length}</p>
            </div>
            <LinkIcon className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ใช้งานได้</p>
              <p className="text-2xl font-bold text-green-600">
                {inviteLinks.filter(l => l.isActive && (!l.expiresAt || new Date(l.expiresAt) > new Date())).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ใช้ไปแล้ว</p>
              <p className="text-2xl font-bold text-blue-600">
                {inviteLinks.reduce((sum, link) => sum + link.usedCount, 0)}
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">หมดอายุ</p>
              <p className="text-2xl font-bold text-gray-600">
                {inviteLinks.filter(l => l.expiresAt && new Date(l.expiresAt) < new Date()).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Links Table */}
      {inviteLinks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <LinkIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">ยังไม่มีลิงก์</p>
          <Link
            href="/employees/invite-links/create"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Plus className="w-5 h-5" />
            สร้างลิงก์แรก
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
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
              <tbody className="divide-y divide-gray-200">
                {inviteLinks.map((link) => (
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
          </div>
        </div>
      )}

      {/* QR Code Modal - Placeholder */}
      {showQR && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQR(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">QR Code</h3>
            <div className="bg-gray-100 aspect-square rounded-lg flex items-center justify-center">
              <QrCode className="w-32 h-32 text-gray-400" />
            </div>
            <p className="text-center mt-4 text-sm text-gray-600">
              QR Code สำหรับ: {showQR}
            </p>
            <button
              onClick={() => setShowQR(null)}
              className="w-full mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  )
}