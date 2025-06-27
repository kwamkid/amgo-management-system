// app/(admin)/leaves/management/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useLeave } from '@/hooks/useLeave'
import { 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Download,
  TrendingUp,
  User,
  FileText,
  ChevronRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { gradients } from '@/lib/theme/colors'
import TechLoader from '@/components/shared/TechLoader'
import Link from 'next/link'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { LeaveRequest, LEAVE_TYPE_LABELS } from '@/types/leave'

interface ExtendedLeaveRequest extends LeaveRequest {
  userAvatar?: string;
}

// Helper function to safely format date
const safeFormatDate = (date: any, formatString: string, options?: any) => {
  try {
    if (!date) return '-'
    
    // Convert to Date object if needed
    let dateObj: Date
    if (date instanceof Date) {
      dateObj = date
    } else if (typeof date === 'string' || typeof date === 'number') {
      dateObj = new Date(date)
    } else if (date?.seconds) {
      // Firestore Timestamp
      dateObj = new Date(date.seconds * 1000)
    } else {
      return '-'
    }
    
    // Check if valid date
    if (isNaN(dateObj.getTime())) {
      return '-'
    }
    
    return format(dateObj, formatString, options)
  } catch (error) {
    console.error('Date formatting error:', error, date)
    return '-'
  }
}

export default function LeaveManagementPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { approveLeave, rejectLeave, loading } = useLeave()
  const [leaves, setLeaves] = useState<ExtendedLeaveRequest[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [fetching, setFetching] = useState(true)

  // Check permission
  const canManage = userData && ['manager', 'hr', 'admin'].includes(userData.role)

  useEffect(() => {
    if (canManage) {
      fetchLeaveRequests()
    }
  }, [canManage, filter])

  const fetchLeaveRequests = async () => {
    try {
      setFetching(true)
      let q = query(
        collection(db, 'leaves'),
        orderBy('createdAt', 'desc')
      )

      // Filter by status if not 'all'
      if (filter !== 'all') {
        q = query(q, where('status', '==', filter))
      }

      const snapshot = await getDocs(q)
      const leavesData = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          // Ensure dates are properly formatted
          startDate: data.startDate,
          endDate: data.endDate,
          createdAt: data.createdAt,
          approvedAt: data.approvedAt,
          updatedAt: data.updatedAt,
          userAvatar: data.userAvatar || null // Include avatar
        } as ExtendedLeaveRequest
      })

      setLeaves(leavesData)
    } catch (error) {
      console.error('Error fetching leave requests:', error)
    } finally {
      setFetching(false)
    }
  }

  const handleApprove = async (leaveId: string) => {
    if (!window.confirm('อนุมัติคำขอลานี้?')) return
    
    await approveLeave(leaveId)
    await fetchLeaveRequests()
  }

  const handleReject = async (leaveId: string) => {
    const reason = window.prompt('กรุณาระบุเหตุผลที่ไม่อนุมัติ:')
    if (!reason) return
    
    await rejectLeave(leaveId, reason)
    await fetchLeaveRequests()
  }

  // Filter by search term
  const filteredLeaves = leaves.filter(leave => 
    leave.userName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Calculate stats
  const stats = {
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'pending').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length
  }

  if (!canManage) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>ไม่มีสิทธิ์เข้าถึงหน้านี้</AlertTitle>
          <AlertDescription>
            เฉพาะ HR, Admin และ Manager เท่านั้น
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

  if (fetching) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการคำขอลา</h1>
          <p className="text-gray-600 mt-1">
            อนุมัติและจัดการคำขอลาของพนักงาน
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Link href="/leaves/requests">
            <Button className={`bg-gradient-to-r ${gradients.primary}`}>
              <FileText className="w-4 h-4 mr-2" />
              ดูคำขอทั้งหมด
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.grayLight} rounded-xl`}>
                <FileText className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">รออนุมัติ</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{stats.pending}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.warningLight} rounded-xl`}>
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">อนุมัติแล้ว</p>
                <p className="text-2xl font-bold text-teal-600 mt-1">{stats.approved}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.successLight} rounded-xl`}>
                <CheckCircle className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ไม่อนุมัติ</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{stats.rejected}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.errorLight} rounded-xl`}>
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Alert */}
      {stats.pending > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-900">มีคำขอรออนุมัติ</AlertTitle>
          <AlertDescription className="text-orange-800">
            มี <strong>{stats.pending}</strong> คำขอลาที่รอการอนุมัติจากคุณ
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="ค้นหาด้วยชื่อพนักงาน..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="pending">รออนุมัติ</SelectItem>
                <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
                <SelectItem value="rejected">ไม่อนุมัติ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests List */}
      {filteredLeaves.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-16 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">ไม่พบคำขอลา</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredLeaves.map((leave) => (
            <Card key={leave.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Employee Info */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-3">
                        {/* Profile Image */}
                        {leave.userAvatar ? (
                          <img
                            src={leave.userAvatar}
                            alt={leave.userName}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center ${leave.userAvatar ? 'hidden' : ''}`}>
                          <User className="w-5 h-5 text-gray-600" />
                        </div>
                        
                        <div>
                          <span className="font-medium text-lg">{leave.userName}</span>
                          {leave.userEmail && (
                            <p className="text-sm text-gray-500">{leave.userEmail}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {LEAVE_TYPE_LABELS[leave.type]}
                        </Badge>
                        {leave.urgentMultiplier > 1 && (
                          <Badge variant="error">
                            ลาด่วน x{leave.urgentMultiplier}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Leave Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">ระยะเวลา</p>
                        <p className="font-medium">
                          {safeFormatDate(leave.startDate, 'dd MMM yyyy', { locale: th })} - 
                          {safeFormatDate(leave.endDate, 'dd MMM yyyy', { locale: th })}
                          <span className="text-gray-600 ml-2">({leave.totalDays} วัน)</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">ส่งคำขอเมื่อ</p>
                        <p className="font-medium">
                          {safeFormatDate(leave.createdAt, 'dd MMM yyyy HH:mm', { locale: th })}
                        </p>
                      </div>
                    </div>
                    
                    {/* Reason */}
                    <div>
                      <p className="text-sm text-gray-600">เหตุผล</p>
                      <p className="text-base">{leave.reason}</p>
                    </div>
                    
                    {/* Attachments */}
                    {leave.attachments && leave.attachments.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-blue-600">
                        <FileText className="w-4 h-4" />
                        <span>มีเอกสารแนบ {leave.attachments.length} ไฟล์</span>
                      </div>
                    )}
                    
                    {/* Rejected Reason */}
                    {leave.status === 'rejected' && leave.rejectedReason && (
                      <Alert variant="error" className="mt-3">
                        <AlertDescription>
                          <strong>เหตุผลที่ไม่อนุมัติ:</strong> {leave.rejectedReason}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-col items-end gap-3">
                    {/* Status */}
                    <Badge
                      variant={
                        leave.status === 'approved' ? 'success' :
                        leave.status === 'rejected' ? 'error' :
                        'warning'
                      }
                      className="text-sm px-3 py-1"
                    >
                      {leave.status === 'approved' && 'อนุมัติแล้ว'}
                      {leave.status === 'rejected' && 'ไม่อนุมัติ'}
                      {leave.status === 'pending' && 'รออนุมัติ'}
                    </Badge>
                    
                    {/* Action Buttons */}
                    {leave.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(leave.id!)}
                          disabled={loading}
                          className={`bg-gradient-to-r ${gradients.success}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          อนุมัติ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(leave.id!)}
                          disabled={loading}
                          className="border-red-500 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          ไม่อนุมัติ
                        </Button>
                      </div>
                    )}
                    
                    {/* View Details */}
                    <Link href={`/leaves/history/${leave.id}`}>
                      <Button variant="ghost" size="sm">
                        ดูรายละเอียด
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}