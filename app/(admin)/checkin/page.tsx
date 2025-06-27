// app/(admin)/checkin/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCheckIn } from '@/hooks/useCheckIn'
import CheckInButton from '@/components/checkin/CheckInButton'
import { Clock, MapPin, Calendar, TrendingUp, History, User, Briefcase } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { gradients } from '@/lib/theme/colors'
import Link from 'next/link'

export default function CheckInPage() {
  const { userData } = useAuth()
  const { currentCheckIn } = useCheckIn()
  
  const [currentTime, setCurrentTime] = useState(new Date())
  const [workingHours, setWorkingHours] = useState({ hours: 0, minutes: 0, overtime: 0 })

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
      
      // Calculate working hours if checked in
      if (currentCheckIn?.checkinTime) {
        const checkinTime = currentCheckIn.checkinTime instanceof Date 
          ? currentCheckIn.checkinTime 
          : new Date(currentCheckIn.checkinTime)
        
        const diff = currentTime.getTime() - checkinTime.getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const overtime = Math.max(0, hours - 8)
        
        setWorkingHours({ hours, minutes, overtime })
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [currentCheckIn])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">เช็คอิน/เอาท์</h1>
          <p className="text-gray-600 mt-1">
            {format(currentTime, 'EEEE, dd MMMM yyyy', { locale: th })}
          </p>
        </div>
        
        <Link href="/checkin/history">
          <Button variant="outline" className="gap-2">
            <History className="w-4 h-4" />
            ดูประวัติ
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - User Info & Stats */}
        <div className="lg:col-span-4 space-y-4">
          {/* User Card */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                {userData?.linePictureUrl ? (
                  <img
                    src={userData.linePictureUrl}
                    alt={userData.lineDisplayName || userData.fullName}
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-gray-500" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {userData?.lineDisplayName || userData?.fullName}
                  </h3>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5" />
                    {userData?.role === 'admin' ? 'ผู้ดูแลระบบ' : 
                     userData?.role === 'hr' ? 'ฝ่ายบุคคล' :
                     userData?.role === 'manager' ? 'ผู้จัดการ' : 'พนักงาน'}
                  </p>
                </div>
              </div>
              
              {/* Real-time Clock */}
              <div className="mt-6 text-center">
                <div className="text-4xl font-bold text-gray-900 tabular-nums">
                  {format(currentTime, 'HH:mm:ss')}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Working Hours Card - Show only when checked in */}
          {currentCheckIn && (
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-600" />
                  เวลาทำงานวันนี้
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Working Time */}
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-blue-700">ทำงานมาแล้ว</span>
                  <span className="font-bold text-blue-900">
                    {workingHours.hours}:{String(workingHours.minutes).padStart(2, '0')} ชม.
                  </span>
                </div>
                
                {/* Overtime */}
                {workingHours.overtime > 0 && (
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                    <span className="text-sm text-orange-700">โอที</span>
                    <span className="font-bold text-orange-900">
                      {workingHours.overtime} ชม.
                    </span>
                  </div>
                )}
                
                {/* Check-in Details */}
                <div className="pt-3 border-t border-gray-200 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">เข้างาน</span>
                    <span className="font-medium">
                      {format(
                        currentCheckIn.checkinTime instanceof Date 
                          ? currentCheckIn.checkinTime 
                          : new Date(currentCheckIn.checkinTime),
                        'HH:mm'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">สถานที่</span>
                    <span className="font-medium">
                      {currentCheckIn.primaryLocationName || 'นอกสถานที่'}
                    </span>
                  </div>
                  {currentCheckIn.isLate && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">สถานะ</span>
                      <Badge variant="warning" className="text-xs">
                        สาย {currentCheckIn.lateMinutes} นาที
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - CheckIn Button & Map */}
        <div className="lg:col-span-8">
          <CheckInButton />
        </div>
      </div>
    </div>
  )
}