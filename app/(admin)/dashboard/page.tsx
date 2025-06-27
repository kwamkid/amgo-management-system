'use client';

import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import EmployeeSection from '@/components/dashboard/EmployeeSection';
import ManagerSection from '@/components/dashboard/ManagerSection';
import HRSection from '@/components/dashboard/HRSection';
import AdminSection from '@/components/dashboard/AdminSection';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const { userData, loading, error } = useAuth();

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="p-6">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
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