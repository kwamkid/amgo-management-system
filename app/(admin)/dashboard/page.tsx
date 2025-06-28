// app/(admin)/dashboard/page.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import EmployeeSection from '@/components/dashboard/EmployeeSection';
import AttendanceSection from '@/components/dashboard/AttendanceSection';
import TechLoader from '@/components/shared/TechLoader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const { userData, loading, error } = useAuth();

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

  // Check user role
  const isManagement = ['manager', 'hr', 'admin'].includes(userData.role);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
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

      {/* Show both sections for management, only birthday for employees */}
      {isManagement ? (
        <>
          {/* Attendance Section for Management */}
          <AttendanceSection userData={userData} />
          
          {/* Birthday Calendar for Everyone */}
          <div className="mt-8">
            <EmployeeSection userData={userData} />
          </div>
        </>
      ) : (
        // Employee sees only Birthday Calendar
        <EmployeeSection userData={userData} />
      )}
    </div>
  );
}