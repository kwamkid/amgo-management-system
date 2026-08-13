// components/reports/ReportFilters.tsx

'use client'

import { useState, useEffect } from 'react'
import React from 'react'
import { Filter, Loader2, Users, Search, X, MapPin, Check } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { useLocations } from '@/hooks/useLocations'
import { useUsers } from '@/hooks/useUsers'
import { useToast } from '@/hooks/useToast'
import {
  getAttendanceReportPaginated,
  AttendanceReportData,
  AttendanceReportFilters,
  AttendanceReportResponse
} from '@/lib/services/reportService'

interface ReportFiltersProps {
  onGenerateReport: (
    data: AttendanceReportData[],
    summary: any[],
    filters: AttendanceReportFilters,
    pagination?: AttendanceReportResponse['pagination']
  ) => void
  onLoadingChange: (loading: boolean) => void
  pageSize: number
  onPageSizeChange: (size: number) => void
}

export default function ReportFilters({
  onGenerateReport,
  onLoadingChange,
  pageSize,
}: ReportFiltersProps) {
  const { locations } = useLocations()
  // เฉพาะพนักงานปัจจุบัน — คนที่ออกแล้วไม่ขึ้นในตัวเลือก (ประวัติยังอยู่ในรายงานตามข้อมูลจริง)
  const { users } = useUsers({ isActive: true, pageSize: 200 })
  const { showToast } = useToast()

  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [onlyPresent, setOnlyPresent] = useState(false)

  const [openLocationSelect, setOpenLocationSelect] = useState(false)
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [locationSearchTerm, setLocationSearchTerm] = useState('')


  const filteredLocations = locationSearchTerm
    ? locations.filter(l => l.name.toLowerCase().includes(locationSearchTerm.toLowerCase()))
    : locations




  const generateReport = async (page: number = 1) => {
    try {
      setLoading(true)
      onLoadingChange(true)

      // พิมพ์ชื่อ = กรองทุกคนที่ชื่อ/ชื่อเล่น/เบอร์เข้าเค้า — ว่าง = ทั้งหมด
      const q = userSearchTerm.trim().toLowerCase()
      const matchedIds = q
        ? users
            .filter(
              (u) =>
                u.fullName?.toLowerCase().includes(q) ||
                u.nickname?.toLowerCase().includes(q) ||
                u.phone?.includes(q)
            )
            .map((u) => u.id!)
        : []
      if (q && matchedIds.length === 0) {
        showToast('ไม่พบพนักงานชื่อนี้', 'error')
        setLoading(false)
        onLoadingChange(false)
        return
      }

      const filters: AttendanceReportFilters = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        userIds: matchedIds.length > 0 ? matchedIds : undefined,
        locationId: selectedLocation || undefined,
        page,
        pageSize,
        // ค่าเริ่มต้นแสดงทุกวัน — วันขาดคือสิ่งที่ HR ต้องเห็น ไม่ใช่สิ่งที่ถูกซ่อน
        showOnlyPresent: onlyPresent,
      } as AttendanceReportFilters

      const response = await getAttendanceReportPaginated(filters)
      onGenerateReport(response.data, response.summary || [], filters, response.pagination)
      showToast('ดึงข้อมูลสำเร็จ', 'success')
    } catch (error: any) {
      showToast(error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล', 'error')
    } finally {
      setLoading(false)
      onLoadingChange(false)
    }
  }

  // Expose generateReport to parent via window (for page-size-change re-fetch)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__generateReport = generateReport
    }
  }, [startDate, endDate, userSearchTerm, selectedLocation, pageSize, onlyPresent])

  const useLocationCombobox = locations.length > 7
  const selectedLocationName = locations.find(l => l.id === selectedLocation)?.name

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">ตัวกรองข้อมูล</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date + Location + User + Button row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          {/* Date range picker */}
          <div>
            <Label className="text-gray-500 mb-1">ช่วงเวลา</Label>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => { setStartDate(s); setEndDate(e) }}
              className="w-full"
            />
          </div>

          {/* Location filter — combobox when >7, plain select otherwise */}
          <div>
            <Label className="text-gray-500 mb-1">สถานที่</Label>
            {useLocationCombobox ? (
              <Popover open={openLocationSelect} onOpenChange={setOpenLocationSelect}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full h-[42px] justify-between font-normal px-3"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                      <span className="truncate">{selectedLocationName || 'ทั้งหมด'}</span>
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0">
                  <div className="flex items-center border-b border-gray-100 px-3 py-2 bg-gray-50">
                    <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    <input
                      placeholder="ค้นหาสถานที่..."
                      value={locationSearchTerm}
                      onChange={(e) => setLocationSearchTerm(e.target.value)}
                      className="h-7 w-full bg-white rounded px-2 text-sm outline-none border border-gray-200 focus:border-gray-400"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[240px] overflow-auto">
                    <div
                      onClick={() => { setSelectedLocation(''); setOpenLocationSelect(false); setLocationSearchTerm('') }}
                      className="flex cursor-pointer items-center px-4 py-2 text-sm hover:bg-gray-100 border-b border-gray-100"
                    >
                      <Check className={`mr-2 h-3.5 w-3.5 ${!selectedLocation ? 'opacity-100' : 'opacity-0'}`} />
                      ทั้งหมด
                    </div>
                    {filteredLocations.map(loc => (
                      <div
                        key={loc.id}
                        onClick={() => { setSelectedLocation(loc.id); setOpenLocationSelect(false); setLocationSearchTerm('') }}
                        className="flex cursor-pointer items-center px-4 py-2 text-sm hover:bg-gray-100"
                      >
                        <Check className={`mr-2 h-3.5 w-3.5 ${selectedLocation === loc.id ? 'opacity-100' : 'opacity-0'}`} />
                        {loc.name}
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Select
                value={selectedLocation || 'all'}
                onValueChange={(v) => setSelectedLocation(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="h-[42px]">
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* User filter — พิมพ์ค้นตรง ๆ (เจ้าของสั่งเลิกใช้ dropdown เลือกคน) */}
          <div>
            <Label className="text-gray-500 mb-1">พนักงาน</Label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="พิมพ์ชื่อ/ชื่อเล่น — ว่าง = ทั้งหมด"
                className="h-[42px] w-full rounded-md border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-red-400"
              />
            </div>
          </div>

          {/* Generate button + checkbox — คอลัมน์สุดท้าย อยู่บรรทัดเดียวกับ input ทั้งแถว */}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => generateReport(1)}
              disabled={loading}
              className="shrink-0 bg-gradient-to-r from-red-500 to-rose-600 h-[42px] px-5"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังดึงข้อมูล...</>
              ) : (
                <><Filter className="w-4 h-4 mr-2" />ดูข้อมูล</>
              )}
            </Button>
            <label
              className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-gray-600"
              title="ซ่อนวันขาด/วันหยุด เหลือเฉพาะวันที่มาทำงานจริง"
            >
              <input
                type="checkbox"
                checked={onlyPresent}
                onChange={(e) => setOnlyPresent(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-red-600"
              />
              เฉพาะวันที่มา
            </label>
          </div>
        </div>


      </CardContent>
    </Card>
  )
}
