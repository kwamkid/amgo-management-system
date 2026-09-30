// ========== FILE: components/dashboard/AttendanceSection.tsx ==========
'use client';

import React, { useState, useEffect } from 'react';
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
import UserAvatar from '@/components/shared/UserAvatar'
import { StatCard } from '@/components/shared'

import { Pill, Card, CardContent, CardHeader, CardTitle, Button } from '@/components/aoo'
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
        } else if (user.requiresCheckin !== false) {
          // คนที่ตั้งไว้ว่าไม่ต้องเช็คอิน ไม่ใช่คน "ยังไม่มา" — ไม่ต้องขึ้นในลิสต์
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
    
    const shiftColors: Record<string, string> = {
      'กะเช้า': 'bg-blue-100 text-blue-700',
      'กะบ่าย': 'bg-purple-100 text-purple-700',
      'กะดึก': 'bg-gray-700 text-white'
    };
    
    return (
      <Pill tone="accent" className={`text-xs ${shiftColors[record.selectedShiftName] || 'bg-gray-100 text-gray-700'}`}>
        {record.selectedShiftName}
      </Pill>
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
        
        <Button onClick={() => fetchAttendanceData(true)}
 disabled={refreshing}
 variant="secondary"
 size="sm">
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="ml-2">รีเฟรช</span>
        </Button>
      </div>

      {/* Summary Stats - แสดงแค่ 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="กำลังทำงาน" value={workingCount} unit="คน" hint="เช็คอินอยู่" icon={Clock} tone="sky" />
        <StatCard label="เสร็จงานแล้ว" value={attendanceData.checkedIn.length - workingCount} unit="คน" hint="เช็คอิน + เอาท์" icon={CheckCircle} tone="success" />
        <StatCard label="ยังไม่เช็คอิน" value={attendanceData.notCheckedIn.length} unit="คน" icon={XCircle} tone="danger" />
        <StatCard label="มาสาย" value={lateCount} unit="คน" icon={AlertTriangle} tone="warning" />
      </div>

      {/* Main Content - 2 Columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Checked In */}
        <Card padding={0}>
          <CardHeader>
            <CardTitle icon={Clock} tone="sky">
              กำลังทำงาน ({workingCount} คน)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 max-h-[600px] overflow-y-auto">
            {workingCount === 0 ? (
              <p className="text-center text-gray-500 py-8">ไม่มีพนักงานที่กำลังทำงาน</p>
            ) : (
              <div className="space-y-3">
                {attendanceData.checkedIn
                  .filter(user => {
                    const record = attendanceData.records[user.id!];
                    return record.status === 'checked-in';
                  })
                  .map(user => {
                    const record = attendanceData.records[user.id!];
                    const checkinTime = record.checkinTime instanceof Date 
                      ? record.checkinTime 
                      : new Date(record.checkinTime);
                    const workingHours = Math.floor((Date.now() - checkinTime.getTime()) / (1000 * 60 * 60));
                    
                    return (
                      <div 
                        key={user.id} 
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/employees/${user.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <UserAvatar name={user.fullName} userId={user.id} size="md" />
                          <div>
                            <p className="font-medium">{user.displayName || user.fullName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="flex items-center gap-1 text-sm text-gray-600">
                                <LogIn className="w-3.5 h-3.5" />
                                {formatTime(record.checkinTime)}
                              </span>
                              <span className="flex items-center gap-1 text-sm text-gray-600">
                                <MapPin className="w-3.5 h-3.5" />
                                {record.primaryLocationName || 'เช็คอินนอกสถานที่'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getShiftBadge(record)}
                          {record.isLate && (
                            <Pill tone="danger" className="text-xs">
                              สาย {record.lateMinutes} นาที
                            </Pill>
                          )}
                          <Pill tone="success" className="text-xs">
                            {workingHours} ชม.
                          </Pill>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Not Checked In */}
        <Card padding={0}>
          <CardHeader>
            <CardTitle icon={XCircle} tone="danger">
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
                      <UserAvatar name={user.fullName} userId={user.id} size="md" />
                      <div>
                        <p className="font-medium">{user.displayName || user.fullName}</p>
                        <p className="text-sm text-gray-600">
                          {user.role === 'manager' ? 'ผู้จัดการ' : 
                           user.role === 'hr' ? 'ฝ่ายบุคคล' : 
                           user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.allowedLocationIds && user.allowedLocationIds.length > 0 && (
                        <Pill tone="neutral" className="text-xs">
                          {user.allowedLocationIds.length} สาขา
                        </Pill>
                      )}
                      <Pill tone="danger" className="text-xs">
                        ยังไม่มา
                      </Pill>
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