// app/(admin)/leaves/management/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useLeave } from '@/hooks/useLeave'
import { 
  Calendar, 
  Clock, 
  CheckCircle,
  XCircle,
  FileText
} from 'lucide-react'
import TechLoader from '@/components/shared/TechLoader'
import Link from 'next/link'
import { format } from 'date-fns'
import { getLeaveRequests } from '@/lib/services/leaveService'
import { LeaveRequest, LEAVE_TYPE_LABELS } from '@/types/leave'
import { PageHeader, StatCard, StatusBadge, FilterBar, FilterSelect, UserAvatar } from '@/components/shared'
import { Textarea, Alert, Pill, Card, CardContent, Button, Modal, EmptyState } from '@/components/aoo'
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
  const { approveLeave, rejectLeave, cancelApprovedLeave, loading } = useLeave({ autoLoad: false })
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
        <Alert tone="error" title="ไม่มีสิทธิ์เข้าถึงหน้านี้">
          เฉพาะ HR, Admin และ Manager เท่านั้น
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
        <StatCard label="ทั้งหมด" value={stats.total} icon={FileText} tone="sky" />
        <StatCard label="รออนุมัติ" value={stats.pending} icon={Clock} tone="warning" />
        <StatCard label="อนุมัติแล้ว" value={stats.approved} icon={CheckCircle} tone="success" />
        <StatCard label="ไม่อนุมัติ" value={stats.rejected} icon={XCircle} tone="danger" />
        <StatCard label="ยกเลิก" value={stats.cancelled} icon={XCircle} tone="muted" />
      </div>

      {/* Pending Alert */}
      {stats.pending > 0 && (
        <Alert tone="warning" title="มีคำขอรออนุมัติ">
          มี <strong>{stats.pending}</strong> คำขอลาที่รอการอนุมัติจากคุณ
        </Alert>
      )}

      {/* Filters */}
      <FilterBar
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="ค้นหาด้วยชื่อพนักงาน..."
        sticky={false}
      >
        <FilterSelect
          label="สถานะ"
          value={filter === 'all' ? null : filter}
          options={[
            { value: 'pending', label: 'รออนุมัติ' },
            { value: 'approved', label: 'อนุมัติแล้ว' },
            { value: 'rejected', label: 'ไม่อนุมัติ' },
            { value: 'cancelled', label: 'ยกเลิก' },
          ]}
          onChange={(v) => setFilter((v ?? 'all') as typeof filter)}
        />
      </FilterBar>

      {/* Leave Requests List */}
      {filteredLeaves.length === 0 ? (
        <Card padding={0}>
          <EmptyState icon={<Calendar size={40} />} title="ไม่พบคำขอลา" />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLeaves.map((leave) => {
            return (
              <Card padding={0} key={leave.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Row 1: Employee Info + Type + Status */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={leave.userName} imageUrl={leave.userAvatar} size="sm" />
                          
                          <div>
                            <span className="font-medium">{leave.userName}</span>
                          </div>
                          
                          <StatusBadge status={leave.type} kind="leaveType" label={LEAVE_TYPE_LABELS[leave.type]} />
                          
                          {leave.urgentMultiplier > 1 && (
                            <Pill tone="danger">
                              ลาด่วน x{leave.urgentMultiplier}
                            </Pill>
                          )}
                          
                          {leave.attachments && leave.attachments.length > 0 && (
                            <div className="flex items-center gap-1 text-sky-600">
                              <FileText className="w-3.5 h-3.5" />
                              <span className="text-xs">{leave.attachments.length}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Status Badge */}
                        <StatusBadge status={leave.status} />
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
                          <Button size="sm" icon="Check" onClick={() => handleApprove(leave.id!)} disabled={loading}>
                            อนุมัติ
                          </Button>
                          <Button size="sm" variant="soft" icon="X" onClick={() => handleReject(leave.id!)} disabled={loading}>
                            ไม่อนุมัติ
                          </Button>
                        </>
                      )}
                      
                      {/* Cancel button for approved leaves (HR/Admin only) */}
                      {leave.status === 'approved' && ['hr', 'manager', 'admin'].includes(userData?.role || '') && (
                        <Button size="sm" variant="soft" icon="X" onClick={() => handleCancelApproved(leave.id!)} disabled={loading}>
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
      <Modal
        open={approveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}
        title={<span className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600" />ยืนยันการอนุมัติ</span>}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setSelectedLeaveId(null); setApproveDialogOpen(false) }}>
              ยกเลิก
            </Button>
            <Button loading={loading} onClick={async () => { await confirmApprove(); setApproveDialogOpen(false) }}>
              อนุมัติ
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">คุณต้องการอนุมัติคำขอลานี้หรือไม่?</p>
      </Modal>

      {/* Reject Dialog */}
      <Modal
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        title={<span className="flex items-center gap-2"><XCircle className="w-5 h-5 text-red-600" />ไม่อนุมัติคำขอลา</span>}
        description="กรุณาระบุเหตุผลที่ไม่อนุมัติคำขอลานี้"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setSelectedLeaveId(null); setRejectReason(''); setRejectDialogOpen(false) }}>
              ยกเลิก
            </Button>
            <Button variant="danger" loading={loading} onClick={async () => { await confirmReject(); setRejectDialogOpen(false) }} disabled={!rejectReason.trim()}>
              ไม่อนุมัติ
            </Button>
          </>
        }
      >
        <Textarea
          placeholder="ระบุเหตุผล..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          className="min-h-[100px]"
        />
      </Modal>

      {/* Cancel Approved Dialog */}
      <Modal
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        title={<span className="flex items-center gap-2"><XCircle className="w-5 h-5 text-orange-600" />ยกเลิกคำขอที่อนุมัติแล้ว</span>}
        description="การยกเลิกจะคืนโควต้าให้กับพนักงาน กรุณาระบุเหตุผล"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setSelectedLeaveId(null); setCancelReason(''); setCancelDialogOpen(false) }}>
              ไม่ยกเลิก
            </Button>
            <Button variant="danger" loading={loading} onClick={async () => { await confirmCancelApproved(); setCancelDialogOpen(false) }} disabled={!cancelReason.trim()}>
              ยืนยันยกเลิก
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Textarea
            placeholder="ระบุเหตุผลที่ยกเลิก..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="min-h-[100px]"
          />
          <Alert tone="info">
            <strong>หมายเหตุ:</strong> โควต้าจะถูกคืนให้พนักงานโดยอัตโนมัติ
          </Alert>
        </div>
      </Modal>
    </div>
  )
}