'use client';

import { useState } from 'react';
import { Button as AooButton, Pill, Card, CardContent, CardHeader, CardTitle, Button, IconButton, Modal, EmptyState, type PillTone } from '@/components/aoo'
import { Skeleton, PageHeader, StatCard, StatusBadge, InfoPanel } from '@/components/shared'
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  Filter,
  Clock,
  CheckCircle,
  Trash2,
  Heart,
  Briefcase,
  Activity
} from 'lucide-react';
import { useLeave } from '@/hooks/useLeave';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { LEAVE_TYPE_LABELS } from '@/types/leave';
import { toDate } from '@/lib/utils/date'


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
    } else if (date?.toDate && typeof date.toDate === 'function') {
      // Firestore Timestamp with toDate method
      dateObj = date.toDate()
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

// ไอคอน + สีตามประเภทลา (ตรงกับ StatusBadge kind="leaveType")
const leaveTypeStyles: Record<string, { icon: typeof Heart; tone: PillTone }> = {
  sick: { icon: Heart, tone: 'pink' },
  personal: { icon: Briefcase, tone: 'sky' },
  vacation: { icon: Activity, tone: 'success' },
};

export default function LeaveHistoryPage() {
  const router = useRouter();
  const { myLeaves, quota, loading, cancelLeave } = useLeave();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>('all');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // Filter leaves based on status
  const filteredLeaves = myLeaves.filter(leave => {
    if (filter === 'all') return true;
    return leave.status === filter;
  });

  // Group leaves by year safely
  const leavesByYear = filteredLeaves.reduce((acc, leave) => {
    const date = toDate(leave.startDate);
    const year = date ? date.getFullYear() : new Date().getFullYear();
    
    if (!acc[year]) acc[year] = [];
    acc[year].push(leave);
    return acc;
  }, {} as Record<number, typeof myLeaves>);

  const handleCancelLeave = async () => {
    if (!selectedLeaveId) return;
    
    await cancelLeave(selectedLeaveId);
    setCancelDialogOpen(false);
    setSelectedLeaveId(null);
    setShowSuccessDialog(true);
  };

  const openCancelDialog = (leaveId: string) => {
    setSelectedLeaveId(leaveId);
    setCancelDialogOpen(true);
  };

  return (
    <div className="max-w-6xl p-4 space-y-6">
      <PageHeader
        title="ประวัติการลา"
        description="ดูประวัติการลาทั้งหมดของคุณ"
        icon={Clock}
        onBack={() => router.back()}
        actions={
          <AooButton size="sm" icon="Plus" onClick={() => router.push('/leaves/request')}>
            ขอลา
          </AooButton>
        }
      />

      {/* Stats Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="อนุมัติแล้ว" value={myLeaves.filter(l => l.status === 'approved').length} unit="ครั้ง" tone="success" />
        <StatCard label="รออนุมัติ" value={myLeaves.filter(l => l.status === 'pending').length} unit="ครั้ง" tone="warning" />
        <StatCard label="ไม่อนุมัติ" value={myLeaves.filter(l => l.status === 'rejected').length} unit="ครั้ง" tone="danger" />
        <StatCard label="ยกเลิก" value={myLeaves.filter(l => l.status === 'cancelled').length} unit="ครั้ง" tone="muted" />
      </div>

      {/* Filters */}
      <Card padding={0}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle icon={Filter} tone="sky">
              กรองข้อมูล
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((status) => (
              <Button key={status} variant={filter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter(status as any)}>
                {status === 'all' && 'ทั้งหมด'}
                {status === 'pending' && 'รออนุมัติ'}
                {status === 'approved' && 'อนุมัติแล้ว'}
                {status === 'rejected' && 'ไม่อนุมัติ'}
                {status === 'cancelled' && 'ยกเลิก'}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leave History List */}
      {loading ? (
        <Skeleton />
      ) : filteredLeaves.length === 0 ? (
        <Card padding={0}>
          <EmptyState icon={<Calendar size={40} />} title="ไม่พบประวัติการลา" />
        </Card>
      ) : (
        Object.entries(leavesByYear)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([year, leaves]) => (
            <Card padding={0} key={year}>
              <CardHeader>
                <CardTitle icon={Calendar} tone="accent">ปี {year}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {leaves
                  .sort((a, b) => {
                    // Safely sort by date
                    try {
                      const dateA = a.startDate instanceof Date ? a.startDate : new Date(a.startDate);
                      const dateB = b.startDate instanceof Date ? b.startDate : new Date(b.startDate);
                      return dateB.getTime() - dateA.getTime();
                    } catch {
                      return 0;
                    }
                  })
                  .map((leave) => {
                    const style = leaveTypeStyles[leave.type] ?? leaveTypeStyles.personal;
                    const TypeIcon = style.icon;
                    return (
                      <InfoPanel
                        key={leave.id}
                        tone={style.tone}
                        className="flex items-center justify-between p-4"
                      >
                        <div className="flex items-start gap-4 flex-1">
                          <span className="aoo-title-icon" data-tone={style.tone}>
                            <TypeIcon size={17} strokeWidth={2} />
                          </span>
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-base text-gray-900">
                                {LEAVE_TYPE_LABELS[leave.type]}
                              </p>
                              <StatusBadge status={leave.status} />
                            </div>
                            <p className="text-sm text-gray-600">
                              {safeFormatDate(leave.startDate, 'dd MMM yyyy', { locale: th })} - 
                              {safeFormatDate(leave.endDate, 'dd MMM yyyy', { locale: th })}
                              <span className="ml-2">({leave.totalDays} วัน)</span>
                            </p>
                            <p className="text-sm text-gray-500">{leave.reason}</p>
                            {leave.status === 'rejected' && leave.rejectedReason && (
                              <p className="text-sm text-red-600">
                                เหตุผล: {leave.rejectedReason}
                              </p>
                            )}
                            {leave.status === 'cancelled' && leave.cancelReason && (
                              <p className="text-sm text-gray-600">
                                ยกเลิกเมื่อ: {safeFormatDate(leave.cancelledAt, 'dd/MM/yyyy HH:mm')}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm text-gray-500">
                              {safeFormatDate(leave.createdAt, 'dd/MM/yyyy HH:mm')}
                            </p>
                            {leave.urgentMultiplier > 1 && (
                              <Pill tone="warning" className="mt-1">
                                ลาด่วน x{leave.urgentMultiplier}
                              </Pill>
                            )}
                          </div>
                          
                          {/* Cancel button for pending leaves */}
                          {leave.status === 'pending' && (
                            <IconButton
                              icon={Trash2}
                              tone="danger"
                              title="ยกเลิกคำขอลา"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCancelDialog(leave.id!);
                              }}
                            />
                          )}
                        </div>
                      </InfoPanel>
                    );
                  })}
              </CardContent>
            </Card>
          ))
      )}
      
      {/* Cancel Dialog */}
      <Modal
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        title="ยืนยันการยกเลิกคำขอลา"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelDialogOpen(false)}>ไม่ยกเลิก</Button>
            <Button variant="danger" onClick={async () => { await handleCancelLeave(); setCancelDialogOpen(false) }}>
              ยืนยันยกเลิก
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">คุณต้องการยกเลิกคำขอลานี้หรือไม่? การยกเลิกไม่สามารถแก้ไขได้</p>
      </Modal>
      
      {/* Success Dialog */}
      <Modal
        open={showSuccessDialog}
        onClose={() => setShowSuccessDialog(false)}
        title={<span className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600" />ยกเลิกคำขอลาสำเร็จ</span>}
        description="คำขอลาของคุณถูกยกเลิกเรียบร้อยแล้ว"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSuccessDialog(false)}>ปิด</Button>
            <Button
              icon="Plus"
              onClick={() => {
                setShowSuccessDialog(false);
                router.push('/leaves/request');
              }}
            >
              ยื่นคำขอใหม่
            </Button>
          </>
        }
      >
        <p className="font-medium text-center">ต้องการยื่นคำขอลาใหม่หรือไม่?</p>
      </Modal>
    </div>
  );
}