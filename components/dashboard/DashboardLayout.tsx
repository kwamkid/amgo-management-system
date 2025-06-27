'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  const getRoleBadgeVariant = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'info' | 'success'> = {
      admin: 'default',
      hr: 'info',
      manager: 'success',
      employee: 'secondary'
    };
    return variants[role] || 'secondary';
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            สวัสดี, {userData.lineDisplayName || userData.fullName || 'ผู้ใช้'} 👋
          </h1>
          <p className="text-gray-600 text-base mt-1">
            {mounted ? format(new Date(), 'EEEE d MMMM yyyy', { locale: th }) : 'กำลังโหลด...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getRoleBadgeVariant(userData.role)} className="px-4 py-1.5 text-sm">
            {getRoleLabel(userData.role)}
          </Badge>
        </div>
      </div>

      {/* Dynamic Sections */}
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}