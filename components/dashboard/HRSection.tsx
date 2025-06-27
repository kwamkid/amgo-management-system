'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  UserCheck, 
  AlertCircle, 
  Calendar,
  FileText,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UserData } from '@/hooks/useAuth';
import { useUsers } from '@/hooks/useUsers';
import { useLeave } from '@/hooks/useLeave';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { format } from 'date-fns';

interface HRSectionProps {
  userData: UserData;
}

export default function HRSection({ userData }: HRSectionProps) {
  const router = useRouter();
  const { users } = useUsers();
  const { teamLeaves } = useLeave();
  const [todayStats, setTodayStats] = useState({
    present: 0,
    onLeave: 0,
    pendingCheckouts: 0
  });

  // ดึงข้อมูลการเช็คอินวันนี้
  useEffect(() => {
    const fetchTodayStats = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Query check-ins for today
      const checkinsRef = collection(db, 'checkins');
      const q = query(
        checkinsRef,
        where('checkinTime', '>=', today)
      );
      
      const snapshot = await getDocs(q);
      const todayCheckins = snapshot.docs.map(doc => doc.data());
      
      // นับคนที่เช็คอินแล้ว
      const presentCount = todayCheckins.length;
      
      // นับคนที่ลืมเช็คเอาท์
      const pendingCount = todayCheckins.filter(
        checkin => !checkin.checkoutTime
      ).length;
      
      setTodayStats({
        present: presentCount,
        onLeave: 0, // จะต้องดึงจาก leaves collection
        pendingCheckouts: pendingCount
      });
    };

    fetchTodayStats();
  }, []);

  // คำนวณสถิติจริง
  const stats = {
    totalEmployees: users.filter(u => u.isActive).length,
    presentToday: todayStats.present,
    onLeave: todayStats.onLeave,
    pendingApprovals: teamLeaves.filter(l => l.status === 'pending').length,
    pendingCheckouts: todayStats.pendingCheckouts,
    needsApproval: users.filter(u => u.needsApproval).length
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Users className="w-5 h-5" />
        ภาพรวมบริษัท
      </h2>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-emerald-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-emerald-900">
              พนักงานทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-800">{stats.totalEmployees}</div>
            <p className="text-base text-emerald-700 mt-1">
              Active ทั้งหมด
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-teal-50 to-cyan-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-teal-900">
              มาทำงานวันนี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-teal-800">
              {stats.presentToday}
            </div>
            <p className="text-base text-teal-700 mt-1">
              {stats.totalEmployees > 0 
                ? `${Math.round((stats.presentToday / stats.totalEmployees) * 100)}% ของทั้งหมด`
                : '-'
              }
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-amber-900">
              รอดำเนินการ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-3xl font-bold text-amber-800">{stats.pendingApprovals}</div>
                <p className="text-base text-amber-700">คำขอลา</p>
              </div>
              <div className="border-l border-amber-300 pl-4">
                <div className="text-2xl font-bold text-orange-800">{stats.pendingCheckouts}</div>
                <p className="text-base text-orange-700">ลืมเช็คเอาท์</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-rose-50 to-pink-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-rose-900">
              รออนุมัติ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-800">
              {stats.needsApproval}
            </div>
            <p className="text-base text-rose-700 mt-1">
              พนักงานใหม่
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-slate-100">
          <CardHeader>
            <CardTitle className="text-lg">การจัดการด่วน</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={stats.pendingApprovals > 0 ? "default" : "outline"}
                className="justify-start h-12"
                onClick={() => router.push('/leave/requests')}
              >
                <Calendar className="w-4 h-4 mr-2" />
                อนุมัติการลา
                {stats.pendingApprovals > 0 && (
                  <Badge className="ml-auto bg-red-500 text-white">
                    {stats.pendingApprovals}
                  </Badge>
                )}
              </Button>
              
              <Button
                variant={stats.pendingCheckouts > 0 ? "default" : "outline"}
                className="justify-start h-12"
                onClick={() => router.push('/checkin/pending')}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                ตรวจเวลา
                {stats.pendingCheckouts > 0 && (
                  <Badge className="ml-auto bg-orange-500 text-white">
                    {stats.pendingCheckouts}
                  </Badge>
                )}
              </Button>
              
              <Button
                variant={stats.needsApproval > 0 ? "default" : "outline"}
                className="justify-start h-12"
                onClick={() => router.push('/employees/pending')}
              >
                <Users className="w-4 h-4 mr-2" />
                พนักงานใหม่
                {stats.needsApproval > 0 && (
                  <Badge className="ml-auto bg-purple-500 text-white">
                    {stats.needsApproval}
                  </Badge>
                )}
              </Button>
              
              <Button
                variant="outline"
                className="justify-start h-12"
                onClick={() => router.push('/leave/quotas')}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                จัดการโควต้า
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Today's Activities */}
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">กิจกรรมวันนี้</CardTitle>
            <Badge variant="outline" className="font-normal">
              {format(new Date(), 'dd/MM/yyyy')}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {teamLeaves.slice(0, 3).map((leave, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 shrink-0"></div>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-base">{leave.userName} ขอลา{leave.type === 'sick' ? 'ป่วย' : leave.type === 'personal' ? 'กิจ' : 'พักร้อน'}</p>
                    <p className="text-base text-gray-600">
                      {format(new Date(leave.startDate), 'dd/MM')} - {format(new Date(leave.endDate), 'dd/MM')} 
                      ({leave.totalDays} วัน)
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-sm"
                    onClick={() => router.push(`/leave/requests/${leave.id}`)}
                  >
                    ดู
                  </Button>
                </div>
              ))}
              
              {teamLeaves.length === 0 && (
                <p className="text-center text-gray-500 py-4 text-base">
                  ไม่มีกิจกรรมใหม่
                </p>
              )}
              
              {teamLeaves.length > 3 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => router.push('/leave/requests')}
                >
                  ดูทั้งหมด ({teamLeaves.length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Section */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-gray-50 to-gray-100">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            รายงาน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-20 flex-col gap-2 bg-white hover:bg-gray-50"
              onClick={() => router.push('/reports/attendance')}
            >
              <Clock className="w-6 h-6 text-slate-600" />
              <span className="text-base">รายงานการมาทำงาน</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-20 flex-col gap-2 bg-white hover:bg-gray-50"
              onClick={() => router.push('/reports/leave')}
            >
              <Calendar className="w-6 h-6 text-emerald-600" />
              <span className="text-base">รายงานการลา</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-20 flex-col gap-2 bg-white hover:bg-gray-50"
              onClick={() => router.push('/reports/overtime')}
            >
              <TrendingUp className="w-6 h-6 text-purple-600" />
              <span className="text-base">รายงาน OT</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-20 flex-col gap-2 bg-white hover:bg-gray-50"
              onClick={() => router.push('/reports/export')}
            >
              <FileText className="w-6 h-6 text-orange-600" />
              <span className="text-base">Export ข้อมูล</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}