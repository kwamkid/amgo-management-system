// app/(admin)/employees/page.tsx

'use client'

import { useState } from 'react'
import { useUsers, useUserStatistics } from '@/hooks/useUsers'
import { useToast } from '@/hooks/useToast'
import { User, UserFilters } from '@/types/user'
import { 
  Users, 
  Search, 
  Filter,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Shield,
  Phone,
  Calendar,
  Edit,
  UserX,
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import DropdownMenu from '@/components/ui/DropdownMenu'
import TechLoader from '@/components/shared/TechLoader'

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  
  const { users, loading, loadMore, hasMore, updateUserRole, deactivateUser } = useUsers({
    role: roleFilter || undefined,
    isActive: statusFilter === 'all' ? undefined : statusFilter === 'active'
  })
  
  const { statistics } = useUserStatistics()
  const { showToast } = useToast()

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

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="flex items-center gap-1 text-green-600">
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm">ใช้งาน</span>
      </span>
    ) : (
      <span className="flex items-center gap-1 text-red-600">
        <XCircle className="w-4 h-4" />
        <span className="text-sm">ระงับ</span>
      </span>
    )
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    await updateUserRole(userId, newRole)
  }

  const handleDeactivate = async (user: User) => {
    if (confirm(`ต้องการระงับการใช้งานของ ${user.fullName} ใช่หรือไม่?`)) {
      await deactivateUser(user.id!)
    }
  }

  const handleDelete = async (user: User) => {
    if (confirm(`⚠️ คำเตือน: การลบพนักงานจะไม่สามารถกู้คืนได้\n\nต้องการลบ ${user.fullName} ใช่หรือไม่?`)) {
      // TODO: Implement hard delete
      showToast('ฟังก์ชันลบพนักงานยังไม่พร้อมใช้งาน', 'error')
    }
  }

  if (loading && users.length === 0) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">จัดการพนักงาน</h1>
        <p className="text-gray-600 mt-1 text-base">
          จัดการข้อมูลและสิทธิ์การใช้งานของพนักงาน
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ทั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.total}</p>
            </div>
            <Users className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ใช้งาน</p>
              <p className="text-2xl font-bold text-green-600">{statistics.active}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">รออนุมัติ</p>
              <p className="text-2xl font-bold text-yellow-600">{statistics.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ระงับ</p>
              <p className="text-2xl font-bold text-red-600">{statistics.inactive}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อพนักงาน..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
          />
        </div>
        
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
        >
          <option value="">ทุกสิทธิ์</option>
          <option value="admin">ผู้ดูแลระบบ</option>
          <option value="hr">ฝ่ายบุคคล</option>
          <option value="manager">ผู้จัดการ</option>
          <option value="employee">พนักงาน</option>
        </select>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
        >
          <option value="active">เฉพาะที่ใช้งาน</option>
          <option value="inactive">เฉพาะที่ระงับ</option>
          <option value="all">ทั้งหมด</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">พนักงาน</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">ติดต่อ</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">สิทธิ์</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">สถานะ</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">เข้าร่วม</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-900">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
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
                          <Users className="w-5 h-5 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{user.fullName}</p>
                        <p className="text-sm text-gray-500">{user.lineDisplayName}</p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {user.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          {user.phone}
                        </div>
                      )}
                      {user.allowedLocationIds && user.allowedLocationIds.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span className="text-xs">{user.allowedLocationIds.length} สาขา</span>
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    {getRoleBadge(user.role)}
                  </td>
                  
                  <td className="px-6 py-4">
                    {getStatusBadge(user.isActive)}
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('th-TH') : '-'}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu
                      items={[
                        {
                          label: (
                            <Link href={`/employees/${user.id}/edit`} className="flex items-center gap-2">
                              <Edit className="w-4 h-4" />
                              แก้ไขข้อมูล
                            </Link>
                          ),
                          onClick: () => {} // Link handles navigation
                        },
                        { divider: true },
                        {
                          label: (
                            <span className="flex items-center gap-2">
                              <UserX className="w-4 h-4" />
                              ระงับการใช้งาน
                            </span>
                          ),
                          onClick: () => handleDeactivate(user),
                          className: 'text-yellow-600 hover:bg-yellow-50'
                        },
                        {
                          label: (
                            <span className="flex items-center gap-2">
                              <Trash2 className="w-4 h-4" />
                              ลบพนักงาน
                            </span>
                          ),
                          onClick: () => handleDelete(user),
                          className: 'text-red-600 hover:bg-red-50'
                        }
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Load More */}
        {hasMore && (
          <div className="p-4 text-center border-t border-gray-200">
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'กำลังโหลด...' : 'แสดงเพิ่มเติม'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}