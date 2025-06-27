'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Database, 
  Shield, 
  Activity,
  HardDrive,
  Users,
  MapPin,
  Bell,
  Calendar,
  Download,
  AlertTriangle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UserData } from '@/hooks/useAuth';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

interface AdminSectionProps {
  userData: UserData;
}

export default function AdminSection({ userData }: AdminSectionProps) {
  const router = useRouter();
  const [systemStats, setSystemStats] = useState({
    totalDocuments: 0,
    storageUsed: 0,
    activeUsers: 0,
    locations: 0,
    todayRequests: 0
  });

  useEffect(() => {
    const fetchSystemStats = async () => {
      try {
        // นับจำนวน documents
        const collections = ['users', 'checkins', 'leaves', 'locations'];
        let totalDocs = 0;
        
        for (const col of collections) {
          const snapshot = await getDocs(collection(db, col));
          totalDocs += snapshot.size;
        }

        // นับ active users (login ใน 7 วันล่าสุด)
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const activeCount = usersSnapshot.docs.filter(doc => {
          const userData = doc.data();
          return userData.lastLoginAt && new Date(userData.lastLoginAt.toDate()) > sevenDaysAgo;
        }).length;

        // นับ locations
        const locationsSnapshot = await getDocs(collection(db, 'locations'));

        setSystemStats({
          totalDocuments: totalDocs,
          storageUsed: totalDocs * 0.001, // ประมาณการ 1KB per doc
          activeUsers: activeCount,
          locations: locationsSnapshot.size,
          todayRequests: Math.floor(totalDocs * 0.1) // ประมาณการ
        });
      } catch (error) {
        console.error('Error fetching system stats:', error);
      }
    };

    fetchSystemStats();
  }, []);

  // คำนวณ usage percentages
  const storagePercentage = (systemStats.storageUsed / 5) * 100; // 5GB limit
  const requestPercentage = (systemStats.todayRequests / 50000) * 100; // 50k daily limit

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Shield className="w-5 h-5 text-red-600" />
        การจัดการระบบ
      </h2>

      {/* System Health */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-md bg-gradient-to-br from-violet-50 to-purple-100">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-violet-600" />
              พื้นที่จัดเก็บ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-base">
              <span className="text-gray-600">ใช้ไป</span>
              <span className="font-medium">{systemStats.storageUsed.toFixed(2)} MB / 5 GB</span>
            </div>
            <div className="space-y-1">
              <Progress 
                value={storagePercentage} 
                className="h-2"
                indicatorClassName="bg-gradient-to-r from-violet-500 to-purple-600"
              />
              <p className="text-sm text-gray-500">
                {storagePercentage.toFixed(1)}% ของโควต้า
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-cyan-50 to-teal-100">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-600" />
              Database Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-base">
              <span className="text-gray-600">Documents</span>
              <span className="font-medium">{systemStats.totalDocuments.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-gray-600">Requests วันนี้</span>
              <span className="font-medium">{systemStats.todayRequests.toLocaleString()}</span>
            </div>
            <div className="space-y-1">
              <Progress 
                value={requestPercentage} 
                className="h-2"
                indicatorClassName="bg-gradient-to-r from-cyan-500 to-teal-600"
              />
              <p className="text-sm text-gray-500">
                {requestPercentage.toFixed(1)}% ของ limit
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-green-100">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              System Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-base text-gray-600">Active Users</span>
              <span className="text-lg font-bold text-emerald-700">{systemStats.activeUsers}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base text-gray-600">Locations</span>
              <span className="text-lg font-bold text-green-700">{systemStats.locations}</span>
            </div>
            <p className="text-sm text-gray-500 pt-2 border-t">
              ใน 7 วันล่าสุด
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Actions */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-orange-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-5 h-5" />
            การดำเนินการสำคัญ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="justify-start h-12 border-red-200 hover:bg-red-50 hover:border-red-300"
              onClick={() => router.push('/settings/backup')}
            >
              <Download className="w-4 h-4 mr-2 text-red-600" />
              Backup ข้อมูล
            </Button>
            
            <Button
              variant="outline"
              className="justify-start h-12 border-orange-200 hover:bg-orange-50 hover:border-orange-300"
              onClick={() => router.push('/settings/permissions')}
            >
              <Shield className="w-4 h-4 mr-2 text-orange-600" />
              จัดการสิทธิ์
            </Button>
            
            <Button
              variant="outline"
              className="justify-start h-12 border-amber-200 hover:bg-amber-50 hover:border-amber-300"
              onClick={() => router.push('/logs')}
            >
              <Activity className="w-4 h-4 mr-2 text-amber-600" />
              ดู System Logs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Configuration */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-gradient-to-r from-slate-100 to-gray-200">
            <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
              <Settings className="w-5 h-5" />
              ตั้งค่าระบบ
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              <Button
                variant="ghost"
                className="w-full justify-start h-14 rounded-none hover:bg-gray-50"
                onClick={() => router.push('/settings/locations')}
              >
                <MapPin className="w-5 h-5 mr-3 text-slate-600" />
                <div className="text-left">
                  <p className="font-medium text-base">จัดการสถานที่</p>
                  <p className="text-sm text-gray-500">{systemStats.locations} สาขา</p>
                </div>
              </Button>
              
              <Button
                variant="ghost"
                className="w-full justify-start h-14 rounded-none hover:bg-gray-50"
                onClick={() => router.push('/settings/discord')}
              >
                <Bell className="w-5 h-5 mr-3 text-purple-600" />
                <div className="text-left">
                  <p className="font-medium text-base">Discord Integration</p>
                  <p className="text-sm text-gray-500">การแจ้งเตือน</p>
                </div>
              </Button>
              
              <Button
                variant="ghost"
                className="w-full justify-start h-14 rounded-none hover:bg-gray-50"
                onClick={() => router.push('/settings/holidays')}
              >
                <Calendar className="w-5 h-5 mr-3 text-red-600" />
                <div className="text-left">
                  <p className="font-medium text-base">วันหยุดประจำปี</p>
                  <p className="text-sm text-gray-500">ปี 2025</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Database Info */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-gray-100">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5 text-slate-600" />
              ข้อมูลระบบ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-base font-medium">Firebase Project</span>
                <span className="text-base text-gray-600">amgo-system</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-base font-medium">Environment</span>
                <Badge variant="success">Production</Badge>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-base font-medium">Last Backup</span>
                <span className="text-base text-gray-600">ยังไม่มีข้อมูล</span>
              </div>
            </div>
            
            <Button 
              className="w-full bg-slate-600 hover:bg-slate-700 text-white"
              onClick={() => router.push('/settings')}
            >
              จัดการทั้งหมด
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}