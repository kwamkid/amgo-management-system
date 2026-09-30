// app/(admin)/leaves/page.tsx

'use client'

import { useRouter } from 'next/navigation'
import { PageHeader, StatCard, StatusBadge, InfoPanel, ListRow, ListRows } from '@/components/shared'
import { Button as AooButton, Alert, Card, CardContent, CardHeader, CardTitle, CardDescription, Button, EmptyState } from '@/components/aoo'
import { useAuth } from '@/hooks/useAuth'
import { useLeave } from '@/hooks/useLeave'
import { 
  Calendar, 
  Clock, 
  CheckCircle,
  XCircle,
  CalendarCheck,
  Users,
  Lightbulb
} from 'lucide-react'
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
  const isManagement = userData && ['hr', 'manager', 'admin'].includes(userData.role)
  
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
      <PageHeader
        title="ระบบลา"
        description="จัดการวันลาและดูประวัติการลาของคุณ"
        icon={Calendar}
        actions={
          <>
            <Link href="/leaves/history">
              <AooButton variant="ghost" size="sm" icon="Clock">
                ประวัติการลา
              </AooButton>
            </Link>
            {isManagement && (
              <Link href="/leaves/management">
                <AooButton variant="secondary" size="sm" icon="Users">
                  จัดการคำขอลา
                </AooButton>
              </Link>
            )}
            <Link href="/leaves/request">
              <AooButton size="sm" icon="Plus">
                ขอลา
              </AooButton>
            </Link>
          </>
        }
      />

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <Alert tone="warning">
          คุณมี <strong>{pendingCount}</strong> คำขอลาที่รอการอนุมัติ
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave Balance - Main Focus */}
        <div className="lg:col-span-2 space-y-6">
          <LeaveBalance quota={quota} loading={loading} />
          
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="รออนุมัติ" value={pendingCount} icon={Clock} tone="warning" />
            <StatCard label="อนุมัติแล้ว" value={approvedCount} icon={CheckCircle} tone="success" />
            <StatCard label="ไม่อนุมัติ" value={rejectedCount} icon={XCircle} tone="danger" />
          </div>

          {/* Recent Leave Requests */}
          <Card padding={0}>
            <CardHeader>
              <CardTitle>คำขอลาล่าสุด</CardTitle>
              <CardDescription>
                แสดง 5 รายการล่าสุด
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myLeaves.length === 0 ? (
                <EmptyState
                  icon={<Calendar size={40} />}
                  title="ยังไม่มีประวัติการลา"
                  action={
                    <Link href="/leaves/request">
                      <Button variant="soft" icon="Plus">
                        ขอลาครั้งแรก
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-3">
                  <ListRows variant="boxed">
                    {myLeaves.slice(0, 5).map((leave) => (
                      <ListRow
                        key={leave.id}
                        title={
                          <span className="flex items-center gap-2">
                            {LEAVE_TYPE_LABELS[leave.type]}
                            <StatusBadge status={leave.status} />
                          </span>
                        }
                        meta={
                          <>
                            <p>
                              {formatDateRange(leave.startDate, leave.endDate, 'dd MMM yyyy')}
                              <span className="ml-2">({leave.totalDays} วัน)</span>
                            </p>
                            <p>{leave.reason}</p>
                          </>
                        }
                        trailing={
                          <Link href="/leaves/history">
                            <Button variant="ghost" size="sm">
                              ดูรายละเอียด
                            </Button>
                          </Link>
                        }
                      />
                    ))}
                  </ListRows>
                  
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
          <Card padding={0}>
            <CardHeader>
              <CardTitle>การดำเนินการ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/leaves/request" className="block">
                <Button className="w-full justify-start" variant="soft">
                  <CalendarCheck className="w-4 h-4 mr-2" />
                  ขอลาใหม่
                </Button>
              </Link>
              <Link href="/leaves/history" className="block">
                <Button className="w-full justify-start" variant="soft" icon="History">
                  ดูประวัติการลา
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Upcoming Leaves */}
          {upcomingLeaves.length > 0 && (
            <Card padding={0}>
              <CardHeader>
                <CardTitle icon={Calendar} tone="accent">
                  วันลาที่จะถึง
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingLeaves.map((leave) => (
                  <InfoPanel key={leave.id}>
                    <p className="font-medium text-sm">
                      {LEAVE_TYPE_LABELS[leave.type]}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {formatDateRange(leave.startDate, leave.endDate, 'dd MMM yyyy')}
                    </p>
                  </InfoPanel>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Tips */}
          <Card padding={0}>
            <CardHeader>
              <CardTitle icon={Lightbulb} tone="warning">
                เคล็ดลับ
              </CardTitle>
            </CardHeader>
            <CardContent>
             <ul className="space-y-2 text-sm text-gray-700">
              <li>• ลาป่วยเกิน 2 วันต้องแนบใบรับรองแพทย์</li>
              <li>• ลากิจต้องแจ้งล่วงหน้า 3 วัน</li>      {/* เปลี่ยนจาก "ลาล่วงหน้าอย่างน้อย 3 วัน" */}
              <li>• ลาพักร้อนต้องแจ้งล่วงหน้า 7 วัน</li>  {/* เพิ่มบรรทัดนี้ */}
              <li>• วันลาพักร้อนไม่สามารถสะสมได้</li>
            </ul>
            </CardContent>
          </Card>

          {/* Management Card for HR/Admin */}
          {isManagement && (
            <Card padding={0}>
              <CardHeader>
                <CardTitle icon={Users} tone="grape">
                  การจัดการ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href="/leaves/management">
                  <Button className="w-full justify-start" variant="soft" icon="FileText">
                    จัดการคำขอลาพนักงาน
                  </Button>
                </Link>
                <p className="text-sm text-gray-600 mt-3">
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