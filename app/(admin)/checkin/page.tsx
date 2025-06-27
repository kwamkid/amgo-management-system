// app/(admin)/checkin/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCheckIn } from '@/hooks/useCheckIn'
import CheckInButton from '@/components/checkin/CheckInButton'
import CheckInHistory from '@/components/checkin/CheckInHistory'
import { Clock, Calendar, MapPin, TrendingUp } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { th } from 'date-fns/locale'
import { getCheckInRecords } from '@/lib/services/checkinService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { gradients, colorClasses } from '@/lib/theme/colors'
import TechLoader from '@/components/shared/TechLoader'

export default function CheckInPage() {
  const { userData } = useAuth()
  const { currentCheckIn } = useCheckIn()
  
  const [monthlyStats, setMonthlyStats] = useState({
    totalHours: 0,
    overtimeHours: 0,
    workDays: 0,
    lateDays: 0
  })
  const [loadingStats, setLoadingStats] = useState(true)
  
  // Fetch monthly statistics
  useEffect(() => {
    const fetchMonthlyStats = async () => {
      if (!userData?.id) return
      
      try {
        setLoadingStats(true)
        const now = new Date()
        const startDate = startOfMonth(now)
        const endDate = endOfMonth(now)
        
        let totalHours = 0
        let overtimeHours = 0
        let workDays = 0
        let lateDays = 0
        
        // Fetch data for each day of the month
        for (let date = new Date(startDate); date <= endDate && date <= now; date.setDate(date.getDate() + 1)) {
          const dateStr = format(date, 'yyyy-MM-dd')
          const { records } = await getCheckInRecords({
            date: dateStr,
            userId: userData.id
          }, 10)
          
          records.forEach(record => {
            if (record.status === 'completed' || record.status === 'pending') {
              workDays++
              totalHours += record.totalHours || 0
              overtimeHours += record.overtimeHours || 0
              if (record.isLate) lateDays++
            }
          })
        }
        
        setMonthlyStats({
          totalHours: Math.round(totalHours * 10) / 10,
          overtimeHours: Math.round(overtimeHours * 10) / 10,
          workDays,
          lateDays
        })
      } catch (error) {
        console.error('Error fetching monthly stats:', error)
      } finally {
        setLoadingStats(false)
      }
    }
    
    fetchMonthlyStats()
  }, [userData?.id])

  return (
    <div className="min-h-screen md:min-h-0">
      {/* Mobile View - Full Screen */}
      <div className="md:hidden">
        <CheckInButton />
      </div>

      {/* Desktop/Tablet View - With additional info */}
      <div className="hidden md:block space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">เช็คอิน/เอาท์</h1>
          <p className="text-gray-600 mt-1">
            สวัสดี {userData?.fullName || userData?.lineDisplayName} 👋
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Check-in Button Column */}
          <div className="lg:col-span-1">
            <CheckInButton />
          </div>

          {/* Stats & Info Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Monthly Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 bg-gradient-to-br ${gradients.infoLight} rounded-xl`}>
                      <Clock className="w-8 h-8 text-blue-600" />
                    </div>
                    <Badge variant="outline" className="font-normal">เดือนนี้</Badge>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {loadingStats ? '-' : monthlyStats.totalHours}
                  </p>
                  <p className="text-sm text-gray-600">ชั่วโมงทำงาน</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 bg-gradient-to-br ${gradients.successLight} rounded-xl`}>
                      <TrendingUp className="w-8 h-8 text-teal-600" />
                    </div>
                    <Badge variant="outline" className="font-normal">OT</Badge>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {loadingStats ? '-' : monthlyStats.overtimeHours}
                  </p>
                  <p className="text-sm text-gray-600">ชั่วโมงล่วงเวลา</p>
                </CardContent>
              </Card>
            </div>

            {/* Today's Summary */}
            {currentCheckIn && (
              <Card className={`border-0 shadow-md bg-gradient-to-r ${gradients.successLight}`}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2 text-teal-900">
                    <Calendar className="w-5 h-5" />
                    สถานะวันนี้
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-white/80 rounded-lg p-3">
                      <p className="text-teal-700">เข้างาน</p>
                      <p className="font-semibold text-teal-900">
                        {format(
                          currentCheckIn.checkinTime instanceof Date 
                            ? currentCheckIn.checkinTime 
                            : new Date(currentCheckIn.checkinTime),
                          'HH:mm',
                          { locale: th }
                        )}
                      </p>
                    </div>
                    <div className="bg-white/80 rounded-lg p-3">
                      <p className="text-teal-700">สถานที่</p>
                      <p className="font-semibold text-teal-900">
                        {currentCheckIn.primaryLocationName || 'นอกสถานที่'}
                      </p>
                    </div>
                    {currentCheckIn.selectedShiftName && (
                      <div className="bg-white/80 rounded-lg p-3">
                        <p className="text-teal-700">กะการทำงาน</p>
                        <p className="font-semibold text-teal-900">
                          {currentCheckIn.selectedShiftName}
                        </p>
                      </div>
                    )}
                    <div className="bg-white/80 rounded-lg p-3">
                      <p className="text-teal-700">สถานะ</p>
                      <p className="font-semibold text-teal-900">
                        {currentCheckIn.isLate ? `สาย ${currentCheckIn.lateMinutes} นาที` : 'ตรงเวลา'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent History */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">ประวัติล่าสุด</CardTitle>
              </CardHeader>
              <CardContent>
                <CheckInHistory limit={5} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}