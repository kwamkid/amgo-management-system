'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Calendar, 
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  User,
  AlertCircle
} from 'lucide-react';
import { useLeave } from '@/hooks/useLeave';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { LEAVE_TYPE_LABELS } from '@/types/leave';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { LeaveRequest } from '@/types/leave';

export default function LeaveRequestsPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const { approveLeave, rejectLeave, loading } = useLeave();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [fetching, setFetching] = useState(true);

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
      let q = query(
        collection(db, 'leaves'),
        orderBy('createdAt', 'desc')
      );

      // Filter by status if not 'all'
      if (filter !== 'all') {
        q = query(q, where('status', '==', filter));
      }

      const snapshot = await getDocs(q);
      const leavesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LeaveRequest));

      setLeaves(leavesData);
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
    if (!window.confirm('อนุมัติคำขอลานี้?')) return;
    
    await approveLeave(leaveId);
    await fetchLeaveRequests();
  };

  const handleReject = async (leaveId: string) => {
    const reason = window.prompt('กรุณาระบุเหตุผลที่ไม่อนุมัติ:');
    if (!reason) return;
    
    await rejectLeave(leaveId, reason);
    await fetchLeaveRequests();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const stats = {
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'pending').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length
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
            <h1 className="text-2xl font-bold">จัดการคำขอลา</h1>
            <p className="text-gray-600">อนุมัติหรือปฏิเสธคำขอลาของพนักงาน</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-gray-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">ทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-gray-600">คำขอ</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-yellow-50 to-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-yellow-900">รออนุมัติ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-800">{stats.pending}</div>
            <p className="text-sm text-yellow-700">คำขอ</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-green-900">อนุมัติแล้ว</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">{stats.approved}</div>
            <p className="text-sm text-green-700">คำขอ</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-rose-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-red-900">ไม่อนุมัติ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-800">{stats.rejected}</div>
            <p className="text-sm text-red-700">คำขอ</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            กรองข้อมูล
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {['all', 'pending', 'approved', 'rejected'].map((status) => (
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
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests List */}
      {fetching ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">กำลังโหลด...</p>
          </CardContent>
        </Card>
      ) : leaves.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">ไม่พบคำขอลา</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {leaves.map((leave) => (
            <Card key={leave.id} className="border-0 shadow-md">
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
                        <Badge variant="outline">
                          {LEAVE_TYPE_LABELS[leave.type]}
                        </Badge>
                        {leave.urgentMultiplier > 1 && (
                          <Badge variant="error">
                            ลาด่วน x{leave.urgentMultiplier}
                          </Badge>
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
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                          <Calendar className="w-4 h-4" />
                          <span>มีเอกสารแนบ {leave.attachments.length} ไฟล์</span>
                        </div>
                      )}
                      
                      {leave.status === 'rejected' && leave.rejectedReason && (
                        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                          เหตุผลที่ไม่อนุมัติ: {leave.rejectedReason}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-sm text-gray-500">
                      {format(new Date(leave.createdAt), 'dd/MM/yyyy HH:mm')}
                    </p>
                    
                    {leave.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handleApprove(leave.id!)}
                          disabled={loading}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          อนุมัติ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleReject(leave.id!)}
                          disabled={loading}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          ไม่อนุมัติ
                        </Button>
                      </div>
                    )}
                    
                    {leave.status === 'approved' && (
                      <Badge className="bg-green-100 text-green-700">
                        อนุมัติแล้ว
                      </Badge>
                    )}
                    
                    {leave.status === 'rejected' && (
                      <Badge className="bg-red-100 text-red-700">
                        ไม่อนุมัติ
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}