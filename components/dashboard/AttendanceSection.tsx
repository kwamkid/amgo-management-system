// components/dashboard/AttendanceSection.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  Loader2,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import { UserData } from '@/hooks/useAuth';
import { CheckInRecord } from '@/types/checkin';
import { User } from '@/types/user';
import { getDailySummary, getCheckInRecords } from '@/lib/services/checkinService';
import { getUsers } from '@/lib/services/userService';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { safeFormatDate } from '@/lib/utils/date';
import { useRouter } from 'next/navigation';

interface AttendanceSectionProps {
  userData: UserData;
}

interface AttendanceData {
  checkedIn: User[]
  notCheckedIn: User[]
  records: Record<string, CheckInRecord>
}

export default function AttendanceSection({ userData }: AttendanceSectionProps) {
  const router = useRouter();
  const [attendanceData, setAttendanceData] = useState<AttendanceData>({
    checkedIn: [],
    notCheckedIn: [],
    records: {}
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch attendance data
  const fetchAttendanceData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Get all active users
      const { users: allUsers } = await getUsers(100, undefined, { isActive: true });
      
      // Get today's check-in records
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const { records } = await getCheckInRecords({ date: dateStr }, 1000);
      
      // Create record map by userId
      const recordMap: Record<string, CheckInRecord> = {};
      records.forEach(record => {
        if (!recordMap[record.userId] || 
            new Date(record.checkinTime) > new Date(recordMap[record.userId].checkinTime)) {
          recordMap[record.userId] = record;
        }
      });
      
      // Categorize users
      const checkedIn: User[] = [];
      const notCheckedIn: User[] = [];
      
      allUsers.forEach(user => {
        const record = recordMap[user.id!];
        
        if (record) {
          checkedIn.push(user);
        } else {
          notCheckedIn.push(user);
        }
      });
      
      setAttendanceData({
        checkedIn,
        notCheckedIn,
        records: recordMap
      });
      
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  const formatTime = (date: any) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return format(d, 'HH:mm');
  };

  const getShiftBadge = (record: CheckInRecord) => {
    if (!record.selectedShiftName) return null;
    
    const shiftColors = {
      'กะเช้า': 'bg-blue-100 text-blue-700',
      'กะบ่าย': 'bg-purple-100 text-purple-700',
      'กะดึก': 'bg-gray-700 text-white'
    };
    
    return (
      <Badge className={`text-xs ${shiftColors[record.selectedShiftName] || 'bg-gray-100 text-gray-700'}`}>
        {record.selectedShiftName}
      </Badge>
    );
  };

  const totalEmployees = attendanceData.checkedIn.length + attendanceData.notCheckedIn.length;
  const lateCount = Object.values(attendanceData.records).filter(r => r.isLate).length;
  const workingCount = Object.values(attendanceData.records).filter(r => r.status === 'checked-in').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-red-600" />
            สถานะพนักงานวันนี้
          </h2>
          <p className="text-gray-600 mt-1">
            {format(new Date(), 'EEEE dd MMMM yyyy', { locale: th })}
          </p>
        </div>
        
        <Button
          onClick={() => fetchAttendanceData(true)}
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="ml-2">รีเฟรช</span>
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">พนักงานทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
                <p className="text-xs text-gray-500">คน</p>
              </div>
              <Users className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">มาทำงานแล้ว</p>
                <p className="text-2xl font-bold text-teal-600">{attendanceData.checkedIn.length}</p>
                <p className="text-xs text-gray-500">จาก {totalEmployees} คน</p>
              </div>
              <CheckCircle className="w-8 h-8 text-teal-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">กำลังทำงาน</p>
                <p className="text-2xl font-bold text-blue-600">{workingCount}</p>
                <p className="text-xs text-gray-500">ยังไม่เช็คเอาท์</p>
              </div>
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ยังไม่มา</p>
                <p className="text-2xl font-bold text-red-600">{attendanceData.notCheckedIn.length}</p>
                <p className="text-xs text-gray-500">คน</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">มาสาย</p>
                <p className="text-2xl font-bold text-orange-600">{lateCount}</p>
                <p className="text-xs text-gray-500">คน</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - 2 Columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Checked In */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-gradient-to-r from-teal-50 to-emerald-50">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-teal-600" />
              เช็คอินแล้ว ({attendanceData.checkedIn.length} คน)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 max-h-[600px] overflow-y-auto">
            {attendanceData.checkedIn.length === 0 ? (
              <p className="text-center text-gray-500 py-8">ยังไม่มีพนักงานเช็คอิน</p>
            ) : (
              <div className="space-y-3">
                {attendanceData.checkedIn.map(user => {
                  const record = attendanceData.records[user.id!];
                  const isWorking = record.status === 'checked-in';
                  const workingHours = record.checkinTime ? 
                    Math.floor((Date.now() - new Date(record.checkinTime).getTime()) / (1000 * 60 * 60)) : 0;
                  
                  return (
                    <div 
                      key={user.id} 
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/employees/${user.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={user.linePictureUrl || '/avatar-placeholder.png'}
                          alt={user.fullName}
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <p className="font-medium">{user.fullName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="flex items-center gap-1 text-sm text-gray-600">
                              <LogIn className="w-3.5 h-3.5" />
                              {formatTime(record.checkinTime)}
                            </span>
                            {record.checkoutTime && (
                              <span className="flex items-center gap-1 text-sm text-gray-600">
                                <LogOut className="w-3.5 h-3.5" />
                                {formatTime(record.checkoutTime)}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-sm text-gray-600">
                              <MapPin className="w-3.5 h-3.5" />
                              {record.primaryLocationName || 'นอกสถานที่'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getShiftBadge(record)}
                        {record.isLate && (
                          <Badge variant="error" className="text-xs">
                            สาย {record.lateMinutes} นาที
                          </Badge>
                        )}
                        {isWorking ? (
                          <Badge variant="success" className="text-xs">
                            {workingHours} ชม.
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {record.totalHours?.toFixed(1) || '0'} ชม.
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Not Checked In */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50">
            <CardTitle className="text-lg flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              ยังไม่เช็คอิน ({attendanceData.notCheckedIn.length} คน)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 max-h-[600px] overflow-y-auto">
            {attendanceData.notCheckedIn.length === 0 ? (
              <p className="text-center text-gray-500 py-8">พนักงานเช็คอินครบแล้ว 🎉</p>
            ) : (
              <div className="space-y-3">
                {attendanceData.notCheckedIn.map(user => (
                  <div 
                    key={user.id} 
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/employees/${user.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={user.linePictureUrl || '/avatar-placeholder.png'}
                        alt={user.fullName}
                        className="w-10 h-10 rounded-full"
                      />
                      <div>
                        <p className="font-medium">{user.fullName}</p>
                        <p className="text-sm text-gray-600">
                          {user.role === 'manager' ? 'ผู้จัดการ' : 
                           user.role === 'hr' ? 'ฝ่ายบุคคล' : 
                           user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.allowedLocationIds && user.allowedLocationIds.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {user.allowedLocationIds.length} สาขา
                        </Badge>
                      )}
                      <Badge variant="error" className="text-xs">
                        ยังไม่มา
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>


    </div>
  );
}