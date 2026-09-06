// app/(admin)/dashboard/page.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useCheckIn } from '@/hooks/useCheckIn';
import { useRouter } from 'next/navigation';
import EmployeeSection from '@/components/dashboard/EmployeeSection';
import TodoZone from '@/components/dashboard/TodoZone';
import TeamTodoZone from '@/components/dashboard/TeamTodoZone';
import ProbationZone from '@/components/dashboard/ProbationZone';
import AttendanceSection from '@/components/dashboard/AttendanceSection';
import TechLoader from '@/components/shared/TechLoader';
import { AlertCircle, LogIn, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared'
import { Button as AooButton, Alert, Button, TabBar, TabItem } from '@/components/aoo'
import { useState } from 'react'
export default function DashboardPage() {
  const [tab, setTab] = useState('birthday')
  const { userData, loading, error } = useAuth();
  const { currentCheckIn } = useCheckIn();
  const router = useRouter();

  if (loading) {
    return <TechLoader />;
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert tone="error">
          <div>{error}</div>
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

      {/* แอดมินเห็นว่าใครยังทดลองงาน ใกล้ถึงวันตัดสินหรือยัง */}
      <ProbationZone />

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
      <>
        <TabBar className="mb-4">
          <TabItem active={tab === 'birthday'} onClick={() => setTab('birthday')} label="ปฏิทินวันเกิด" />
          {isManagement && (
            <TabItem active={tab === 'attendance'} onClick={() => setTab('attendance')} label="การทำงานวันนี้" />
          )}
        </TabBar>

        {tab === 'birthday' && (<div>
          <EmployeeSection userData={userData} />
        </div>)}

        {isManagement && tab === 'attendance' && (
          <div>
            <AttendanceSection userData={userData} />
          </div>
        )}
      </>
    </div>
  );
}
