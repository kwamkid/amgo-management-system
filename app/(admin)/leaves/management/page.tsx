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
  TrendingUp,
  User,
  FileText,
  ChevronRight
} from 'lucide-react'
import { gradients } from '@/lib/theme/colors'
import TechLoader from '@/components/shared/TechLoader'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Link from 'next/link'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { getLeaveRequests } from '@/lib/services/leaveService'
import { LeaveRequest, LEAVE_TYPE_LABELS } from '@/types/leave'
import { PageHeader } from '@/components/shared'
import { Textarea, Input, Alert, Pill, badgeTone, Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Select } from '@/components/aoo'
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

// Leave type styling
const leaveTypeStyles = {
  sick: {
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    shadow: 'shadow-pink-100/50'
  },
  personal: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    shadow: 'shadow-blue-100/50'
  },
  vacation: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    shadow: 'shadow-emerald-100/50'
  }
};

export default function LeaveManagementPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { approveLeave, rejectLeave, cancelApprovedLeave, loading } = useLeave()
  const [leaves, setLeaves] = useState<ExtendedLeaveRequest[]>([])
  const [allLeaves, setAllLeaves] = useState<ExtendedLeaveRequest[]>([]) // เก็บข้อมูลทั้งหมดสำหรับ stats
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [fetching, setFetching] = useState(true)
  
  // Dialog states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')

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

      // ดึงทั้งหมดครั้งเดียวเพราะแถบสถิติด้านบนต้องนับทุกสถานะ
      // แล้วค่อยกรองในหน่วยความจำ — ไม่ต้องยิงซ้ำตอนสลับแท็บ
      const all = (await getLeaveRequests()) as ExtendedLeaveRequest[]

      setAllLeaves(all)
      setLeaves(filter === 'all' ? all : all.filter((leave) => leave.status === filter))
    } catch (error) {
      console.error('Error fetching leave requests:', error)
    } finally {
      setFetching(false)
    }
  }

  const handleApprove = async (leaveId: string) => {
    setSelectedLeaveId(leaveId)
    setApproveDialogOpen(true)
  }

  const confirmApprove = async () => {
    if (!selectedLeaveId) return
    
    await approveLeave(selectedLeaveId)
    await fetchLeaveRequests()
    setApproveDialogOpen(false)
    setSelectedLeaveId(null)
  }

  const handleReject = async (leaveId: string) => {
    setSelectedLeaveId(leaveId)
    setRejectReason('')
    setRejectDialogOpen(true)
  }

  const confirmReject = async () => {
    if (!selectedLeaveId || !rejectReason.trim()) return
    
    await rejectLeave(selectedLeaveId, rejectReason)
    await fetchLeaveRequests()
    setRejectDialogOpen(false)
    setSelectedLeaveId(null)
    setRejectReason('')
  }

  const handleCancelApproved = async (leaveId: string) => {
    setSelectedLeaveId(leaveId)
    setCancelReason('')
    setCancelDialogOpen(true)
  }

  const confirmCancelApproved = async () => {
    if (!selectedLeaveId || !cancelReason.trim()) return
    
    await cancelApprovedLeave(selectedLeaveId, cancelReason)
    await fetchLeaveRequests()
    setCancelDialogOpen(false)
    setSelectedLeaveId(null)
    setCancelReason('')
  }

  // Filter by search term
  const filteredLeaves = leaves.filter(leave => 
    leave.userName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Calculate stats from all leaves (not filtered)
  const stats = {
    total: allLeaves.length,
    pending: allLeaves.filter(l => l.status === 'pending').length,
    approved: allLeaves.filter(l => l.status === 'approved').length,
    rejected: allLeaves.filter(l => l.status === 'rejected').length,
    cancelled: allLeaves.filter(l => l.status === 'cancelled').length
  }

  if (!canManage) {
    return (
      <div className="max-w-4xl">
        <Alert tone="error">
          <p className="font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          <div>
            เฉพาะ HR, Admin และ Manager เท่านั้น
          </div>
        </Alert>
        <div className="mt-4 text-center">
          <Link href="/leaves">
            <Button variant="soft">
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
      <PageHeader
        title="จัดการคำขอลา"
        description="อนุมัติและจัดการคำขอลาของพนักงาน"
        icon={Calendar}
        backHref="/leaves"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card padding={0}>
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

        <Card padding={0}>
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

        <Card padding={0}>
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

        <Card padding={0}>
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

        <Card padding={0}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ยกเลิก</p>
                <p className="text-2xl font-bold text-gray-600 mt-1">{stats.cancelled}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl`}>
                <XCircle className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Alert */}
      {stats.pending > 0 && (
        <Alert tone="info">
          <p className="font-semibold text-orange-900">มีคำขอรออนุมัติ</p>
          <div className="text-orange-800">
            มี <strong>{stats.pending}</strong> คำขอลาที่รอการอนุมัติจากคุณ
          </div>
        </Alert>
      )}

      {/* Filters */}
      <Card padding={0}>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                                <Input
                  prefix={<User size={16} />}
                  placeholder="ค้นหาด้วยชื่อพนักงาน..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <Select value={filter} onChange={(e) => ((value: any) => setFilter(value))(e.target.value)} className="w-full md:w-48">
<option value="">สถานะ</option>
              
              
                <option value="all">ทั้งหมด</option>
                <option value="pending">รออนุมัติ</option>
                <option value="approved">อนุมัติแล้ว</option>
                <option value="rejected">ไม่อนุมัติ</option>
                <option value="cancelled">ยกเลิก</option>
              
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests List */}
      {filteredLeaves.length === 0 ? (
        <Card padding={0}>
          <CardContent className="py-16 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">ไม่พบคำขอลา</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLeaves.map((leave) => {
            const style = leaveTypeStyles[leave.type];
            return (
              <Card padding={0} key={leave.id} className={`border ${style.border} ${style.bg} hover:shadow-md transition-shadow`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Row 1: Employee Info + Type + Status */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {/* Profile Image */}
                          {leave.userAvatar ? (
                            <img
                              src={leave.userAvatar}
                              alt={leave.userName}
                              className="w-8 h-8 rounded-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center ${leave.userAvatar ? 'hidden' : ''}`}>
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                          
                          <div>
                            <span className="font-medium">{leave.userName}</span>
                          </div>
                          
                          <Pill tone="neutral" className="text-xs">
                            {LEAVE_TYPE_LABELS[leave.type]}
                          </Pill>
                          
                          {leave.urgentMultiplier > 1 && (
                            <Pill tone="danger" className="text-xs">
                              ลาด่วน x{leave.urgentMultiplier}
                            </Pill>
                          )}
                          
                          {leave.attachments && leave.attachments.length > 0 && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <FileText className="w-3.5 h-3.5" />
                              <span className="text-xs">{leave.attachments.length}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Status Badge */}
                        <Pill
                          tone={badgeTone(
                            leave.status === 'approved' ? 'success' :
                            leave.status === 'rejected' ? 'error' :
                            leave.status === 'cancelled' ? 'secondary' :
                            'warning'
                          )}
                          className="text-xs"
                        >
                          {leave.status === 'approved' && 'อนุมัติแล้ว'}
                          {leave.status === 'rejected' && 'ไม่อนุมัติ'}
                          {leave.status === 'pending' && 'รออนุมัติ'}
                          {leave.status === 'cancelled' && 'ยกเลิก'}
                        </Pill>
                      </div>
                      
                      {/* Row 2: Date + Reason */}
                      <div className="flex items-start gap-4 text-sm">
                        <div className="flex items-center gap-1 text-gray-500 min-w-fit">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {safeFormatDate(leave.startDate, 'dd/MM/yy')} - 
                            {safeFormatDate(leave.endDate, 'dd/MM/yy')}
                            <span className="font-medium ml-1">({leave.totalDays}วัน)</span>
                          </span>
                        </div>
                        <span className="text-gray-600 truncate flex-1">{leave.reason}</span>
                      </div>
                      
                      {/* Row 3: Additional Info (if any) */}
                      {(leave.status === 'rejected' || leave.status === 'cancelled') && (
                        <div className="mt-1">
                          {leave.status === 'rejected' && leave.rejectedReason && (
                            <p className="text-xs text-red-600">
                              ไม่อนุมัติ: {leave.rejectedReason}
                            </p>
                          )}
                          {leave.status === 'cancelled' && leave.cancelReason && (
                            <p className="text-xs text-gray-600">
                              ยกเลิก: {leave.cancelReason}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Actions - Compact */}
                    <div className="flex items-center gap-2">
                      {/* Action Buttons */}
                      {leave.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(leave.id!)}
 disabled={loading}
 className={`h-8 px-3 bg-gradient-to-r ${gradients.success}`}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            อนุมัติ
                          </Button>
                          <Button size="sm" variant="soft" onClick={() => handleReject(leave.id!)}
 disabled={loading}
 className="h-8 px-3">
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            ไม่อนุมัติ
                          </Button>
                        </>
                      )}
                      
                      {/* Cancel button for approved leaves (HR/Admin only) */}
                      {leave.status === 'approved' && ['hr', 'manager', 'admin'].includes(userData?.role || '') && (
                        <Button size="sm" variant="soft" onClick={() => handleCancelApproved(leave.id!)}
 disabled={loading}
 className="h-8 px-3">
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          ยกเลิก
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              ยืนยันการอนุมัติ
            </AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการอนุมัติคำขอลานี้หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedLeaveId(null)}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmApprove}
              className="bg-green-600 hover:bg-green-700"
            >
              อนุมัติ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              ไม่อนุมัติคำขอลา
            </AlertDialogTitle>
            <AlertDialogDescription>
              กรุณาระบุเหตุผลที่ไม่อนุมัติคำขอลานี้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="ระบุเหตุผล..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedLeaveId(null)
              setRejectReason('')
            }}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmReject}
              disabled={!rejectReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              ไม่อนุมัติ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Cancel Approved Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-orange-600" />
              ยกเลิกคำขอที่อนุมัติแล้ว
            </AlertDialogTitle>
            <AlertDialogDescription>
              การยกเลิกจะคืนโควต้าให้กับพนักงาน กรุณาระบุเหตุผล
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            <Textarea
              placeholder="ระบุเหตุผลที่ยกเลิก..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="min-h-[100px]"
            />
            <Alert tone="info">
              <div>
                <strong>หมายเหตุ:</strong> โควต้าจะถูกคืนให้พนักงานโดยอัตโนมัติ
              </div>
            </Alert>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedLeaveId(null)
              setCancelReason('')
            }}>
              ไม่ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmCancelApproved}
              disabled={!cancelReason.trim()}
              className="bg-orange-600 hover:bg-orange-700"
            >
              ยืนยันยกเลิก
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}