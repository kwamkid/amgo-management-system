'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLeave } from '@/hooks/useLeave';
import { Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { LEAVE_TYPE_LABELS } from '@/types/leave';
import { format } from 'date-fns';

interface ManagerSectionProps {
  user: User & { role: string };
}

export default function ManagerSection({ userData }: ManagerSectionProps) {
  const { teamLeaves, myLeaves } = useLeave();
  const router = useRouter();
  
  // ดึงข้อมูลพนักงานในทีมจริง (ต้องเพิ่ม hook หรือ service)
  // const { teamMembers } = useTeam();
  
  // คำนวณสถิติจริง
  const teamStats = {
    totalTeamMembers: 0, // จะต้องดึงจาก Firestore
    presentToday: 0, // จะต้องดึงจาก check-ins วันนี้
    onLeaveToday: myLeaves.filter(leave => {
      const today = new Date();
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      return leave.status === 'approved' && today >= start && today <= end;
    }).length
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Users className="w-5 h-5" />
        การจัดการทีม
      </h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Pending Leave Requests */}
        <Card className="md:col-span-2 border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">คำขอลารอการอนุมัติ</CardTitle>
            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
              {teamLeaves.length} รายการ
            </Badge>
          </CardHeader>
          <CardContent>
            {teamLeaves.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-base">
                ไม่มีคำขอลารอการอนุมัติ
              </p>
            ) : (
              <div className="space-y-3">
                {teamLeaves.slice(0, 3).map((leave) => (
                  <div
                    key={leave.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/leave/requests/${leave.id}`)}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-base">{leave.userName}</p>
                      <p className="text-sm text-gray-600">
                        {LEAVE_TYPE_LABELS[leave.type]} • {leave.totalDays} วัน
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(leave.startDate), 'dd/MM/yyyy')} - 
                        {format(new Date(leave.endDate), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          // approveLeave(leave.id!);
                        }}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          // rejectLeave(leave.id!);
                        }}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {teamLeaves.length > 3 && (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => router.push('/leave/requests')}
                  >
                    ดูทั้งหมด ({teamLeaves.length} รายการ)
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Stats */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-slate-100">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              สถิติทีม
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-base text-gray-600">พนักงานในทีม</span>
              <span className="font-semibold text-lg">-</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base text-gray-600">มาทำงานวันนี้</span>
              <span className="font-semibold text-lg text-green-600">-</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base text-gray-600">ลาวันนี้</span>
              <span className="font-semibold text-lg text-orange-600">
                {teamStats.onLeaveToday}
              </span>
            </div>
            <div className="pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => router.push('/reports/team')}
              >
                ดูรายงานทีม
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}