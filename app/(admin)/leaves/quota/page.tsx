// app/(admin)/leaves/quota/page.tsx

'use client'

import { useState, useEffect, useMemo } from 'react'
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
  Loader2,
  Edit3,
  Check,
  X,
  Filter,
  RefreshCw
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Pagination } from '@/components/ui/pagination'
import CarryOverDialog from '@/components/leave/CarryOverDialog'

interface UserQuota {
  user: {
    id: string
    fullName: string
    lineDisplayName: string
    linePictureUrl?: string
    role: string
  }
  quota: LeaveQuotaYear | null
}

interface QuotaEditAllProps {
  userId: string
  userName: string
  userAvatar?: string
  quota: LeaveQuotaYear | null
  onUpdate: (type: LeaveType, newValue: number) => Promise<void>
}

function QuotaEditAll({ 
  userId,
  userName,
  userAvatar,
  quota,
  onUpdate 
}: QuotaEditAllProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [values, setValues] = useState({
    sick: quota?.sick.total || 0,
    personal: quota?.personal.total || 0,
    vacation: quota?.vacation.total || 0
  })
  const [isUpdating, setIsUpdating] = useState(false)

  const leaveInfo = [
    {
      type: 'sick' as const,
      label: 'ลาป่วย',
      icon: <Heart className="w-4 h-4 text-pink-600" />,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      used: quota?.sick.used || 0,
      remaining: quota?.sick.remaining || 0
    },
    {
      type: 'personal' as const,
      label: 'ลากิจ',
      icon: <Briefcase className="w-4 h-4 text-blue-600" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      used: quota?.personal.used || 0,
      remaining: quota?.personal.remaining || 0
    },
    {
      type: 'vacation' as const,
      label: 'ลาพักร้อน',
      icon: <Activity className="w-4 h-4 text-emerald-600" />,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      used: quota?.vacation.used || 0,
      remaining: quota?.vacation.remaining || 0
    }
  ]

  const handleUpdate = async () => {
    setIsUpdating(true)
    
    try {
      // Update all changed values
      const promises = []
      for (const [type, newValue] of Object.entries(values)) {
        const currentValue = quota?.[type as LeaveType].total || 0
        if (newValue !== currentValue) {
          promises.push(onUpdate(type as LeaveType, newValue))
        }
      }
      
      if (promises.length > 0) {
        await Promise.all(promises)
      }
      
      setIsOpen(false)
    } catch (error) {
      console.error('Error updating quotas:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const hasChanges = () => {
    return values.sick !== (quota?.sick.total || 0) ||
           values.personal !== (quota?.personal.total || 0) ||
           values.vacation !== (quota?.vacation.total || 0)
  }

  const resetValues = () => {
    setValues({
      sick: quota?.sick.total || 0,
      personal: quota?.personal.total || 0,
      vacation: quota?.vacation.total || 0
    })
  }

  return (
    <Popover open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetValues()
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100"
        >
          <Edit3 className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-4 border-0 shadow-lg" align="end">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2 pb-2">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-500" />
              </div>
            )}
            <div className="flex-1">
              <h4 className="font-medium text-sm">แก้ไขโควต้า - {userName}</h4>
            </div>
          </div>
          
          {/* Leave Types - Compact Grid */}
          <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
            {leaveInfo.map(({ type, label, icon, color, used }) => (
              <div key={type} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 min-w-[90px] ${color}`}>
                  {icon}
                  <span className="text-sm font-medium">{label}</span>
                </div>
                
                <Input
                  type="number"
                  value={values[type]}
                  onChange={(e) => setValues({ 
                    ...values, 
                    [type]: parseInt(e.target.value) || 0 
                  })}
                  min="0"
                  max="365"
                  className="h-8 w-20 text-center border-gray-200"
                />
                
                <div className="text-xs text-gray-500 min-w-[60px]">
                  ใช้ {used} เหลือ {Math.max(0, values[type] - used)}
                </div>
                
                {values[type] < used && (
                  <span className="text-orange-600" title="โควต้าน้อยกว่าที่ใช้ไป">⚠️</span>
                )}
              </div>
            ))}
          </div>
          
          {/* Summary */}
          <div className="bg-blue-50 px-3 py-2 rounded-lg flex justify-between text-sm">
            <span className="text-gray-600">รวม</span>
            <span className="font-semibold text-blue-700">
              {values.sick + values.personal + values.vacation} วัน
            </span>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetValues()
                setIsOpen(false)
              }}
              disabled={isUpdating}
              className="flex-1 h-8 border-gray-200"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={handleUpdate}
              disabled={isUpdating || !hasChanges()}
              className={`flex-1 h-8 bg-gradient-to-r ${gradients.primary}`}
            >
              {isUpdating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'บันทึก'
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function LeaveQuotaManagementPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { users, loading: usersLoading } = useUsers({ 
    isActive: true,
    pageSize: 100  // เพิ่ม pageSize เพื่อดึงพนักงานทั้งหมด
  })
  const { showToast } = useToast()
  
  const [year, setYear] = useState(new Date().getFullYear())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'no-quota' | 'has-quota'>('all')
  const [loading, setLoading] = useState(false)
  const [userQuotas, setUserQuotas] = useState<UserQuota[]>([])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // CarryOver Dialog state
  const [showCarryOverDialog, setShowCarryOverDialog] = useState(false)

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
    } catch (error) {
      showToast('ไม่สามารถโหลดข้อมูลโควต้าได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleQuotaUpdate = async (userId: string, type: LeaveType, newValue: number) => {
    try {
      await updateQuota(
        userId, 
        year, 
        type, 
        newValue, 
        userData!.id!, 
        'ปรับปรุงโควต้าประจำปี'
      )
      showToast('บันทึกการเปลี่ยนแปลงสำเร็จ', 'success')
      await fetchAllQuotas() // Refresh data
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error')
    }
  }

  // Filter users
  const filteredQuotas = useMemo(() => {
    return userQuotas.filter(({ user, quota }) => {
      // Search filter
      const matchSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lineDisplayName.toLowerCase().includes(searchTerm.toLowerCase())

      // Quota filter
      let matchFilter = true
      if (filterType === 'no-quota') {
        matchFilter = !quota || (quota.sick.total === 0 && quota.personal.total === 0 && quota.vacation.total === 0)
      } else if (filterType === 'has-quota') {
        matchFilter = quota !== null && (quota.sick.total > 0 || quota.personal.total > 0 || quota.vacation.total > 0)
      }

      return matchSearch && matchFilter
    })
  }, [userQuotas, searchTerm, filterType])

  // Pagination calculations
  const totalPages = Math.ceil(filteredQuotas.length / itemsPerPage)
  const paginatedQuotas = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredQuotas.slice(start, end)
  }, [filteredQuotas, currentPage, itemsPerPage])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterType, year])

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

  const leaveTypes = [
    {
      type: 'sick' as const,
      label: 'ลาป่วย',
      icon: <Heart className="w-4 h-4" />,
      iconColor: 'text-pink-600',
      bgColor: 'bg-gradient-to-br from-pink-50 to-rose-50',
      headerBg: 'bg-gradient-to-r from-pink-100 to-rose-100'
    },
    {
      type: 'personal' as const,
      label: 'ลากิจ',
      icon: <Briefcase className="w-4 h-4" />,
      iconColor: 'text-blue-600',
      bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50',
      headerBg: 'bg-gradient-to-r from-blue-100 to-indigo-100'
    },
    {
      type: 'vacation' as const,
      label: 'ลาพักร้อน',
      icon: <Activity className="w-4 h-4" />,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-gradient-to-br from-emerald-50 to-teal-50',
      headerBg: 'bg-gradient-to-r from-emerald-100 to-teal-100'
    }
  ]

  // Check if user has no quota
  const hasNoQuota = (quota: LeaveQuotaYear | null) => {
    return !quota || (quota.sick.total === 0 && quota.personal.total === 0 && quota.vacation.total === 0)
  }

  // Calculate stats
  const stats = {
    total: filteredQuotas.length,
    noQuota: filteredQuotas.filter(uq => hasNoQuota(uq.quota)).length,
    hasQuota: filteredQuotas.filter(uq => !hasNoQuota(uq.quota)).length
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
          <Button
            onClick={() => setShowCarryOverDialog(true)}
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            ยกยอดโควต้าปีใหม่
          </Button>
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
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">พนักงานทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
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
                <p className="text-sm text-gray-600">มีโควต้าแล้ว</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.hasQuota}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.successLight} rounded-xl`}>
                <Check className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ยังไม่มีโควต้า</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{stats.noQuota}</p>
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

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="ค้นหาด้วยชื่อพนักงาน..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="กรองข้อมูล" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">แสดงทั้งหมด</SelectItem>
                <SelectItem value="has-quota">มีโควต้าแล้ว</SelectItem>
                <SelectItem value="no-quota">ยังไม่มีโควต้า</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-50 hover:to-gray-100">
              <TableHead className="font-semibold text-gray-700">พนักงาน</TableHead>
              {leaveTypes.map(({ type, label, icon, headerBg }) => (
                <TableHead key={type} className="text-center">
                  <div className={`flex items-center justify-center gap-2 p-2 rounded-lg ${headerBg}`}>
                    {icon}
                    <span className="font-semibold">{label}</span>
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-center font-semibold text-gray-700">สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedQuotas.map(({ user, quota }) => {
              const noQuota = hasNoQuota(quota)
              return (
                <TableRow 
                  key={user.id} 
                  className={noQuota ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-50'}
                >
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
                  
                  {leaveTypes.map(({ type, label, icon, iconColor, bgColor }) => (
                    <TableCell key={type} className="text-center p-2">
                      <div className={`p-3 rounded-lg ${bgColor}`}>
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold text-lg">{quota?.[type].total || 0}</span>
                          <div className="text-xs text-gray-600">
                            ใช้ {quota?.[type].used || 0} / เหลือ {quota?.[type].remaining || 0}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  ))}
                  
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <QuotaEditAll
                        userId={user.id}
                        userName={user.fullName}
                        userAvatar={user.linePictureUrl}
                        quota={quota}
                        onUpdate={(type, newValue) => handleQuotaUpdate(user.id, type, newValue)}
                      />
                      {noQuota ? (
                        <Badge variant="warning" className="text-xs">
                          ยังไม่กำหนด
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-xs">
                          กำหนดแล้ว
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        
        {filteredQuotas.length === 0 && (
          <div className="py-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">ไม่พบข้อมูลพนักงาน</p>
          </div>
        )}

        {/* Pagination */}
        {filteredQuotas.length > 0 && (
          <div className="p-4 border-t border-gray-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredQuotas.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>

      {/* CarryOver Dialog */}
      <CarryOverDialog
        open={showCarryOverDialog}
        onOpenChange={setShowCarryOverDialog}
        users={users.map(u => ({ id: u.id!, fullName: u.fullName }))}
        currentYear={year}
        executedBy={userData?.id || ''}
        onSuccess={fetchAllQuotas}
      />
    </div>
  )
}