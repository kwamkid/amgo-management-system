'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import LeaveBalance from '@/components/leave/LeaveBalance';
import { useLeave } from '@/hooks/useLeave';
import { useCheckIn } from '@/hooks/useCheckIn';
import { 
  Calendar, 
  FileText, 
  TrendingUp, 
  Clock,
  AlertCircle,
  User
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UserData } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface EmployeeSectionProps {
  userData: UserData;
}

export default function EmployeeSection({ userData }: EmployeeSectionProps) {
  const { quota, myLeaves, loading: leaveLoading } = useLeave();
  const { currentCheckIn } = useCheckIn();
  const router = useRouter();

  // นับวันลาที่ใช้ไปในเดือนนี้
  const currentMonthLeaves = myLeaves.filter(leave => {
    const leaveDate = new Date(leave.startDate);
    const now = new Date();
    return leaveDate.getMonth() === now.getMonth() && 
           leaveDate.getFullYear() === now.getFullYear() &&
           leave.status === 'approved';
  }).reduce((total, leave) => total + leave.totalDays, 0);

  // นับวันลาที่รออนุมัติ
  const pendingLeaves = myLeaves.filter(leave => leave.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* เวลาทำงาน */}
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-slate-900">
                เวลาทำงาน
              </CardTitle>
              <Clock className="w-5 h-5 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent>
            {currentCheckIn ? (
              <div>
                <p className="text-sm text-slate-600">เช็คอินแล้ว</p>
                <p className="text-lg font-semibold text-slate-800">
                  {format(new Date(currentCheckIn.checkinTime), 'HH:mm')}
                </p>
              </div>
            ) : (
              <Button 
                className="w-full bg-slate-700 hover:bg-slate-800 text-white"
                onClick={() => router.push('/checkin')}
              >
                ไปหน้าเช็คอิน
              </Button>
            )}
          </CardContent>
        </Card>

        {/* วันลาคงเหลือ */}
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-emerald-900">
                วันลาคงเหลือ
              </CardTitle>
              <Calendar className="w-5 h-5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {quota ? quota.vacation.remaining + quota.personal.remaining : '0'}
            </div>
            <p className="text-sm text-emerald-600 mt-1">วันพักร้อน + ลากิจ</p>
          </CardContent>
        </Card>

        {/* ลาเดือนนี้ */}
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-amber-900">
                ลาเดือนนี้
              </CardTitle>
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {currentMonthLeaves}
            </div>
            <p className="text-sm text-amber-600 mt-1">วันที่อนุมัติแล้ว</p>
          </CardContent>
        </Card>

        {/* รออนุมัติ */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-purple-900">
                รออนุมัติ
              </CardTitle>
              <AlertCircle className="w-5 h-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {pendingLeaves}
            </div>
            <p className="text-sm text-purple-600 mt-1">คำขอลา</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Leave Balance Card - Updated Design */}
        <div className="md:col-span-1">
          <LeaveBalance quota={quota} loading={leaveLoading} />
        </div>

        {/* Quick Actions */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-gray-50 to-gray-100">
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <User className="w-5 h-5" />
              เมนูด่วน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-12 text-base border-gray-200 hover:bg-white hover:border-gray-300"
              onClick={() => router.push('/checkin')}
            >
              <Clock className="w-5 h-5 mr-3 text-slate-600" />
              เช็คอิน - เช็คเอาท์
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start h-12 text-base border-gray-200 hover:bg-white hover:border-gray-300"
              onClick={() => router.push('/leave/request')}
            >
              <FileText className="w-5 h-5 mr-3 text-emerald-600" />
              ขอลา
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start h-12 text-base border-gray-200 hover:bg-white hover:border-gray-300"
              onClick={() => router.push('/leave/history')}
            >
              <TrendingUp className="w-5 h-5 mr-3 text-purple-600" />
              ประวัติการลา
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start h-12 text-base border-gray-200 hover:bg-white hover:border-gray-300"
              onClick={() => router.push('/profile')}
            >
              <User className="w-5 h-5 mr-3 text-gray-600" />
              โปรไฟล์ของฉัน
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Leave History */}
      {myLeaves.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-medium">ประวัติการลาล่าสุด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myLeaves.slice(0, 3).map((leave) => (
                <div 
                  key={leave.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-base">
                      {leave.type === 'sick' ? 'ลาป่วย' : leave.type === 'personal' ? 'ลากิจ' : 'ลาพักร้อน'}
                      <span className="text-sm text-gray-600 ml-2">({leave.totalDays} วัน)</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(leave.startDate), 'dd/MM/yyyy')} - 
                      {format(new Date(leave.endDate), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    leave.status === 'approved' ? 'bg-green-100 text-green-700' :
                    leave.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {leave.status === 'approved' ? 'อนุมัติแล้ว' :
                     leave.status === 'pending' ? 'รออนุมัติ' : 'ไม่อนุมัติ'}
                  </div>
                </div>
              ))}
              
              {myLeaves.length > 3 && (
                <Button 
                  variant="ghost" 
                  className="w-full text-gray-600"
                  onClick={() => router.push('/leave/history')}
                >
                  ดูทั้งหมด ({myLeaves.length} รายการ)
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}