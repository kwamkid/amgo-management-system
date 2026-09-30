// app/(admin)/checkin/history/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { PageHeader, StatCard, StatusBadge, InfoPanel } from '@/components/shared'
import { useAuth } from '@/hooks/useAuth'
import { CheckInRecord } from '@/types/checkin'
import { getCheckInRecords } from '@/lib/services/checkinService'
import { Calendar, Clock, History } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { th } from 'date-fns/locale'
import TechLoader from '@/components/shared/TechLoader'
import { formatWorkingHours } from '@/lib/services/workingHoursService'
import { Input, Pill, Card, CardContent, CardHeader, CardTitle, EmptyState, Spinner } from '@/components/aoo'
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
      
      // ทั้งเดือน query เดียว
      // (ของเดิมวนยิงทีละวัน = 28-31 query ต่อการเปิดหน้า 1 ครั้ง
      //  เพราะ Firestore เก็บซ้อนเป็น checkins/{วันที่}/records จึงข้ามวันไม่ได้)
      const { records } = await getCheckInRecords(
        {
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          userId: userData!.id,
        },
        1000
      )

      // สรุปยอด — จัดกลุ่มตามวันเพื่อนับ "จำนวนวัน" ไม่ใช่ "จำนวนแถว"
      // (คนหนึ่งเช็คอินได้หลายรอบต่อวัน ข้อมูลจริงสูงสุด 4)
      const dayKeys = new Set<string>()
      const lateDays = new Set<string>()
      let totalHours = 0
      let totalOT = 0

      for (const r of records) {
        const key = format(new Date(r.checkinTime), 'yyyy-MM-dd')
        dayKeys.add(key)
        totalHours += r.totalHours || 0
        totalOT += r.overtimeHours || 0
        if (r.isLate) lateDays.add(key)
      }

      setRecords(
        [...records].sort(
          (a, b) => new Date(b.checkinTime).getTime() - new Date(a.checkinTime).getTime()
        )
      )

      setStats({
        totalDays: dayKeys.size,
        totalHours: Math.round(totalHours * 10) / 10,
        totalOT: Math.round(totalOT * 10) / 10,
        lateDays: lateDays.size,
      })
    } catch (error) {
      console.error('Error fetching monthly data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !records.length) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ประวัติการเช็คอิน"
        description="ดูประวัติการเข้า-ออกงานย้อนหลัง"
        icon={Clock}
        backHref="/checkin"
      />

      {/* Month Selector */}
      <Card padding={0}>
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
        <StatCard label="วันทำงาน" value={stats.totalDays} unit="วัน" icon={Calendar} tone="sky" />
        <StatCard label="ชั่วโมงรวม" value={stats.totalHours} unit="ชั่วโมง" icon={Clock} tone="grape" />
        <StatCard label="โอที" value={stats.totalOT} unit="ชั่วโมง" icon={Clock} tone="accent" />
        <StatCard label="มาสาย" value={stats.lateDays} unit="ครั้ง" icon={Clock} tone="danger" />
      </div>

      {/* History List */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={History} tone="sky">
            รายละเอียด {format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: th })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : records.length === 0 ? (
            <EmptyState icon={<Calendar size={40} />} title="ไม่มีข้อมูลในเดือนนี้" />
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
                    <InfoPanel key={dateStr}>
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
                              <StatusBadge status="late" />
                            )}
                          </div>
                        </div>
                        
                        {/* Day Summary */}
                        <div className="flex items-center gap-4 mb-3 text-sm text-gray-600">
                          <span>รวม {formatWorkingHours(dayHours)}</span>
                          {dayOT > 0 && (
                            <Pill tone="accent">
                              OT {formatWorkingHours(dayOT)}
                            </Pill>
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
                                    <span className="text-sm text-gray-500">
                                      @ {record.primaryLocationName || 'เช็คอินนอกสถานที่'}
                                    </span>
                                    {record.selectedShiftName && (
                                      <Pill tone="info">
                                        {record.selectedShiftName}
                                      </Pill>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    {record.totalHours > 0 && (
                                      <span className="text-sm text-gray-600">
                                        {formatWorkingHours(record.totalHours)}
                                      </span>
                                    )}
                                    {(record.status === 'checked-in' || record.status === 'pending') && (
                                      <StatusBadge status={record.status} />
                                    )}
                                  </div>
                                </div>
                                
                                {(record.note || record.isLate) && (
                                  <div className="mt-1 ml-7 text-xs text-gray-500">
                                    {record.isLate && (
                                      <span className="text-[var(--ruby-700)]">
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
                    </InfoPanel>
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