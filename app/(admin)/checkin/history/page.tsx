// app/(admin)/checkin/history/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { CheckInRecord } from '@/types/checkin'
import { getCheckInRecords } from '@/lib/services/checkinService'
import { 
  Calendar,
  ArrowLeft,
  Loader2,
  Clock
} from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { th } from 'date-fns/locale'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { gradients } from '@/lib/theme/colors'
import TechLoader from '@/components/shared/TechLoader'
import { formatWorkingHours } from '@/lib/services/workingHoursService'

export default function CheckInHistoryPage() {
  const { userData } = useAuth()
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return format(now, 'yyyy-MM')
  })
  const [records, setRecords] = useState<CheckInRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalDays: 0,
    totalHours: 0,
    totalOT: 0,
    lateDays: 0
  })

  useEffect(() => {
    if (userData?.id) {
      fetchMonthlyData()
    }
  }, [userData?.id, selectedMonth])

  const fetchMonthlyData = async () => {
    try {
      setLoading(true)
      
      const [year, month] = selectedMonth.split('-').map(Number)
      const startDate = startOfMonth(new Date(year, month - 1))
      const endDate = endOfMonth(new Date(year, month - 1))
      
      const allRecords: CheckInRecord[] = []
      
      // Fetch data for each day of the month
      const dailyRecords = new Map<string, CheckInRecord[]>()
      let totalHours = 0
      let totalOT = 0
      let lateDays = new Set<string>()
      
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dateStr = format(date, 'yyyy-MM-dd')
        const { records } = await getCheckInRecords({
          date: dateStr,
          userId: userData!.id
        })
        
        if (records.length > 0) {
          dailyRecords.set(dateStr, records)
          
          // Calculate totals for the day
          let dayHours = 0
          let dayOT = 0
          let dayIsLate = false
          
          records.forEach(record => {
            dayHours += record.totalHours || 0
            dayOT += record.overtimeHours || 0
            if (record.isLate) dayIsLate = true
          })
          
          totalHours += dayHours
          totalOT += dayOT
          if (dayIsLate) lateDays.add(dateStr)
        }
      }
      
      // Flatten records for display
      const flatRecords: CheckInRecord[] = []
      dailyRecords.forEach(records => {
        flatRecords.push(...records)
      })
      
      setRecords(flatRecords.sort((a, b) => 
        new Date(b.checkinTime).getTime() - new Date(a.checkinTime).getTime()
      ))
      
      setStats({
        totalDays: dailyRecords.size, // Count unique days, not total records
        totalHours: Math.round(totalHours * 10) / 10,
        totalOT: Math.round(totalOT * 10) / 10,
        lateDays: lateDays.size // Count unique late days
      })
    } catch (error) {
      console.error('Error fetching monthly data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    // TODO: Implement export to Excel/CSV
    alert('ฟังก์ชัน Export กำลังพัฒนา')
  }

  if (loading && !records.length) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/checkin"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ประวัติการเช็คอิน</h1>
            <p className="text-gray-600 mt-1">ดูประวัติการเข้า-ออกงานย้อนหลัง</p>
          </div>
        </div>
      </div>

      {/* Month Selector */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-48"
              max={format(new Date(), 'yyyy-MM')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className={`inline-flex p-3 bg-gradient-to-br ${gradients.primaryLight} rounded-xl mb-3`}>
              <Calendar className="w-6 h-6 text-red-600" />
            </div>
            <p className="text-sm text-gray-600 mb-1">วันทำงาน</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalDays}</p>
            <p className="text-xs text-gray-500 mt-1">วัน</p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className={`inline-flex p-3 bg-gradient-to-br ${gradients.infoLight} rounded-xl mb-3`}>
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600 mb-1">ชั่วโมงรวม</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalHours}</p>
            <p className="text-xs text-gray-500 mt-1">ชั่วโมง</p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className={`inline-flex p-3 bg-gradient-to-br ${gradients.warningLight} rounded-xl mb-3`}>
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <p className="text-sm text-gray-600 mb-1">โอที</p>
            <p className="text-2xl font-bold text-orange-600">{stats.totalOT}</p>
            <p className="text-xs text-gray-500 mt-1">ชั่วโมง</p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className={`inline-flex p-3 bg-gradient-to-br ${gradients.errorLight} rounded-xl mb-3`}>
              <Calendar className="w-6 h-6 text-red-600" />
            </div>
            <p className="text-sm text-gray-600 mb-1">มาสาย</p>
            <p className="text-2xl font-bold text-red-600">{stats.lateDays}</p>
            <p className="text-xs text-gray-500 mt-1">ครั้ง</p>
          </CardContent>
        </Card>
      </div>

      {/* History List */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>
            รายละเอียด {format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: th })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">ไม่มีข้อมูลในเดือนนี้</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Group records by date for display */}
              {(() => {
                const groups = new Map<string, CheckInRecord[]>()
                
                records.forEach(record => {
                  const dateStr = format(
                    record.checkinTime instanceof Date 
                      ? record.checkinTime 
                      : new Date(record.checkinTime),
                    'yyyy-MM-dd'
                  )
                  
                  if (!groups.has(dateStr)) {
                    groups.set(dateStr, [])
                  }
                  groups.get(dateStr)!.push(record)
                })
                
                // Convert to array and sort by date
                const sortedGroups = Array.from(groups.entries())
                  .sort(([a], [b]) => b.localeCompare(a))
                
                return sortedGroups.map(([dateStr, dayRecords]) => {
                  const date = new Date(dateStr)
                  const dayHours = dayRecords.reduce((sum, r) => sum + (r.totalHours || 0), 0)
                  const dayOT = dayRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0)
                  const hasLate = dayRecords.some(r => r.isLate)
                  
                  return (
                    <Card key={dateStr} className="border-0 shadow-sm">
                      <CardContent className="p-4">
                        {/* Day Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {format(date, 'EEEE d MMMM', { locale: th })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                              {dayRecords.length} รายการ
                            </span>
                            {hasLate && (
                              <Badge variant="error" className="text-xs">
                                มาสาย
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Day Summary */}
                        <div className="flex items-center gap-4 mb-3 text-sm text-gray-600">
                          <span>รวม {formatWorkingHours(dayHours)}</span>
                          {dayOT > 0 && (
                            <Badge variant="warning" className="text-xs">
                              OT {formatWorkingHours(dayOT)}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Records for this day */}
                        <div className="space-y-2">
                          {dayRecords.map((record, index) => {
                            const checkinTime = record.checkinTime instanceof Date 
                              ? record.checkinTime 
                              : new Date(record.checkinTime)
                            const checkoutTime = record.checkoutTime 
                              ? (record.checkoutTime instanceof Date 
                                ? record.checkoutTime 
                                : new Date(record.checkoutTime))
                              : null
                            
                            return (
                              <div 
                                key={record.id}
                                className={`pl-6 py-2 ${
                                  index !== dayRecords.length - 1 ? 'border-b border-gray-100' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm font-medium">
                                      {format(checkinTime, 'HH:mm')} - {
                                        checkoutTime ? format(checkoutTime, 'HH:mm') : '--:--'
                                      }
                                    </span>
                                    {record.primaryLocationName && (
                                      <span className="text-sm text-gray-500">
                                        @ {record.primaryLocationName}
                                      </span>
                                    )}
                                    {record.selectedShiftName && (
                                      <Badge variant="info" className="text-xs ml-2">
                                        {record.selectedShiftName}
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    {record.totalHours > 0 && (
                                      <span className="text-sm text-gray-600">
                                        {formatWorkingHours(record.totalHours)}
                                      </span>
                                    )}
                                    {record.status === 'checked-in' && (
                                      <Badge variant="success" className="text-xs">
                                        กำลังทำงาน
                                      </Badge>
                                    )}
                                    {record.status === 'pending' && (
                                      <Badge variant="warning" className="text-xs">
                                        รออนุมัติ
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                
                                {(record.note || record.isLate) && (
                                  <div className="mt-1 ml-7 text-xs text-gray-500">
                                    {record.isLate && (
                                      <span className="text-red-500">
                                        สาย {record.lateMinutes} นาที
                                      </span>
                                    )}
                                    {record.note && (
                                      <span className="ml-2">
                                        💬 {record.note}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}