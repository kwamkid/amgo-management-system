'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, CheckCircle, Heart, Briefcase, Activity } from 'lucide-react';
import LeaveRequestForm from '@/components/leave/LeaveRequestForm';
import { useLeave } from '@/hooks/useLeave';
import { useAuth } from '@/hooks/useAuth';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared'

export default function LeaveRequestPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const { quota, loading } = useLeave();
  const [showForm, setShowForm] = useState(true);

  const handleSuccess = () => {
    // แสดงข้อความสำเร็จ
    setShowForm(false);
    
    // ไปหน้าประวัติหลังจาก 2 วินาที
    setTimeout(() => {
      router.push('/leaves/history');
    }, 2000);
  };

  const leaveTypes = [
    {
      type: 'sick' as const,
      label: 'ลาป่วย',
      icon: Heart,
      color: 'from-pink-500 to-rose-600',
      bgColor: 'from-pink-50 to-rose-100',
      iconColor: 'text-pink-600',
    },
    {
      type: 'personal' as const,
      label: 'ลากิจ',
      icon: Briefcase,
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'from-blue-50 to-indigo-100',
      iconColor: 'text-blue-600',
    },
    {
      type: 'vacation' as const,
      label: 'ลาพักร้อน',
      icon: Activity,
      color: 'from-emerald-500 to-teal-600',
      bgColor: 'from-emerald-50 to-teal-100',
      iconColor: 'text-emerald-600',
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="ขอลา"
        description="กรอกแบบฟอร์มเพื่อขอลา"
        icon={Calendar}
        backHref="/leaves"
      />

      {/* Leave Balance - แนวนอน */}
      {quota && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {leaveTypes.map(({ type, label, icon: Icon, bgColor, iconColor }) => {
            const data = quota[type];
            const percentage = data.total > 0 ? (data.used / data.total) * 100 : 0;
            
            return (
              <Card key={type} className="border-0 shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-gradient-to-br ${bgColor} rounded-lg`}>
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{label}</h4>
                        <p className="text-sm text-gray-600">
                          ใช้ไป {data.used} จาก {data.total} วัน
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{data.remaining}</p>
                      <p className="text-xs text-gray-500">คงเหลือ</p>
                    </div>
                  </div>
                  
                  <Progress 
                    value={percentage} 
                    className="h-2"
                    indicatorClassName={`bg-gradient-to-r ${iconColor.replace('text-', 'from-').replace('600', '500')} to-${iconColor.includes('pink') ? 'rose' : iconColor.includes('blue') ? 'indigo' : 'teal'}-600`}
                  />
                  <p className="text-xs text-gray-500 mt-1 text-right">
                    {percentage.toFixed(0)}% ใช้ไปแล้ว
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Main Content - Form ขึ้นก่อน */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main Form - อยู่ซ้าย */}
        <div className="lg:col-span-8">
          {showForm ? (
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>แบบฟอร์มขอลา</CardTitle>
                <CardDescription>
                  กรุณากรอกข้อมูลให้ครบถ้วน คำขอของคุณจะถูกส่งไปยังผู้จัดการเพื่ออนุมัติ
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LeaveRequestForm onSuccess={handleSuccess} />
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-md">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">ส่งคำขอสำเร็จ!</h3>
                <p className="text-gray-600">
                  คำขอลาของคุณถูกส่งเรียบร้อยแล้ว
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  กำลังนำคุณไปยังหน้าประวัติการลา...
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Info - อยู่ขวา */}
        <div className="lg:col-span-4 space-y-4">
          {/* Quick Info */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                ข้อควรทราบ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <div className="font-medium text-amber-900">ลาป่วย</div>
                <ul className="space-y-1 text-amber-800 ml-4">
                  <li>• สามารถลาย้อนหลังได้</li>
                  <li>
                    • ตั้งแต่ 3 วันทำงานขึ้นไป ต้องแนบใบรับรองแพทย์{' '}
                    <a
                      href="https://www.mol.go.th/forums/topic/ลาป่วยกรณีต้องใช้ใบรับรองแพทย์"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      (พ.ร.บ.คุ้มครองแรงงาน ม.32)
                    </a>
                  </li>
                  <li>• ไม่คิดค่าปรับหากลาด่วน</li>
                </ul>
              </div>
              
              <div className="space-y-2 pt-2 border-t border-amber-200">
                <div className="font-medium text-amber-900">ลากิจ</div>
                <ul className="space-y-1 text-amber-800 ml-4">
                  <li>• ต้องแจ้งล่วงหน้า 3 วัน</li>
                  <li>• ลาด่วนคิดโควต้า 2 เท่า</li>
                  <li>• ไม่สามารถลาย้อนหลังได้</li>
                </ul>
              </div>
              
              <div className="space-y-2 pt-2 border-t border-amber-200">
                <div className="font-medium text-amber-900">ลาพักร้อน</div>
                <ul className="space-y-1 text-amber-800 ml-4">
                  <li>• ต้องแจ้งล่วงหน้า 7 วัน</li>
                  <li>• ลาด่วนคิดโควต้า 2 เท่า</li>
                  <li>• สามารถสะสมได้</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Additional Tips */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base">💡 เคล็ดลับ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600">
              <p>• วางแผนการลาล่วงหน้าเพื่อไม่ต้องเสียโควต้าเพิ่ม</p>
              <p>• ตรวจสอบวันหยุดนักขัตฤกษ์ก่อนลา</p>
              <p>• แนบเอกสารให้ครบถ้วนเพื่อความรวดเร็ว</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}