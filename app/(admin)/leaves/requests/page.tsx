'use client';

import { useState, useEffect } from 'react';
import { Skeleton, PageHeader, StatCard, StatusBadge, statusTone, InfoPanel } from '@/components/shared'
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  User,
  AlertCircle,
  Paperclip
} from 'lucide-react';
import { useLeave } from '@/hooks/useLeave';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { LEAVE_TYPE_LABELS } from '@/types/leave';
import { getLeaveRequests } from '@/lib/services/leaveService';
import { LeaveRequest } from '@/types/leave';

import { Pill, Card, CardContent, CardHeader, CardTitle, Button, Modal, Textarea, EmptyState, useConfirm } from '@/components/aoo'
export default function LeaveRequestsPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const { approveLeave, rejectLeave, loading } = useLeave({ autoLoad: false });
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [fetching, setFetching] = useState(true);
  const { confirm, dialog } = useConfirm();
  // ใบลาที่กำลังกรอกเหตุผลไม่อนุมัติ (แทน window.prompt)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Check permission
  const canApprove = userData && ['manager', 'hr', 'admin'].includes(userData.role);

  useEffect(() => {
    if (!canApprove) {
      router.push('/dashboard');
      return;
    }

    fetchLeaveRequests();
  }, [canApprove]);

  const fetchLeaveRequests = async () => {
    try {
      setFetching(true);
      setLeaves(
        await getLeaveRequests(filter === 'all' ? undefined : { status: filter })
      );
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (canApprove) {
      fetchLeaveRequests();
    }
  }, [filter]);

  const handleApprove = async (leaveId: string) => {
    const ok = await confirm({ title: 'อนุมัติคำขอลานี้?', confirmLabel: 'อนุมัติ' });
    if (!ok) return;
    
    await approveLeave(leaveId);
    await fetchLeaveRequests();
  };

  const handleReject = (leaveId: string) => {
    setRejectReason('');
    setRejectTarget(leaveId);
  };

  const confirmReject = async () => {
    const leaveId = rejectTarget;
    const reason = rejectReason;
    if (!leaveId || !reason) return;
    setRejectTarget(null);

    await rejectLeave(leaveId, reason);
    await fetchLeaveRequests();
  };

  const getStatusIcon = (status: string) => {
    const Icon =
      status === 'approved' ? CheckCircle :
      status === 'rejected' ? XCircle :
      status === 'pending' ? Clock :
      AlertCircle;
    return (
      <span className="aoo-title-icon" data-tone={statusTone(status)}>
        <Icon size={19} strokeWidth={2} />
      </span>
    );
  };

  const stats = {
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'pending').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length
  };

  return (
    <div className="max-w-6xl p-4 space-y-6">
      <PageHeader
        title="จัดการคำขอลา"
        description="อนุมัติหรือปฏิเสธคำขอลาของพนักงาน"
        icon={Calendar}
        onBack={() => router.back()}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="ทั้งหมด" value={stats.total} unit="คำขอ" tone="plum" />
        <StatCard label="รออนุมัติ" value={stats.pending} unit="คำขอ" tone="warning" />
        <StatCard label="อนุมัติแล้ว" value={stats.approved} unit="คำขอ" tone="success" />
        <StatCard label="ไม่อนุมัติ" value={stats.rejected} unit="คำขอ" tone="danger" />
      </div>

      {/* Filter */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={Filter} tone="sky">
            กรองข้อมูล
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'approved', 'rejected'].map((status) => (
              <Button key={status} variant={filter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter(status as any)}>
                {status === 'all' && 'ทั้งหมด'}
                {status === 'pending' && 'รออนุมัติ'}
                {status === 'approved' && 'อนุมัติแล้ว'}
                {status === 'rejected' && 'ไม่อนุมัติ'}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests List */}
      {fetching ? (
        <Skeleton />
      ) : leaves.length === 0 ? (
        <Card padding={0}>
          <EmptyState icon={<Calendar size={40} />} title="ไม่พบคำขอลา" />
        </Card>
      ) : (
        <div className="space-y-4">
          {leaves.map((leave) => (
            <Card padding={0} key={leave.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    {getStatusIcon(leave.status)}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">{leave.userName}</span>
                        </div>
                        <StatusBadge status={leave.type} kind="leaveType" label={LEAVE_TYPE_LABELS[leave.type]} />
                        {leave.urgentMultiplier > 1 && (
                          <Pill tone="danger">
                            ลาด่วน x{leave.urgentMultiplier}
                          </Pill>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>
                          {format(new Date(leave.startDate), 'dd/MM/yyyy')} - 
                          {format(new Date(leave.endDate), 'dd/MM/yyyy')}
                        </span>
                        <span>({leave.totalDays} วัน)</span>
                      </div>
                      
                      <p className="text-base">{leave.reason}</p>
                      
                      {leave.attachments && leave.attachments.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-sky-600">
                          <Paperclip className="w-4 h-4" />
                          <span>มีเอกสารแนบ {leave.attachments.length} ไฟล์</span>
                        </div>
                      )}
                      
                      {leave.status === 'rejected' && leave.rejectedReason && (
                        <InfoPanel tone="danger" className="text-sm">
                          เหตุผลที่ไม่อนุมัติ: {leave.rejectedReason}
                        </InfoPanel>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-sm text-gray-500">
                      {format(new Date(leave.createdAt), 'dd/MM/yyyy HH:mm')}
                    </p>
                    
                    {leave.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button size="sm" icon="Check" onClick={() => handleApprove(leave.id!)} disabled={loading}>
                          อนุมัติ
                        </Button>
                        <Button size="sm" variant="soft" icon="X" onClick={() => handleReject(leave.id!)} disabled={loading}>
                          ไม่อนุมัติ
                        </Button>
                      </div>
                    )}
                    
                    {(leave.status === 'approved' || leave.status === 'rejected') && (
                      <StatusBadge status={leave.status} />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialog}

      {/* ไม่อนุมัติ — กรอกเหตุผล */}
      <Modal
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title="ไม่อนุมัติคำขอลา"
        description="กรุณาระบุเหตุผลที่ไม่อนุมัติ"
        maxWidth={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>ยกเลิก</Button>
            <Button variant="danger" onClick={confirmReject} disabled={!rejectReason}>
              ไม่อนุมัติ
            </Button>
          </>
        }
      >
        <Textarea
          autoFocus
          rows={3}
          placeholder="ระบุเหตุผล..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}