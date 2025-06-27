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
  Edit,
  Save,
  X,
  Plus,
  Minus,
  History,
  AlertCircle,
  User,
  Heart,
  Briefcase,
  Activity
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { gradients } from '@/lib/theme/colors'
import TechLoader from '@/components/shared/TechLoader'
import { LeaveQuotaYear, LeaveType } from '@/types/leave'
import { getQuotaForYear, updateQuota } from '@/lib/services/leaveService'
import { Textarea } from '@/components/ui/textarea'

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

export default function LeaveQuotaManagementPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { users, loading: usersLoading } = useUsers({ isActive: true })
  const { showToast } = useToast()
  
  const [year, setYear] = useState(new Date().getFullYear())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserQuota | null>(null)
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState<{ userId: string, type: LeaveType } | null>(null)
  const [editValues, setEditValues] = useState<{ [key: string]: number }>({})
  const [editReason, setEditReason] = useState('')
  const [userQuotas, setUserQuotas] = useState<UserQuota[]>([])

  // Check permission
  const canManage = userData && ['hr', 'admin'].includes(userData.role)

  useEffect(() => {
    if (!canManage) {
      router.push('/leaves')
      return
    }
  }, [canManage, router])

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

  const handleUpdateQuota = async (userId: string, type: LeaveType) => {
    const newTotal = editValues[`${userId}-${type}`]
    
    if (!newTotal || newTotal < 0) {
      showToast('กรุณาระบุจำนวนวันที่ถูกต้อง', 'error')
      return
    }
    
    if (!editReason.trim()) {
      showToast('กรุณาระบุเหตุผลในการแก้ไข', 'error')
      return
    }
    
    try {
      await updateQuota(userId, year, type, newTotal, userData!.id!, editReason)
      showToast('อัพเดทโควต้าสำเร็จ', 'success')
      
      // Refresh data
      await fetchAllQuotas()
      
      // Reset edit state
      setEditMode(null)
      setEditReason('')
      delete editValues[`${userId}-${type}`]
    } catch (error) {
      showToast('ไม่สามารถอัพเดทโควต้าได้', 'error')
    }
  }

  const getLeaveTypeIcon = (type: LeaveType) => {
    switch (type) {
      case 'sick':
        return <Heart className="w-4 h-4 text-pink-600" />
      case 'personal':
        return <Briefcase className="w-4 h-4 text-blue-600" />
      case 'vacation':
        return <Activity className="w-4 h-4 text-emerald-600" />
    }
  }

  const getLeaveTypeColor = (type: LeaveType) => {
    switch (type) {
      case 'sick':
        return 'from-pink-50 to-rose-100'
      case 'personal':
        return 'from-blue-50 to-indigo-100'
      case 'vacation':
        return 'from-emerald-50 to-teal-100'
    }
  }

  // Filter users by search
  const filteredQuotas = userQuotas.filter(({ user }) =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lineDisplayName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!canManage) {
    return (
      <Alert variant="error">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>ไม่มีสิทธิ์เข้าถึงหน้านี้</AlertTitle>
        <AlertDescription>
          เฉพาะ HR และ Admin เท่านั้น
        </AlertDescription>
      </Alert>
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
            {[0, 1, 2].map(offset => {
              const y = new Date().getFullYear() - offset
              return <option key={y} value={y}>{y}</option>
            })}
          </select>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="border-blue-200 bg-blue-50">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>หมายเหตุ:</strong> พนักงานใหม่จะเริ่มต้นด้วยโควต้า 0 วัน กรุณากำหนดโควต้าให้พนักงานก่อนที่พนักงานจะสามารถขอลาได้
        </AlertDescription>
      </Alert>

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

      {/* Users List */}
      <div className="grid gap-4">
        {filteredQuotas.map(({ user, quota }) => (
          <Card key={user.id} className="border-0 shadow-md">
            <CardContent className="p-6">
              {/* User Info */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {user.linePictureUrl ? (
                    <img
                      src={user.linePictureUrl}
                      alt={user.fullName}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-lg">{user.fullName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">@{user.lineDisplayName}</span>
                      <Badge variant="outline" className="text-xs">
                        {user.role === 'admin' && 'ผู้ดูแลระบบ'}
                        {user.role === 'hr' && 'ฝ่ายบุคคล'}
                        {user.role === 'manager' && 'ผู้จัดการ'}
                        {user.role === 'employee' && 'พนักงาน'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quota Details */}
              {quota && (
                <div className="space-y-3">
                  {(['sick', 'personal', 'vacation'] as LeaveType[]).map((type) => {
                    const isEditing = editMode?.userId === user.id && editMode?.type === type
                    const key = `${user.id}-${type}`
                    const currentTotal = quota[type].total
                    
                    return (
                      <div
                        key={type}
                        className={`p-4 rounded-lg bg-gradient-to-r ${getLeaveTypeColor(type)}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getLeaveTypeIcon(type)}
                            <div>
                              <p className="font-medium">
                                {type === 'sick' && 'ลาป่วย'}
                                {type === 'personal' && 'ลากิจ'}
                                {type === 'vacation' && 'ลาพักร้อน'}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                <span>ใช้ไป: {quota[type].used} วัน</span>
                                <span>คงเหลือ: {quota[type].remaining} วัน</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <Label className="text-sm">โควต้าใหม่:</Label>
                                  <Input
                                    type="number"
                                    value={editValues[key] || currentTotal}
                                    onChange={(e) => setEditValues({
                                      ...editValues,
                                      [key]: Number(e.target.value)
                                    })}
                                    className="w-20"
                                    min="0"
                                    max="365"
                                  />
                                  <span className="text-sm">วัน</span>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleUpdateQuota(user.id, type)}
                                  className="text-green-600 hover:bg-green-50"
                                >
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditMode(null)
                                    setEditReason('')
                                    delete editValues[key]
                                  }}
                                  className="text-red-600 hover:bg-red-50"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Badge variant="outline" className="font-bold">
                                  {currentTotal} วัน
                                </Badge>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditMode({ userId: user.id, type })
                                    setEditValues({ ...editValues, [key]: currentTotal })
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Edit Reason */}
                        {isEditing && (
                          <div className="mt-3">
                            <Label className="text-sm">เหตุผลในการแก้ไข *</Label>
                            <Textarea
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              placeholder="เช่น ปรับตามอายุงาน, แก้ไขข้อผิดพลาด..."
                              className="mt-1"
                              rows={2}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* History */}
              {quota && quota.history.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUser({ user, quota })}
                    className="text-gray-600"
                  >
                    <History className="w-4 h-4 mr-2" />
                    ดูประวัติการแก้ไข ({quota.history.length})
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredQuotas.length === 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">ไม่พบข้อมูลพนักงาน</p>
          </CardContent>
        </Card>
      )}

      {/* History Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedUser(null)}
        >
          <Card
            className="max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle>ประวัติการแก้ไขโควต้า</CardTitle>
              <p className="text-sm text-gray-600">
                {selectedUser.user.fullName} - ปี {year}
              </p>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[60vh]">
              <div className="space-y-3">
                {selectedUser.quota?.history.map((history, index) => (
                  <Card key={index} className="border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">
                            {new Date(history.changedAt).toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          
                          {/* Changes */}
                          <div className="space-y-1">
                            {Object.entries(history.changes).map(([type, change]) => (
                              <div key={type} className="flex items-center gap-2">
                                {getLeaveTypeIcon(type as LeaveType)}
                                <span className="text-sm">
                                  {type === 'sick' && 'ลาป่วย'}
                                  {type === 'personal' && 'ลากิจ'}
                                  {type === 'vacation' && 'ลาพักร้อน'}:
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {change.from} → {change.to} วัน
                                </Badge>
                              </div>
                            ))}
                          </div>
                          
                          {history.reason && (
                            <p className="text-sm">
                              <span className="text-gray-500">เหตุผล:</span> {history.reason}
                            </p>
                          )}
                        </div>
                        
                        <Badge variant="secondary" className="text-xs">
                          โดย {history.changedBy}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="mt-4">
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