'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar, 
  Briefcase, 
  Heart, 
  Plus,
  Clock,
  AlertCircle
} from 'lucide-react';
import { LeaveQuotaYear, LEAVE_TYPE_LABELS } from '@/types/leave';
import { useRouter } from 'next/navigation';

interface LeaveBalanceProps {
  quota: LeaveQuotaYear | null;
  loading?: boolean;
}

export default function LeaveBalance({ quota, loading }: LeaveBalanceProps) {
  const router = useRouter();

  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-2 bg-gray-200 rounded"></div>
            <div className="h-2 bg-gray-200 rounded"></div>
            <div className="h-2 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!quota) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            <p className="text-base">ไม่พบข้อมูลโควต้าการลา</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const leaveTypes = [
    {
      type: 'sick' as const,
      icon: Heart,
      color: 'from-red-400 to-red-600',
      bgColor: 'bg-red-50',
      progressColor: 'bg-red-500'
    },
    {
      type: 'personal' as const,
      icon: Briefcase,
      color: 'from-blue-400 to-blue-600',
      bgColor: 'bg-blue-50',
      progressColor: 'bg-blue-500'
    },
    {
      type: 'vacation' as const,
      icon: Calendar,
      color: 'from-green-400 to-green-600',
      bgColor: 'bg-green-50',
      progressColor: 'bg-green-500'
    }
  ];

  return (
    <Card className="border-0 shadow-md overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-600 to-gray-700 text-white">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Clock className="w-5 h-5" />
            วันลาคงเหลือ
          </CardTitle>
          <Button
            size="sm"
            onClick={() => router.push('/leave/request')}
            className="gap-1 bg-white text-slate-700 hover:bg-gray-100"
          >
            <Plus className="w-4 h-4" />
            ขอลา
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {leaveTypes.map(({ type, icon: Icon, color, bgColor, progressColor }) => {
          const data = quota[type];
          const percentage = data.total > 0 ? (data.used / data.total) * 100 : 0;
          
          return (
            <div key={type} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg bg-gradient-to-br ${color} text-white`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-base font-medium">
                      {LEAVE_TYPE_LABELS[type]}
                    </span>
                    <p className="text-sm text-gray-500">
                      ใช้ไป {data.used} จาก {data.total} วัน
                    </p>
                  </div>
                </div>
                <span className="text-lg font-bold text-gray-700">
                  {data.remaining}
                </span>
              </div>
              
              <div className="relative">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${progressColor} transition-all duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}