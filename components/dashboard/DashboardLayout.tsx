'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { UserData } from '@/hooks/useAuth';

interface DashboardLayoutProps {
  children: React.ReactNode;
  userData: UserData;
}

export default function DashboardLayout({ children, userData }: DashboardLayoutProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      employee: 'พนักงาน',
      manager: 'ผู้จัดการ',
      hr: 'ฝ่ายบุคคล',
      admin: 'ผู้ดูแลระบบ'
    };
    return labels[role] || role;
  };

  // Guard clause - ถ้าไม่มี userData ให้ return null
  if (!userData) {
    return null;
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            สวัสดี, {userData.lineDisplayName || userData.fullName || 'ผู้ใช้'} 👋
          </h1>
          <p className="text-gray-600">
            {mounted ? format(new Date(), 'EEEE d MMMM yyyy', { locale: th }) : 'กำลังโหลด...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
            {getRoleLabel(userData.role)}
          </span>
        </div>
      </div>

      {/* Dynamic Sections */}
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}