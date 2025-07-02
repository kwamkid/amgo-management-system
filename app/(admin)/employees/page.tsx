'use client'

import { useState } from 'react'
import { useUsers, useUserStatistics } from '@/hooks/useUsers'
import { useToast } from '@/hooks/useToast'
import { User, UserFilters } from '@/types/user'
import DeleteUserDialog from '@/components/users/DeleteUserDialog' // 👈 เพิ่ม import นี้
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  
  // 👇 เพิ่ม state สำหรับ Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<User | null>(null)
  
  const { users, loading, loadMore, hasMore, updateUserRole, deactivateUser, refetch } = useUsers({
    role: roleFilter || undefined,
    isActive: statusFilter === 'all' ? undefined : statusFilter === 'active'
  })
  
  const { statistics } = useUserStatistics()
  const { showToast } = useToast()

const getRoleBadge = (role: string) => {
  const roleConfig = {
    admin: { label: 'ผู้ดูแลระบบ', variant: 'default' as const },
    hr: { label: 'ฝ่ายบุคคล', variant: 'info' as const },
    manager: { label: 'ผู้จัดการ', variant: 'success' as const },
    employee: { label: 'พนักงาน', variant: 'secondary' as const },
    marketing: { label: 'Influ Marketing', variant: 'warning' as const },  // ✅ เพิ่ม
    driver: { label: 'พนักงานขับรถ', variant: 'info' as const }           // ✅ เพิ่ม
  }
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.employee
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    )
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="flex items-center gap-1 text-teal-600">
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

  // 👇 แก้ไข handleDelete function
  const handleDelete = (user: User) => {
    setSelectedUserForDelete(user)
    setDeleteDialogOpen(true)
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
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.total}</p>
              </div>
              <Users className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-teal-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-teal-700">ใช้งาน</p>
                <p className="text-2xl font-bold text-teal-900">{statistics.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-teal-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">รออนุมัติ</p>
                <p className="text-2xl font-bold text-orange-900">{statistics.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">ระงับ</p>
                <p className="text-2xl font-bold text-red-900">{statistics.inactive}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="ค้นหาชื่อพนักงาน..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-12 px-4 py-3 bg-gray-50 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-200 transition-all"
        >
          <option value="">ทุกสิทธิ์</option>
          <option value="admin">ผู้ดูแลระบบ</option>
          <option value="hr">ฝ่ายบุคคล</option>
          <option value="manager">ผู้จัดการ</option>
          <option value="employee">พนักงาน</option>
          <option value="marketing">Influ Marketing</option>
          <option value="driver">พนักงานขับรถ</option>
        </select>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="h-12 px-4 py-3 bg-gray-50 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-200 transition-all"
        >
          <option value="active">เฉพาะที่ใช้งาน</option>
          <option value="inactive">เฉพาะที่ระงับ</option>
          <option value="all">ทั้งหมด</option>
        </select>
      </div>

      {/* Users Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
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
            <tbody className="divide-y divide-gray-100">
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
                          onClick: () => {}
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
                          className: 'text-orange-600 hover:bg-orange-50'
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
          <div className="p-4 text-center border-t border-gray-100">
            <Button
              onClick={loadMore}
              disabled={loading}
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
            >
              {loading ? 'กำลังโหลด...' : 'แสดงเพิ่มเติม'}
            </Button>
          </div>
        )}
      </Card>

      {/* 👇 เพิ่ม Delete User Dialog Component */}
      <DeleteUserDialog
        user={selectedUserForDelete}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={() => {
          setSelectedUserForDelete(null)
          refetch() // Refresh user list หลังจากลบสำเร็จ
        }}
      />
    </div>
  )
}