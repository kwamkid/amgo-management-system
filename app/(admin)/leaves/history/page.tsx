'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Calendar, 
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  Plus,
  Heart,
  Briefcase,
  Activity
} from 'lucide-react';
import { useLeave } from '@/hooks/useLeave';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { LEAVE_TYPE_LABELS } from '@/types/leave';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

// Leave type styling
const leaveTypeStyles = {
  sick: {
    bg: 'bg-pink-50',
    icon: <Heart className="w-4 h-4 text-pink-600" />,
    iconColor: 'text-pink-600',
    borderColor: 'border-pink-200'
  },
  personal: {
    bg: 'bg-blue-50',
    icon: <Briefcase className="w-4 h-4 text-blue-600" />,
    iconColor: 'text-blue-600',
    borderColor: 'border-blue-200'
  },
  vacation: {
    bg: 'bg-emerald-50',
    icon: <Activity className="w-4 h-4 text-emerald-600" />,
    iconColor: 'text-emerald-600',
    borderColor: 'border-emerald-200'
  }
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
    try {
      // Safely get year
      let year: number;
      if (leave.startDate instanceof Date) {
        year = leave.startDate.getFullYear();
      } else if (typeof leave.startDate === 'string' || typeof leave.startDate === 'number') {
        year = new Date(leave.startDate).getFullYear();
      } else if (leave.startDate?.seconds) {
        year = new Date(leave.startDate.seconds * 1000).getFullYear();
      } else if (leave.startDate?.toDate) {
        year = leave.startDate.toDate().getFullYear();
      } else {
        year = new Date().getFullYear(); // Default to current year
      }
      
      if (isNaN(year)) {
        year = new Date().getFullYear();
      }
      
      if (!acc[year]) acc[year] = [];
      acc[year].push(leave);
    } catch (error) {
      console.error('Error grouping leave by year:', error, leave);
      // Put in current year if error
      const currentYear = new Date().getFullYear();
      if (!acc[currentYear]) acc[currentYear] = [];
      acc[currentYear].push(leave);
    }
    return acc;
  }, {} as Record<number, typeof myLeaves>);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; text: string }> = {
      approved: { className: 'bg-green-100 text-green-700', text: 'อนุมัติแล้ว' },
      rejected: { className: 'bg-red-100 text-red-700', text: 'ไม่อนุมัติ' },
      pending: { className: 'bg-yellow-100 text-yellow-700', text: 'รออนุมัติ' },
      cancelled: { className: 'bg-gray-900 text-white', text: 'ยกเลิก' }
    };
    
    const variant = variants[status] || variants.cancelled;
    return <Badge className={variant.className}>{variant.text}</Badge>;
  };

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
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">ประวัติการลา</h1>
            <p className="text-gray-600">ดูประวัติการลาทั้งหมดของคุณ</p>
          </div>
        </div>
        
        <Button
          variant="outline"
          onClick={() => router.push('/leaves/request')}
        >
          <Calendar className="w-4 h-4 mr-2" />
          ขอลา
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-green-900">
              อนุมัติแล้ว
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">
              {myLeaves.filter(l => l.status === 'approved').length}
            </div>
            <p className="text-sm text-green-700">ครั้ง</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-yellow-50 to-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-yellow-900">
              รออนุมัติ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-800">
              {myLeaves.filter(l => l.status === 'pending').length}
            </div>
            <p className="text-sm text-yellow-700">ครั้ง</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-rose-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-red-900">
              ไม่อนุมัติ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-800">
              {myLeaves.filter(l => l.status === 'rejected').length}
            </div>
            <p className="text-sm text-red-700">ครั้ง</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-gray-50 to-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-gray-900">
              ยกเลิก
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-800">
              {myLeaves.filter(l => l.status === 'cancelled').length}
            </div>
            <p className="text-sm text-gray-700">ครั้ง</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              กรองข้อมูล
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((status) => (
              <Button
                key={status}
                variant={filter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(status as any)}
              >
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
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">กำลังโหลด...</p>
          </CardContent>
        </Card>
      ) : filteredLeaves.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">ไม่พบประวัติการลา</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(leavesByYear)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([year, leaves]) => (
            <Card key={year} className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">ปี {year}</CardTitle>
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
                    const style = leaveTypeStyles[leave.type];
                    return (
                      <div
                        key={leave.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${style.bg} ${style.borderColor} transition-colors`}
                      >
                        <div className="flex items-start gap-4 flex-1">
                          <div className="mt-1">
                            {style.icon}
                          </div>
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={`font-medium text-base ${style.iconColor}`}>
                                {LEAVE_TYPE_LABELS[leave.type]}
                              </p>
                              {getStatusBadge(leave.status)}
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
                              <Badge variant="outline" className="mt-1">
                                ลาด่วน x{leave.urgentMultiplier}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Cancel button for pending leaves */}
                          {leave.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCancelDialog(leave.id!);
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          ))
      )}
      
      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการยกเลิกคำขอลา</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการยกเลิกคำขอลานี้หรือไม่? การยกเลิกไม่สามารถแก้ไขได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ไม่ยกเลิก</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelLeave}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              ยืนยันยกเลิก
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Success Dialog */}
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              ยกเลิกคำขอลาสำเร็จ
            </AlertDialogTitle>
            <AlertDialogDescription>
              คำขอลาของคุณถูกยกเลิกเรียบร้อยแล้ว
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <p className="font-medium text-center">ต้องการยื่นคำขอลาใหม่หรือไม่?</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>ปิด</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowSuccessDialog(false);
                router.push('/leaves/request');
              }}
              className="bg-gradient-to-r from-red-500 to-rose-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              ยื่นคำขอใหม่
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}