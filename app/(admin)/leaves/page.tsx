// app/(admin)/leaves/page.tsx

'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useLeave } from '@/hooks/useLeave'
import { 
  Calendar, 
  FileText, 
  Clock, 
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Plus,
  History,
  CalendarCheck,
  Users
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { gradients, colorClasses } from '@/lib/theme/colors'
import TechLoader from '@/components/shared/TechLoader'
import LeaveBalance from '@/components/leave/LeaveBalance'
import Link from 'next/link'
import { safeFormatDate, formatDateRange, toDate } from '@/lib/utils/date'
import { LEAVE_TYPE_LABELS } from '@/types/leave'

export default function LeavePage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { quota, myLeaves, teamLeaves, loading } = useLeave()

  // Check if should show management view
  const isManagement = userData && ['hr', 'admin'].includes(userData.role)
  
  // Calculate stats
  const currentYear = new Date().getFullYear()
  const pendingCount = myLeaves.filter(l => l.status === 'pending').length
  const approvedCount = myLeaves.filter(l => l.status === 'approved').length
  const rejectedCount = myLeaves.filter(l => l.status === 'rejected').length
  
  // Get upcoming approved leaves - with safe date handling
  const upcomingLeaves = myLeaves
    .filter(l => {
      if (l.status !== 'approved') return false
      const startDate = toDate(l.startDate)
      return startDate && startDate > new Date()
    })
    .sort((a, b) => {
      const dateA = toDate(a.startDate)
      const dateB = toDate(b.startDate)
      if (!dateA || !dateB) return 0
      return dateA.getTime() - dateB.getTime()
    })
    .slice(0, 3)

  if (loading) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ระบบลา</h1>
          <p className="text-gray-600 mt-1">
            จัดการวันลาและดูประวัติการลาของคุณ
          </p>
        </div>
        
        <div className="flex gap-3">
          <Link href="/leaves/history">
            <Button variant="outline">
              <History className="w-4 h-4 mr-2" />
              ประวัติการลา
            </Button>
          </Link>
          <Link href="/leaves/request">
            <Button className={`bg-gradient-to-r ${gradients.primary}`}>
              <Plus className="w-4 h-4 mr-2" />
              ขอลา
            </Button>
          </Link>
          {isManagement && (
            <Link href="/leaves/management">
              <Button variant="outline" className="border-purple-200 text-purple-600 hover:bg-purple-50">
                <Users className="w-4 h-4 mr-2" />
                จัดการคำขอลา
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <Clock className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            คุณมี <strong>{pendingCount}</strong> คำขอลาที่รอการอนุมัติ
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave Balance - Main Focus */}
        <div className="lg:col-span-2 space-y-6">
          <LeaveBalance quota={quota} loading={loading} />
          
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-0 shadow-md">
              <CardContent className="p-6 text-center">
                <div className={`inline-flex p-3 bg-gradient-to-br ${gradients.warningLight} rounded-xl mb-3`}>
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
                <p className="text-sm text-gray-600">รออนุมัติ</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-6 text-center">
                <div className={`inline-flex p-3 bg-gradient-to-br ${gradients.successLight} rounded-xl mb-3`}>
                  <CheckCircle className="w-6 h-6 text-teal-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{approvedCount}</p>
                <p className="text-sm text-gray-600">อนุมัติแล้ว</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-6 text-center">
                <div className={`inline-flex p-3 bg-gradient-to-br ${gradients.errorLight} rounded-xl mb-3`}>
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{rejectedCount}</p>
                <p className="text-sm text-gray-600">ไม่อนุมัติ</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Leave Requests */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>คำขอลาล่าสุด</CardTitle>
              <CardDescription>
                แสดง 5 รายการล่าสุด
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myLeaves.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">ยังไม่มีประวัติการลา</p>
                  <Link href="/leaves/request">
                    <Button variant="outline" className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      ขอลาครั้งแรก
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {myLeaves.slice(0, 5).map((leave) => (
                    <Card key={leave.id} className="border-gray-100">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {LEAVE_TYPE_LABELS[leave.type]}
                              </p>
                              <Badge 
                                variant={
                                  leave.status === 'approved' ? 'success' :
                                  leave.status === 'rejected' ? 'error' :
                                  leave.status === 'cancelled' ? 'secondary' :
                                  'warning'
                                }
                              >
                                {leave.status === 'approved' && 'อนุมัติแล้ว'}
                                {leave.status === 'rejected' && 'ไม่อนุมัติ'}
                                {leave.status === 'pending' && 'รออนุมัติ'}
                                {leave.status === 'cancelled' && 'ยกเลิก'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">
                              {formatDateRange(leave.startDate, leave.endDate, 'dd MMM yyyy')}
                              <span className="ml-2">({leave.totalDays} วัน)</span>
                            </p>
                            <p className="text-sm text-gray-500">{leave.reason}</p>
                          </div>
                          <Link href="/leaves/history">
                            <Button variant="ghost" size="sm">
                              ดูรายละเอียด
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {myLeaves.length > 5 && (
                    <Link href="/leaves/history" className="block">
                      <Button variant="ghost" className="w-full">
                        ดูทั้งหมด ({myLeaves.length} รายการ)
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quick Actions */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">การดำเนินการ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/leaves/request" className="block">
                <Button className="w-full justify-start" variant="outline">
                  <CalendarCheck className="w-4 h-4 mr-2" />
                  ขอลาใหม่
                </Button>
              </Link>
              <Link href="/leaves/history" className="block">
                <Button className="w-full justify-start" variant="outline">
                  <History className="w-4 h-4 mr-2" />
                  ดูประวัติการลา
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Upcoming Leaves */}
          {upcomingLeaves.length > 0 && (
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-red-600" />
                  วันลาที่จะถึง
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingLeaves.map((leave) => (
                  <div key={leave.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-sm">
                      {LEAVE_TYPE_LABELS[leave.type]}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {formatDateRange(leave.startDate, leave.endDate, 'dd MMM yyyy')}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Tips */}
          <Card className={`border-0 shadow-md bg-gradient-to-r ${gradients.infoLight}`}>
            <CardHeader>
              <CardTitle className="text-lg text-blue-900">
                💡 เคล็ดลับ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• ลาป่วยเกิน 2 วันต้องแนบใบรับรองแพทย์</li>
                <li>• ลาล่วงหน้าอย่างน้อย 3 วันสำหรับลากิจ</li>
                <li>• วันลาพักร้อนสามารถสะสมได้</li>
              </ul>
            </CardContent>
          </Card>

          {/* Management Card for HR/Admin */}
          {isManagement && (
            <Card className={`border-0 shadow-md bg-gradient-to-r ${gradients.purpleLight}`}>
              <CardHeader>
                <CardTitle className="text-lg text-purple-900 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  การจัดการ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href="/leaves/management">
                  <Button className="w-full justify-start" variant="outline">
                    <FileText className="w-4 h-4 mr-2" />
                    จัดการคำขอลาพนักงาน
                  </Button>
                </Link>
                <p className="text-sm text-purple-700 mt-3">
                  มีคำขอรออนุมัติ {teamLeaves.filter(l => l.status === 'pending').length} รายการ
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}