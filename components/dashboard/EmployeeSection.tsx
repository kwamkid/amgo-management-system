'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LeaveBalance from '@/components/leave/LeaveBalance';
import { useLeave } from '@/hooks/useLeave';
import { useCheckIn } from '@/hooks/useCheckIn';
import { 
  Calendar, 
  FileText, 
  TrendingUp, 
  Clock,
  AlertCircle,
  User,
  MapPin,
  CheckCircle
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
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-slate-100 hover:shadow-lg transition-shadow">
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
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <p className="text-sm text-slate-600">เช็คอินแล้ว</p>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {format(new Date(currentCheckIn.checkinTime), 'HH:mm')}
                </p>
                {currentCheckIn.primaryLocationName && (
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {currentCheckIn.primaryLocationName}
                  </p>
                )}
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
        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-emerald-100 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-emerald-900">
                วันลาคงเหลือ
              </CardTitle>
              <Calendar className="w-5 h-5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700">
              {quota ? quota.vacation.remaining + quota.personal.remaining : '0'}
            </div>
            <p className="text-sm text-emerald-600 mt-1">วันพักร้อน + ลากิจ</p>
            {quota && (
              <div className="mt-2 text-xs text-emerald-600">
                <div className="flex justify-between">
                  <span>ลาป่วย:</span>
                  <span className="font-medium">{quota.sick.remaining} วัน</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ลาเดือนนี้ */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-amber-100 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-amber-900">
                ลาเดือนนี้
              </CardTitle>
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700">
              {currentMonthLeaves}
            </div>
            <p className="text-sm text-amber-600 mt-1">วันที่อนุมัติแล้ว</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 bg-amber-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
                  style={{ width: `${Math.min((currentMonthLeaves / 5) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs text-amber-600">5 วัน</span>
            </div>
          </CardContent>
        </Card>

        {/* รออนุมัติ */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-purple-900">
                รออนุมัติ
              </CardTitle>
              <AlertCircle className="w-5 h-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">
              {pendingLeaves}
            </div>
            <p className="text-sm text-purple-600 mt-1">คำขอลา</p>
            {pendingLeaves > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-0"
                onClick={() => router.push('/leave/history')}
              >
                ดูรายละเอียด →
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Leave Balance Card */}
        <div className="md:col-span-1">
          <LeaveBalance quota={quota} loading={leaveLoading} />
        </div>

        {/* Quick Actions */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <User className="w-5 h-5 text-red-600" />
              เมนูด่วน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <Button
              variant="outline"
              className="w-full justify-start h-12 text-base border-gray-200 hover:bg-white hover:border-gray-300 group"
              onClick={() => router.push('/checkin')}
            >
              <Clock className="w-5 h-5 mr-3 text-slate-600 group-hover:text-slate-700" />
              เช็คอิน - เช็คเอาท์
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start h-12 text-base border-gray-200 hover:bg-white hover:border-gray-300 group"
              onClick={() => router.push('/leave/request')}
            >
              <FileText className="w-5 h-5 mr-3 text-emerald-600 group-hover:text-emerald-700" />
              ขอลา
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start h-12 text-base border-gray-200 hover:bg-white hover:border-gray-300 group"
              onClick={() => router.push('/leave/history')}
            >
              <TrendingUp className="w-5 h-5 mr-3 text-purple-600 group-hover:text-purple-700" />
              ประวัติการลา
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start h-12 text-base border-gray-200 hover:bg-white hover:border-gray-300 group"
              onClick={() => router.push('/profile')}
            >
              <User className="w-5 h-5 mr-3 text-gray-600 group-hover:text-gray-700" />
              โปรไฟล์ของฉัน
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Leave History */}
      {myLeaves.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
            <CardTitle className="text-lg font-medium">ประวัติการลาล่าสุด</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {myLeaves.slice(0, 3).map((leave) => (
                <div 
                  key={leave.id} 
                  className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group"
                  onClick={() => router.push(`/leave/history/${leave.id}`)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      leave.type === 'sick' ? 'bg-red-100' :
                      leave.type === 'personal' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      {leave.type === 'sick' ? (
                        <FileText className="w-4 h-4 text-red-600" />
                      ) : leave.type === 'personal' ? (
                        <Calendar className="w-4 h-4 text-blue-600" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-base text-gray-900">
                        {leave.type === 'sick' ? 'ลาป่วย' : leave.type === 'personal' ? 'ลากิจ' : 'ลาพักร้อน'}
                        <span className="text-sm text-gray-600 ml-2">({leave.totalDays} วัน)</span>
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {format(new Date(leave.startDate), 'dd/MM/yyyy')} - 
                        {format(new Date(leave.endDate), 'dd/MM/yyyy')}
                      </p>
                      {leave.reason && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                          เหตุผล: {leave.reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        leave.status === 'approved' ? 'success' :
                        leave.status === 'pending' ? 'warning' : 'error'
                      }
                      className="font-normal"
                    >
                      {leave.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {leave.status === 'approved' ? 'อนุมัติแล้ว' :
                       leave.status === 'pending' ? 'รออนุมัติ' : 'ไม่อนุมัติ'}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {myLeaves.length > 3 && (
                <Button 
                  variant="ghost" 
                  className="w-full text-gray-600 hover:text-gray-700 hover:bg-gray-50"
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