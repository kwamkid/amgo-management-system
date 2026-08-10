// app/(admin)/dashboard/page.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useCheckIn } from '@/hooks/useCheckIn';
import { useRouter } from 'next/navigation';
import EmployeeSection from '@/components/dashboard/EmployeeSection';
import TodoZone from '@/components/dashboard/TodoZone';
import TeamTodoZone from '@/components/dashboard/TeamTodoZone';
import AttendanceSection from '@/components/dashboard/AttendanceSection';
import TechLoader from '@/components/shared/TechLoader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, LogIn, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared'
import { Button as AooButton } from '@/components/aoo'

export default function DashboardPage() {
  const { userData, loading, error } = useAuth();
  const { currentCheckIn } = useCheckIn();
  const router = useRouter();

  if (loading) {
    return <TechLoader />;
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!userData) {
    return <TechLoader />;
  }

  const isManagement = ['manager', 'hr', 'admin'].includes(userData.role);

  return (
    <div className="space-y-6">
      {/* เรื่องที่ยังค้างของคนที่กำลังเปิดอยู่ — ไม่มีอะไรค้างก็ไม่ขึ้น */}
      <TodoZone />

      {/* HR/admin เห็นเพิ่มว่าต้องไปตามใครบ้าง */}
      <TeamTodoZone />

      <PageHeader
        // ทักด้วยชื่อเล่น ไม่ใช่ชื่อ LINE ที่เจ้าตัวตั้งเอง
        title={`สวัสดี ${userData.nickname || userData.fullName || 'ผู้ใช้'}`}
        description={
          userData.role === 'admin' ? 'ผู้ดูแลระบบ'
          : userData.role === 'hr' ? 'ฝ่ายบุคคล'
          : userData.role === 'manager' ? 'ผู้จัดการ'
          : 'พนักงาน'
        }
        actions={
          currentCheckIn ? (
            <AooButton variant="secondary" icon="CheckCircle2" onClick={() => router.push('/checkin')}>
              เช็คอินแล้ว{' '}
              {new Date(currentCheckIn.checkinTime).toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </AooButton>
          ) : (
            <AooButton icon="Clock" onClick={() => router.push('/checkin')}>
              เช็คอิน
            </AooButton>
          )
        }
      />

      {/* Tabs */}
      <Tabs defaultValue="birthday">
        <TabsList className="mb-4">
          <TabsTrigger value="birthday">ปฏิทินวันเกิด</TabsTrigger>
          {isManagement && (
            <TabsTrigger value="attendance">การทำงานวันนี้</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="birthday">
          <EmployeeSection userData={userData} />
        </TabsContent>

        {isManagement && (
          <TabsContent value="attendance">
            <AttendanceSection userData={userData} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
