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
  Download,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useLeave } from '@/hooks/useLeave';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { LEAVE_TYPE_LABELS } from '@/types/leave';

export default function LeaveHistoryPage() {
  const router = useRouter();
  const { myLeaves, quota, loading } = useLeave();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Filter leaves based on status
  const filteredLeaves = myLeaves.filter(leave => {
    if (filter === 'all') return true;
    return leave.status === filter;
  });

  // Group leaves by year
  const leavesByYear = filteredLeaves.reduce((acc, leave) => {
    const year = new Date(leave.startDate).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(leave);
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
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; text: string }> = {
      approved: { className: 'bg-green-100 text-green-700', text: 'อนุมัติแล้ว' },
      rejected: { className: 'bg-red-100 text-red-700', text: 'ไม่อนุมัติ' },
      pending: { className: 'bg-yellow-100 text-yellow-700', text: 'รออนุมัติ' },
      cancelled: { className: 'bg-gray-100 text-gray-700', text: 'ยกเลิก' }
    };
    
    const variant = variants[status] || variants.cancelled;
    return <Badge className={variant.className}>{variant.text}</Badge>;
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
        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-emerald-900">
              ลาทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-800">
              {myLeaves.length}
            </div>
            <p className="text-sm text-emerald-700">ครั้ง</p>
          </CardContent>
        </Card>

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
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              กรองข้อมูล
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {/* Export function */}}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
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
                  .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                  .map((leave) => (
                    <div
                      key={leave.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => router.push(`/leaves/history/${leave.id}`)}
                    >
                      <div className="flex items-start gap-4">
                        {getStatusIcon(leave.status)}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-base">
                              {LEAVE_TYPE_LABELS[leave.type]}
                            </p>
                            {getStatusBadge(leave.status)}
                          </div>
                          <p className="text-sm text-gray-600">
                            {format(new Date(leave.startDate), 'dd MMM yyyy', { locale: th })} - 
                            {format(new Date(leave.endDate), 'dd MMM yyyy', { locale: th })}
                            <span className="ml-2">({leave.totalDays} วัน)</span>
                          </p>
                          <p className="text-sm text-gray-500">{leave.reason}</p>
                          {leave.status === 'rejected' && leave.rejectedReason && (
                            <p className="text-sm text-red-600">
                              เหตุผล: {leave.rejectedReason}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {format(new Date(leave.createdAt), 'dd/MM/yyyy HH:mm')}
                        </p>
                        {leave.urgentMultiplier > 1 && (
                          <Badge variant="outline" className="mt-1">
                            ลาด่วน x{leave.urgentMultiplier}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))
      )}
    </div>
  );
}