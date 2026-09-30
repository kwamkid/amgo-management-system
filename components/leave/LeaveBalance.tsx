// components/leave/LeaveBalance.tsx

'use client';

import React from 'react';
import { 
  Calendar, 
  Activity,
  Heart,
  Briefcase,
  TrendingUp
} from 'lucide-react';
import { LeaveQuotaYear } from '@/types/leave';
import { Progress, Alert, Pill, Card, CardContent, CardHeader, CardTitle, type PillTone, type ProgressTone } from '@/components/aoo'
import InfoPanel from '@/components/shared/InfoPanel'
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
        <CardTitle icon={Calendar} tone="accent">
          สิทธิ์การลา
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert tone="warning">
          ยังไม่ได้รับการกำหนดโควต้าการลา กรุณาติดต่อฝ่ายบุคคล
        </Alert>
      </CardContent>
    </Card>
  );
}

  // สีตามประเภทลา (ตรงกับ StatusBadge kind="leaveType")
  const leaveTypes: { type: string; label: string; icon: typeof Heart; tone: PillTone; bar: ProgressTone; data: typeof quota.sick }[] = [
    { type: 'sick', label: 'ลาป่วย', icon: Heart, tone: 'pink', bar: 'danger', data: quota.sick },
    { type: 'personal', label: 'ลากิจ', icon: Briefcase, tone: 'sky', bar: 'info', data: quota.personal },
    { type: 'vacation', label: 'ลาพักร้อน', icon: Activity, tone: 'success', bar: 'success', data: quota.vacation },
  ];

  return (
    <Card padding={0}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle icon={Calendar} tone="accent">
            สิทธิ์การลาประจำปี {quota.year}
          </CardTitle>
          <Pill tone="neutral">
            อัพเดท: {quota.updatedAt ? new Date(quota.updatedAt).toLocaleDateString('th-TH') : '-'}
          </Pill>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {leaveTypes.map(({ type, label, icon: Icon, tone, bar, data }) => {
          const percentage = data.total > 0 ? (data.used / data.total) * 100 : 0;
          
          return (
            <InfoPanel key={type} tone={tone} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="aoo-title-icon" data-tone={tone}>
                    <Icon size={19} strokeWidth={2} />
                  </span>
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
                  tone={bar}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{percentage.toFixed(0)}% ใช้ไปแล้ว</span>
                  <span>{data.remaining} วันคงเหลือ</span>
                </div>
              </div>
            </InfoPanel>
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