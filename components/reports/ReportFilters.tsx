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
  const { users } = useUsers()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [openUserSelect, setOpenUserSelect] = useState(false)
  const [openLocationSelect, setOpenLocationSelect] = useState(false)
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [locationSearchTerm, setLocationSearchTerm] = useState('')
  const [filteredUsers, setFilteredUsers] = useState(users)

  // Filter users based on search term
  useEffect(() => {
    if (!userSearchTerm) {
      setFilteredUsers(users)
    } else {
      const searchLower = userSearchTerm.toLowerCase()
      setFilteredUsers(
        users.filter(u =>
          u.fullName.toLowerCase().includes(searchLower) ||
          u.phone?.includes(searchLower) ||
          u.lineDisplayName?.toLowerCase().includes(searchLower)
        )
      )
    }
  }, [userSearchTerm, users])

  const filteredLocations = locationSearchTerm
    ? locations.filter(l => l.name.toLowerCase().includes(locationSearchTerm.toLowerCase()))
    : locations


  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const removeSelectedUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(id => id !== userId))
  }

  const generateReport = async (page: number = 1) => {
    try {
      setLoading(true)
      onLoadingChange(true)

      const filters: AttendanceReportFilters = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        userIds: selectedUsers.length > 0 ? selectedUsers : undefined,
        locationId: selectedLocation || undefined,
        page,
        pageSize,
        showOnlyPresent: true,
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
  }, [startDate, endDate, selectedUsers, selectedLocation, pageSize])

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
                  <div className="flex items-center border-b px-3 py-2 bg-gray-50">
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
                      className="flex cursor-pointer items-center px-4 py-2 text-sm hover:bg-gray-100 border-b"
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

          {/* User filter */}
          <div>
            <Label className="text-gray-500 mb-1">พนักงาน</Label>
            <Popover open={openUserSelect} onOpenChange={setOpenUserSelect}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full h-[42px] justify-between font-normal px-3"
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    {selectedUsers.length > 0 ? `${selectedUsers.length} คน` : 'ทั้งหมด'}
                  </span>
                  {selectedUsers.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">{selectedUsers.length}</Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-0">
                <div className="flex items-center border-b px-3 py-2 bg-gray-50">
                  <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  <input
                    placeholder="ค้นหาชื่อหรือเบอร์โทร..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="h-7 w-full bg-white rounded px-2 text-sm outline-none border border-gray-200 focus:border-gray-400"
                    autoFocus
                  />
                </div>
                <div className="max-h-[280px] overflow-auto">
                  {selectedUsers.length > 0 && (
                    <div
                      onClick={() => { setSelectedUsers([]); setUserSearchTerm('') }}
                      className="flex cursor-pointer items-center px-4 py-2 text-sm hover:bg-gray-100 border-b"
                    >
                      <span className="font-medium text-red-600">ล้างการเลือกทั้งหมด ({selectedUsers.length})</span>
                    </div>
                  )}
                  {filteredUsers.length === 0 ? (
                    <div className="py-6 text-center text-sm text-gray-500">ไม่พบพนักงานที่ค้นหา</div>
                  ) : (
                    filteredUsers.map(user => (
                      <div
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id!)}
                        className="flex cursor-pointer items-center justify-between px-4 py-2 text-sm hover:bg-gray-100"
                      >
                        <div>
                          <p className="font-medium">{user.fullName}</p>
                          {user.phone && <p className="text-xs text-gray-500">{user.phone}</p>}
                        </div>
                        {selectedUsers.includes(user.id!) && (
                          <Check className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Generate button — 4th column, aligned to bottom */}
          <div>
            <Label className="text-gray-500 mb-1 invisible">ดูข้อมูล</Label>
            <Button
              onClick={() => generateReport(1)}
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-500 to-rose-600 h-[42px]"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังดึงข้อมูล...</>
              ) : (
                <><Filter className="w-4 h-4 mr-2" />ดูข้อมูล</>
              )}
            </Button>
          </div>
        </div>

        {/* Selected user tags */}
        {selectedUsers.length > 0 && (
          <div className="flex items-start gap-2">
            <Label className="text-xs text-gray-500 mt-1 min-w-[56px]">เลือก:</Label>
            <div className="flex flex-wrap gap-1">
              {selectedUsers.map(userId => {
                const user = users.find(u => u.id === userId)
                return user ? (
                  <Badge
                    key={userId}
                    variant="secondary"
                    className="cursor-pointer hover:bg-gray-200 flex items-center gap-1 h-5 px-2 text-xs"
                    onClick={() => removeSelectedUser(userId)}
                  >
                    {user.fullName}
                    <X className="w-2.5 h-2.5" />
                  </Badge>
                ) : null
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
