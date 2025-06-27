'use client';

import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import EmployeeSection from '@/components/dashboard/EmployeeSection';
import ManagerSection from '@/components/dashboard/ManagerSection';
import HRSection from '@/components/dashboard/HRSection';
import AdminSection from '@/components/dashboard/AdminSection';
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

  return (
    <DashboardLayout userData={userData}>
      {/* ทุกคนเห็น Employee Section */}
      <EmployeeSection userData={userData} />
      
      {/* Manager ขึ้นไปเห็น */}
      {['manager', 'hr', 'admin'].includes(userData.role) && (
        <ManagerSection userData={userData} />
      )}
      
      {/* HR ขึ้นไปเห็น */}
      {['hr', 'admin'].includes(userData.role) && (
        <HRSection userData={userData} />
      )}
      
      {/* Admin only */}
      {userData.role === 'admin' && (
        <AdminSection userData={userData} />
      )}
    </DashboardLayout>
  );
}