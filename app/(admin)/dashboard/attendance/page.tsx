// app/(admin)/dashboard/attendance/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { CheckInRecord } from '@/types/checkin'
import { User } from '@/types/user'
import { getDailySummary, getCheckInRecords } from '@/lib/services/checkinService'
import { getUsers } from '@/lib/services/userService'
import { 
  Users, 
  Clock, 
  MapPin, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  Calendar,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { gradients } from '@/lib/theme/colors'
import TechLoader from '@/components/shared/TechLoader'

interface AttendanceData {
  working: User[]
  checkedOut: User[]
  notCheckedIn: User[]
  late: User[]
  earlyOut: User[]
  records: Record<string, CheckInRecord>
}

export default function DailyAttendancePage() {
  const { userData } = useAuth()
  const [attendanceData, setAttendanceData] = useState<AttendanceData>({
    working: [],
    checkedOut: [],
    notCheckedIn: [],
    late: [],
    earlyOut: [],
    records: {}
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDate] = useState(new Date())

  // Check permission
  const canView = userData?.role === 'admin' || userData?.role === 'hr' || userData?.role === 'manager'

  useEffect(() => {
    if (canView) {
      fetchAttendanceData()
      
      // Auto refresh every 30 seconds
      const interval = setInterval(() => {
        fetchAttendanceData(true)
      }, 30000)
      
      return () => clearInterval(interval)
    }
  }, [canView])

  const fetchAttendanceData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      // Get all active users
      const { users: allUsers } = await getUsers(100, undefined, { isActive: true })
      
      // Get today's check-in records
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const { records } = await getCheckInRecords({ date: dateStr }, 1000)
      
      // Create record map by userId
      const recordMap: Record<string, CheckInRecord> = {}
      records.forEach(record => {
        // Keep the latest record for each user
        if (!recordMap[record.userId] || 
            new Date(record.checkinTime) > new Date(recordMap[record.userId].checkinTime)) {
          recordMap[record.userId] = record
        }
      })
      
      // Categorize users
      const working: User[] = []
      const checkedOut: User[] = []
      const notCheckedIn: User[] = []
      const late: User[] = []
      const earlyOut: User[] = []
      
      allUsers.forEach(user => {
        const record = recordMap[user.id!]
        
        if (!record) {
          // Not checked in
          notCheckedIn.push(user)
        } else if (record.status === 'checked-in') {
          // Currently working
          working.push(user)
          
          if (record.isLate) {
            late.push(user)
          }
        } else if (record.status === 'completed' || record.checkoutTime) {
          // Checked out
          checkedOut.push(user)
          
          if (record.isLate) {
            late.push(user)
          }
          
          // Check early checkout (less than 8 hours)
          if (record.totalHours < 8) {
            earlyOut.push(user)
          }
        }
      })
      
      setAttendanceData({
        working,
        checkedOut,
        notCheckedIn,
        late,
        earlyOut,
        records: recordMap
      })
      
    } catch (error) {
      console.error('Error fetching attendance:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const formatTime = (date: any) => {
    if (!date) return '-'
    const d = date instanceof Date ? date : new Date(date)
    return format(d, 'HH:mm')
  }

  if (!canView) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-0 shadow-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">ไม่มีสิทธิ์เข้าถึง</h3>
            <p className="text-gray-600">เฉพาะ Admin, HR และ Manager เท่านั้น</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return <TechLoader />
  }

  const totalEmployees = attendanceData.working.length + 
                        attendanceData.checkedOut.length + 
                        attendanceData.notCheckedIn.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">สถานะพนักงานวันนี้</h1>
          <p className="text-gray-600 mt-1">
            {format(selectedDate, 'EEEE dd MMMM yyyy', { locale: th })}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">พนักงานทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{totalEmployees}</p>
              </div>
              <div className={`w-12 h-12 bg-gradient-to-br ${gradients.infoLight} rounded-full flex items-center justify-center`}>
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">กำลังทำงาน</p>
                <p className="text-2xl font-bold text-teal-600 mt-1">{attendanceData.working.length}</p>
              </div>
              <div className={`w-12 h-12 bg-gradient-to-br ${gradients.successLight} rounded-full flex items-center justify-center`}>
                <Clock className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">มาสาย</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{attendanceData.late.length}</p>
              </div>
              <div className={`w-12 h-12 bg-gradient-to-br ${gradients.warningLight} rounded-full flex items-center justify-center`}>
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ยังไม่มา</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{attendanceData.notCheckedIn.length}</p>
              </div>
              <div className={`w-12 h-12 bg-gradient-to-br ${gradients.errorLight} rounded-full flex items-center justify-center`}>
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="working" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="working">
            กำลังทำงาน ({attendanceData.working.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            เช็คเอาท์แล้ว ({attendanceData.checkedOut.length})
          </TabsTrigger>
          <TabsTrigger value="late">
            มาสาย ({attendanceData.late.length})
          </TabsTrigger>
          <TabsTrigger value="early">
            กลับก่อน ({attendanceData.earlyOut.length})
          </TabsTrigger>
          <TabsTrigger value="absent">
            ยังไม่มา ({attendanceData.notCheckedIn.length})
          </TabsTrigger>
        </TabsList>

        {/* Working Tab */}
        <TabsContent value="working">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-600" />
                พนักงานที่กำลังทำงาน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {attendanceData.working.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">ไม่มีพนักงานที่กำลังทำงาน</p>
                ) : (
                  attendanceData.working.map(user => {
                    const record = attendanceData.records[user.id!]
                    const workingHours = record.checkinTime ? 
                      Math.floor((Date.now() - new Date(record.checkinTime).getTime()) / (1000 * 60 * 60)) : 0
                    
                    return (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.linePictureUrl || '/avatar-placeholder.png'}
                            alt={user.fullName}
                            className="w-10 h-10 rounded-full"
                          />
                          <div>
                            <p className="font-medium">{user.fullName}</p>
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <LogIn className="w-3.5 h-3.5" />
                                {formatTime(record.checkinTime)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {record.primaryLocationName || 'นอกสถานที่'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-teal-600">{workingHours} ชม.</p>
                          {record.isLate && (
                            <Badge variant="error" className="text-xs">
                              สาย {record.lateMinutes} นาที
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Completed Tab */}
        <TabsContent value="completed">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                พนักงานที่เช็คเอาท์แล้ว
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {attendanceData.checkedOut.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">ยังไม่มีพนักงานเช็คเอาท์</p>
                ) : (
                  attendanceData.checkedOut.map(user => {
                    const record = attendanceData.records[user.id!]
                    
                    return (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.linePictureUrl || '/avatar-placeholder.png'}
                            alt={user.fullName}
                            className="w-10 h-10 rounded-full"
                          />
                          <div>
                            <p className="font-medium">{user.fullName}</p>
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <LogIn className="w-3.5 h-3.5" />
                                {formatTime(record.checkinTime)}
                              </span>
                              <span className="flex items-center gap-1">
                                <LogOut className="w-3.5 h-3.5" />
                                {formatTime(record.checkoutTime)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {record.primaryLocationName || 'นอกสถานที่'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{record.totalHours?.toFixed(1) || '0'} ชม.</p>
                          {record.totalHours < 8 && (
                            <Badge variant="warning" className="text-xs">
                              กลับก่อน
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Late Tab */}
        <TabsContent value="late">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                พนักงานที่มาสาย
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {attendanceData.late.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">ไม่มีพนักงานมาสาย</p>
                ) : (
                  attendanceData.late.map(user => {
                    const record = attendanceData.records[user.id!]
                    
                    return (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.linePictureUrl || '/avatar-placeholder.png'}
                            alt={user.fullName}
                            className="w-10 h-10 rounded-full"
                          />
                          <div>
                            <p className="font-medium">{user.fullName}</p>
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <LogIn className="w-3.5 h-3.5" />
                                {formatTime(record.checkinTime)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {record.primaryLocationName || 'นอกสถานที่'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Badge variant="error">
                          สาย {record.lateMinutes} นาที
                        </Badge>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Early Out Tab */}
        <TabsContent value="early">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <LogOut className="w-5 h-5 text-orange-600" />
                พนักงานที่กลับก่อนเวลา
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {attendanceData.earlyOut.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">ไม่มีพนักงานกลับก่อนเวลา</p>
                ) : (
                  attendanceData.earlyOut.map(user => {
                    const record = attendanceData.records[user.id!]
                    
                    return (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.linePictureUrl || '/avatar-placeholder.png'}
                            alt={user.fullName}
                            className="w-10 h-10 rounded-full"
                          />
                          <div>
                            <p className="font-medium">{user.fullName}</p>
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <LogOut className="w-3.5 h-3.5" />
                                {formatTime(record.checkoutTime)}
                              </span>
                              <span>ทำงาน {record.totalHours?.toFixed(1) || '0'} ชม.</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant="warning">
                          ขาด {(8 - (record.totalHours || 0)).toFixed(1)} ชม.
                        </Badge>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Absent Tab */}
        <TabsContent value="absent">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                พนักงานที่ยังไม่เช็คอิน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {attendanceData.notCheckedIn.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">พนักงานเช็คอินครบแล้ว</p>
                ) : (
                  attendanceData.notCheckedIn.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
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
                             user.role === 'hr' ? 'ฝ่ายบุคคล' : 'พนักงาน'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="error">
                        ยังไม่มา
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}