// app/(admin)/checkin/history/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { CheckInRecord } from '@/types/checkin'
import { getCheckInRecords } from '@/lib/services/checkinService'
import { 
  Calendar,
  Download,
  Filter,
  ArrowLeft,
  Loader2
} from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { th } from 'date-fns/locale'
import Link from 'next/link'
import CheckInHistory from '@/components/checkin/CheckInHistory'

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
      let totalHours = 0
      let totalOT = 0
      let lateDays = 0
      
      // Fetch data for each day of the month
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dateStr = format(date, 'yyyy-MM-dd')
        const { records } = await getCheckInRecords({
          date: dateStr,
          userId: userData!.id
        })
        
        records.forEach(record => {
          allRecords.push(record)
          totalHours += record.totalHours || 0
          totalOT += record.overtimeHours || 0
          if (record.isLate) lateDays++
        })
      }
      
      setRecords(allRecords.sort((a, b) => 
        new Date(b.checkinTime).getTime() - new Date(a.checkinTime).getTime()
      ))
      
      setStats({
        totalDays: allRecords.length,
        totalHours: Math.round(totalHours * 10) / 10,
        totalOT: Math.round(totalOT * 10) / 10,
        lateDays
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

      {/* Month Selector & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            max={format(new Date(), 'yyyy-MM')}
          />
        </div>
        
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600 mb-1">วันทำงาน</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalDays}</p>
          <p className="text-xs text-gray-500 mt-1">วัน</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600 mb-1">ชั่วโมงรวม</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalHours}</p>
          <p className="text-xs text-gray-500 mt-1">ชั่วโมง</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600 mb-1">โอที</p>
          <p className="text-2xl font-bold text-orange-600">{stats.totalOT}</p>
          <p className="text-xs text-gray-500 mt-1">ชั่วโมง</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600 mb-1">มาสาย</p>
          <p className="text-2xl font-bold text-red-600">{stats.lateDays}</p>
          <p className="text-xs text-gray-500 mt-1">ครั้ง</p>
        </div>
      </div>

      {/* History List */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            รายละเอียด {format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: th })}
          </h3>
        </div>
        <div className="p-6">
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
            <CheckInHistory 
              limit={999} 
              showViewAll={false} 
            />
          )}
        </div>
      </div>
    </div>
  )
}