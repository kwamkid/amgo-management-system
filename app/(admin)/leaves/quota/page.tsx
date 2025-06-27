// app/(admin)/leaves/quota/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { useToast } from '@/hooks/useToast'
import { 
  Calendar, 
  Users, 
  Search,
  Save,
  AlertCircle,
  User,
  Heart,
  Briefcase,
  Activity,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { gradients } from '@/lib/theme/colors'
import TechLoader from '@/components/shared/TechLoader'
import { LeaveQuotaYear, LeaveType } from '@/types/leave'
import { getQuotaForYear, updateQuota } from '@/lib/services/leaveService'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface UserQuota {
  user: {
    id: string
    fullName: string
    lineDisplayName: string
    linePictureUrl?: string
    role: string
  }
  quota: LeaveQuotaYear | null
  hasChanges?: boolean
}

export default function LeaveQuotaManagementPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { users, loading: usersLoading } = useUsers({ isActive: true })
  const { showToast } = useToast()
  
  const [year, setYear] = useState(new Date().getFullYear())
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userQuotas, setUserQuotas] = useState<UserQuota[]>([])
  const [editedQuotas, setEditedQuotas] = useState<{ [key: string]: number }>({})

  // Check permission
  const canManage = userData && ['hr', 'admin'].includes(userData.role)

  useEffect(() => {
    if (userData && !canManage) {
      router.push('/leaves')
      return
    }
  }, [userData, canManage, router])

  // Fetch quotas for all users
  useEffect(() => {
    if (users.length > 0) {
      fetchAllQuotas()
    }
  }, [users, year])

  const fetchAllQuotas = async () => {
    setLoading(true)
    try {
      const quotaPromises = users.map(async (user) => {
        const quota = await getQuotaForYear(user.id!, year)
        return {
          user: {
            id: user.id!,
            fullName: user.fullName,
            lineDisplayName: user.lineDisplayName,
            linePictureUrl: user.linePictureUrl,
            role: user.role
          },
          quota
        }
      })
      
      const results = await Promise.all(quotaPromises)
      setUserQuotas(results)
      setEditedQuotas({}) // Reset edited values
    } catch (error) {
      showToast('ไม่สามารถโหลดข้อมูลโควต้าได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleQuotaChange = (userId: string, type: LeaveType, value: string) => {
    const key = `${userId}-${type}`
    const numValue = parseInt(value) || 0
    
    setEditedQuotas(prev => ({
      ...prev,
      [key]: numValue
    }))

    // Mark user as having changes
    setUserQuotas(prev => prev.map(uq => 
      uq.user.id === userId 
        ? { ...uq, hasChanges: true }
        : uq
    ))
  }

  const getCurrentValue = (userId: string, type: LeaveType, originalValue: number) => {
    const key = `${userId}-${type}`
    return editedQuotas[key] !== undefined ? editedQuotas[key] : originalValue
  }

  const hasAnyChanges = () => {
    return Object.keys(editedQuotas).length > 0
  }

  const saveAllChanges = async () => {
    setSaving(true)
    try {
      const updatePromises = Object.entries(editedQuotas).map(async ([key, newValue]) => {
        const [userId, type] = key.split('-')
        const userQuota = userQuotas.find(uq => uq.user.id === userId)
        if (!userQuota?.quota) return

        const currentValue = userQuota.quota[type as LeaveType].total
        if (currentValue !== newValue) {
          await updateQuota(
            userId, 
            year, 
            type as LeaveType, 
            newValue, 
            userData!.id!, 
            'ปรับปรุงโควต้าประจำปี'
          )
        }
      })

      await Promise.all(updatePromises)
      showToast('บันทึกการเปลี่ยนแปลงสำเร็จ', 'success')
      await fetchAllQuotas() // Refresh data
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Filter users by search
  const filteredQuotas = userQuotas.filter(({ user }) =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lineDisplayName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Show loading while checking auth
  if (!userData) {
    return <TechLoader />
  }

  if (!canManage) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>ไม่มีสิทธิ์เข้าถึงหน้านี้</AlertTitle>
          <AlertDescription>
            เฉพาะ HR และ Admin เท่านั้น
          </AlertDescription>
        </Alert>
        <div className="mt-4 text-center">
          <Link href="/leaves">
            <Button variant="outline">
              กลับไปหน้าการลา
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (loading || usersLoading) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการโควต้าการลา</h1>
          <p className="text-gray-600 mt-1">
            กำหนดจำนวนวันลาสำหรับพนักงานแต่ละคน
          </p>
        </div>
        
        <div className="flex gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-10 px-4 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {[-1, 0, 1].map(offset => {
              const y = new Date().getFullYear() + offset
              return <option key={y} value={y}>{y}</option>
            })}
          </select>
          
          {hasAnyChanges() && (
            <Button
              onClick={saveAllChanges}
              disabled={saving}
              className={`bg-gradient-to-r ${gradients.primary}`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  บันทึกการเปลี่ยนแปลง
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="ค้นหาด้วยชื่อพนักงาน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold">พนักงาน</TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <Heart className="w-4 h-4 text-pink-600" />
                  <span>ลาป่วย</span>
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span>ลากิจ</span>
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>ลาพักร้อน</span>
                </div>
              </TableHead>
              <TableHead className="text-center">สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuotas.map(({ user, quota, hasChanges }) => (
              <TableRow key={user.id} className={hasChanges ? 'bg-yellow-50' : ''}>
                <TableCell>
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
                      <p className="font-medium">{user.fullName}</p>
                      <p className="text-sm text-gray-500">@{user.lineDisplayName}</p>
                    </div>
                  </div>
                </TableCell>
                
                {/* Sick Leave */}
                <TableCell>
                  <div className="flex flex-col items-center gap-1">
                    <Input
                      type="number"
                      value={getCurrentValue(user.id, 'sick', quota?.sick.total || 0)}
                      onChange={(e) => handleQuotaChange(user.id, 'sick', e.target.value)}
                      className="w-20 text-center"
                      min="0"
                      max="365"
                    />
                    <div className="text-xs text-gray-500">
                      ใช้ {quota?.sick.used || 0} / เหลือ {quota?.sick.remaining || 0}
                    </div>
                  </div>
                </TableCell>
                
                {/* Personal Leave */}
                <TableCell>
                  <div className="flex flex-col items-center gap-1">
                    <Input
                      type="number"
                      value={getCurrentValue(user.id, 'personal', quota?.personal.total || 0)}
                      onChange={(e) => handleQuotaChange(user.id, 'personal', e.target.value)}
                      className="w-20 text-center"
                      min="0"
                      max="365"
                    />
                    <div className="text-xs text-gray-500">
                      ใช้ {quota?.personal.used || 0} / เหลือ {quota?.personal.remaining || 0}
                    </div>
                  </div>
                </TableCell>
                
                {/* Vacation Leave */}
                <TableCell>
                  <div className="flex flex-col items-center gap-1">
                    <Input
                      type="number"
                      value={getCurrentValue(user.id, 'vacation', quota?.vacation.total || 0)}
                      onChange={(e) => handleQuotaChange(user.id, 'vacation', e.target.value)}
                      className="w-20 text-center"
                      min="0"
                      max="365"
                    />
                    <div className="text-xs text-gray-500">
                      ใช้ {quota?.vacation.used || 0} / เหลือ {quota?.vacation.remaining || 0}
                    </div>
                  </div>
                </TableCell>
                
                {/* Status */}
                <TableCell className="text-center">
                  {hasChanges ? (
                    <Badge variant="warning" className="text-xs">
                      มีการแก้ไข
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      ปกติ
                    </Badge>
                  )}
                  <div className="mt-1">
                    <Badge variant="outline" className="text-xs">
                      {user.role === 'admin' && 'Admin'}
                      {user.role === 'hr' && 'HR'}
                      {user.role === 'manager' && 'Manager'}
                      {user.role === 'employee' && 'Employee'}
                    </Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {filteredQuotas.length === 0 && (
          <div className="py-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">ไม่พบข้อมูลพนักงาน</p>
          </div>
        )}
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">พนักงานทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{filteredQuotas.length}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.primaryLight} rounded-xl`}>
                <Users className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">พนักงานที่ยังไม่มีโควต้า</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  {filteredQuotas.filter(uq => !uq.quota || 
                    (uq.quota.sick.total === 0 && 
                     uq.quota.personal.total === 0 && 
                     uq.quota.vacation.total === 0)
                  ).length}
                </p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.warningLight} rounded-xl`}>
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">มีการแก้ไข</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {userQuotas.filter(uq => uq.hasChanges).length}
                </p>
              </div>
              <div className={`p-3 bg-gradient-to-br from-yellow-50 to-amber-100 rounded-xl`}>
                <Save className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ปีที่จัดการ</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{year}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.grayLight} rounded-xl`}>
                <Calendar className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}