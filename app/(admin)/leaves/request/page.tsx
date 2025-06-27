'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar } from 'lucide-react';
import LeaveRequestForm from '@/components/leave/LeaveRequestForm';
import LeaveBalance from '@/components/leave/LeaveBalance';
import { useLeave } from '@/hooks/useLeave';
import { useAuth } from '@/hooks/useAuth';

export default function LeaveRequestPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const { quota, loading } = useLeave();
  const [showForm, setShowForm] = useState(true);

  const handleSuccess = () => {
    // แสดงข้อความสำเร็จ แล้วไปหน้าประวัติ
    setTimeout(() => {
      router.push('/leaves/history');
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
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
            <h1 className="text-2xl font-bold">ขอลา</h1>
            <p className="text-gray-600">กรอกแบบฟอร์มเพื่อขอลา</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Leave Balance - Sidebar */}
        <div className="md:col-span-1">
          <div className="sticky top-4">
            <LeaveBalance quota={quota} loading={loading} />
            
            {/* Quick Info */}
            <Card className="mt-4 border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  ข้อควรทราบ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-amber-600">•</span>
                  <span>ลาป่วยเกิน 2 วัน ต้องแนบใบรับรองแพทย์</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-600">•</span>
                  <span>ลากิจด่วน คิดโควต้า 2 เท่า</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-600">•</span>
                  <span>ลาพักร้อนด่วน คิดโควต้า 3 เท่า</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Leave Request Form - Main Content */}
        <div className="md:col-span-2">
          {showForm ? (
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>แบบฟอร์มขอลา</CardTitle>
                <CardDescription>
                  กรุณากรอกข้อมูลให้ครบถ้วน คำขอของคุณจะถูกส่งไปยังผู้จัดการเพื่ออนุมัติ
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LeaveRequestForm onSuccess={handleSuccess} />
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-md">
              <CardContent className="py-12 text-center">
                <div className="text-green-600 mb-4">
                  <Calendar className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold mb-2">ส่งคำขอสำเร็จ!</h3>
                <p className="text-gray-600">
                  คำขอลาของคุณถูกส่งเรียบร้อยแล้ว กำลังรอการอนุมัติ
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}