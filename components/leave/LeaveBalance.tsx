// components/leave/LeaveBalance.tsx

'use client';

import React from 'react';
import { 
  Calendar, 
  Activity,
  Heart,
  Briefcase,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { LeaveQuotaYear } from '@/types/leave';
import { Progress, Alert, Pill, Card, CardContent, CardHeader, CardTitle } from '@/components/aoo'
interface LeaveBalanceProps {
  quota: LeaveQuotaYear | null;
  loading?: boolean;
}

export default function LeaveBalance({ quota, loading }: LeaveBalanceProps) {
  if (loading) {
    return (
      <Card padding={0}>
        <CardHeader>
          <div className="animate-pulse rounded-lg bg-gray-100 h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="animate-pulse rounded-lg bg-gray-100 h-20 w-full" />
          <div className="animate-pulse rounded-lg bg-gray-100 h-20 w-full" />
          <div className="animate-pulse rounded-lg bg-gray-100 h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!quota) {
  return (
    <Card padding={0}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5 text-red-600" />
          สิทธิ์การลา
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert tone="warning">
          <div>
            ยังไม่ได้รับการกำหนดโควต้าการลา กรุณาติดต่อฝ่ายบุคคล
          </div>
        </Alert>
      </CardContent>
    </Card>
  );
}

  const leaveTypes = [
    {
      type: 'sick',
      label: 'ลาป่วย',
      icon: Heart,
      color: 'from-pink-500 to-rose-600',
      bgColor: 'from-pink-50 to-rose-100',
      iconColor: 'text-pink-600',
      data: quota.sick
    },
    {
      type: 'personal',
      label: 'ลากิจ',
      icon: Briefcase,
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'from-blue-50 to-indigo-100',
      iconColor: 'text-blue-600',
      data: quota.personal
    },
    {
      type: 'vacation',
      label: 'ลาพักร้อน',
      icon: Activity,
      color: 'from-emerald-500 to-teal-600',
      bgColor: 'from-emerald-50 to-teal-100',
      iconColor: 'text-emerald-600',
      data: quota.vacation
    }
  ];

  return (
    <Card padding={0}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-red-600" />
            สิทธิ์การลาประจำปี {quota.year}
          </CardTitle>
          <Pill tone="neutral" className="font-normal">
            อัพเดท: {quota.updatedAt ? new Date(quota.updatedAt).toLocaleDateString('th-TH') : '-'}
          </Pill>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {leaveTypes.map(({ type, label, icon: Icon, color, bgColor, iconColor, data }) => {
          const percentage = data.total > 0 ? (data.used / data.total) * 100 : 0;
          
          return (
            <div 
              key={type}
              className={`p-4 rounded-lg bg-gradient-to-r ${bgColor} border border-gray-100`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 bg-white rounded-lg shadow-sm`}>
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{label}</h4>
                    <p className="text-sm text-gray-600 mt-0.5">
                      ใช้ไป {data.used} จาก {data.total} วัน
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{data.remaining}</p>
                  <p className="text-xs text-gray-500">คงเหลือ</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <Progress 
                  value={percentage} 
                  className="h-2"
                  tone={color.includes('red') || color.includes('rose') ? 'danger' : color.includes('orange') || color.includes('amber') ? 'warning' : color.includes('blue') || color.includes('indigo') ? 'info' : 'success'}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{percentage.toFixed(0)}% ใช้ไปแล้ว</span>
                  <span>{data.remaining} วันคงเหลือ</span>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Summary */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">วันลาคงเหลือทั้งหมด</span>
            </div>
            <span className="text-lg font-bold text-gray-900">
              {quota.sick.remaining + quota.personal.remaining + quota.vacation.remaining} วัน
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}