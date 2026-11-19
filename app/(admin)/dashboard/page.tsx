// app/(admin)/dashboard/page.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { hasCheckedInToday } from '@/lib/services/checkinService';
import { useRouter } from 'next/navigation';
import EmployeeSection from '@/components/dashboard/EmployeeSection';
import QuickActions from '@/components/dashboard/QuickActions';
import TodoZone from '@/components/dashboard/TodoZone';
import MyTasksZone from '@/components/dashboard/MyTasksZone';
import TeamTodoZone from '@/components/dashboard/TeamTodoZone';
import HrInbox from '@/components/dashboard/HrInbox';
import NotifySetupCard from '@/components/push/NotifySetupCard';
import ProbationZone from '@/components/dashboard/ProbationZone';
import AttendanceSection from '@/components/dashboard/AttendanceSection';
import TechLoader from '@/components/shared/TechLoader';
import { AlertCircle, LogIn, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared'
import { Alert, Button, TabBar, TabItem } from '@/components/aoo'
import { useEffect, useState } from 'react'
export default function DashboardPage() {
  const [tab, setTab] = useState('birthday')
  const { userData, loading, error } = useAuth();
  const router = useRouter();

  // เปิดแอปมา (PWA เริ่มที่ /dashboard) ยังไม่ได้เช็คอินวันนี้ → พาไปหน้าเช็คอินเลย
  // หน้านั้นอ่าน GPS เองทันที เหลือกดปุ่มเดียว (เจ้าของขอ 31 ต.ค. 69)
  // พาแค่ครั้งแรกของวันต่อการเปิดแอป (sessionStorage) — กดกลับมา Dashboard แล้วไม่เด้งซ้ำ
  // คนที่ตั้งไว้ว่า "ไม่ต้องเช็คอิน" (requiresCheckin = false เกณฑ์เดียวกับรายงานขาดงาน) ไม่พาไป
  useEffect(() => {
    if (!userData?.id || userData.requiresCheckin === false) return;
    const key = `amgo:checkin-nudge:${new Date().toDateString()}`;
    let nudged = false;
    try { nudged = sessionStorage.getItem(key) === '1'; } catch {}
    if (nudged) return;
    hasCheckedInToday(userData.id)
      .then((done) => {
        try { sessionStorage.setItem(key, '1'); } catch {}
        if (!done) router.replace('/checkin');
      })
      .catch(() => {});
  }, [userData?.id, userData?.requiresCheckin, router]);

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
    // one 16px gap between blocks (the cards used to add their own mb-5 on top of space-y-6)
    <div className="flex flex-col gap-4 [&>.aoo-page-header]:mb-0">
      {/* ยังไม่มีเครื่องไหนเปิดแจ้งเตือน — ขึ้นบนสุดจนกว่าจะกดเปิด */}
      <NotifySetupCard />

      <PageHeader
        // ทักด้วยชื่อเล่น ไม่ใช่ชื่อ LINE ที่เจ้าตัวตั้งเอง
        title={`สวัสดี ${userData.nickname || userData.fullName || 'ผู้ใช้'}`}
        description={
          userData.role === 'admin' ? 'ผู้ดูแลระบบ'
          : userData.role === 'hr' ? 'ฝ่ายบุคคล'
          : userData.role === 'manager' ? 'ผู้จัดการ'
          : 'พนักงาน'
        }
      />

      {/* 2 อย่างที่ทำบ่อยสุด — แถบเตี้ยบนสุด กดได้ทันทีตั้งแต่เปิดแอป (เจ้าของ 5 พ.ย. · 20 พ.ย. 69) */}
      <QuickActions userData={userData} />

      {/* งานของฉันที่ครบ/เลยกำหนด — ขึ้นหลังเช็คอิน (เจ้าของ 20 พ.ย. 69 "เช็คอินแล้ว เตือนเลย") */}
      <MyTasksZone />

      {/* เรื่องที่ต้องจัดการ — จอกว้างเรียงแบบ masonry 2 คอลัมน์ (กล่องเติมคอลัมน์ที่สั้นกว่า) ไม่มีอะไรค้างก็ไม่ขึ้น */}
      <div className="aoo-masonry">
        {/* เรื่องที่ยังค้างของคนที่กำลังเปิดอยู่ */}
        <TodoZone />
        {/* HR/admin: รออนุมัติ · ขาดงานวันนี้ · ข้อมูลที่ยังไม่ครบ */}
        <HrInbox />
        {/* HR/admin เห็นเพิ่มว่าต้องไปตามใครบ้าง */}
        <TeamTodoZone />
        {/* แอดมินเห็นว่าใครยังทดลองงานอยู่ ใกล้ถึงวันตัดสินหรือยัง */}
        <ProbationZone />
      </div>

      {/* ล่างสุด: วันเกิดใกล้ถึง (ปฏิทินเต็มกดเปิดเอง) · หัวหน้าเห็นการทำงานวันนี้ */}
      {isManagement ? (
        <div>
          <TabBar className="mb-4">
            <TabItem active={tab === 'birthday'} onClick={() => setTab('birthday')} label="วันเกิด" />
            <TabItem active={tab === 'attendance'} onClick={() => setTab('attendance')} label="การทำงานวันนี้" />
          </TabBar>
          {tab === 'birthday' ? <EmployeeSection userData={userData} /> : <AttendanceSection userData={userData} />}
        </div>
      ) : (
        <EmployeeSection userData={userData} />
      )}
    </div>
  );
}
