// app/(admin)/dashboard/page.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useCheckIn } from '@/hooks/useCheckIn';
import { useRouter } from 'next/navigation';
import EmployeeSection from '@/components/dashboard/EmployeeSection';
import AttendanceSection from '@/components/dashboard/AttendanceSection';
import TechLoader from '@/components/shared/TechLoader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, LogIn, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            สวัสดี, {userData.lineDisplayName || userData.fullName || 'ผู้ใช้'} 👋
          </h1>
          <p className="text-gray-600 text-base mt-1">
            {userData.role === 'admin' ? 'ผู้ดูแลระบบ' :
             userData.role === 'hr' ? 'ฝ่ายบุคคล' :
             userData.role === 'manager' ? 'ผู้จัดการ' : 'พนักงาน'}
          </p>
        </div>

        {/* Check-in Button */}
        {currentCheckIn ? (
          <Button
            variant="outline"
            className="border-green-400 text-green-700 hover:bg-green-50 shrink-0"
            onClick={() => router.push('/checkin')}
          >
            <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
            เช็คอินแล้ว {new Date(currentCheckIn.checkinTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
          </Button>
        ) : (
          <Button
            className="bg-slate-700 hover:bg-slate-800 text-white shrink-0"
            onClick={() => router.push('/checkin')}
          >
            <LogIn className="w-4 h-4 mr-2" />
            เช็คอิน
          </Button>
        )}
      </div>

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
