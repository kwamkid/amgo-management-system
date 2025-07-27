// components/reports/ReportFilters.tsx - Updated to use API

'use client'

import { useState, useCallback, useEffect } from 'react'
import React from 'react'
import { Filter, Loader2, Users, Search, X } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from '@/components/ui/badge'
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
}

export default function ReportFilters({ 
  onGenerateReport,
  onLoadingChange 
}: ReportFiltersProps) {
  const { locations } = useLocations()
  const { users } = useUsers()
  const { showToast } = useToast()
  
  // States
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  )
  const [endDate, setEndDate] = useState(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  )
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [openUserSelect, setOpenUserSelect] = useState(false)
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [filteredUsers, setFilteredUsers] = useState(users)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [selectedPreset, setSelectedPreset] = useState<string>('thisMonth') // Track selected preset
  
  // Filter users based on search term
  useEffect(() => {
    if (!userSearchTerm) {
      setFilteredUsers(users)
    } else {
      const searchLower = userSearchTerm.toLowerCase()
      const filtered = users.filter(user => 
        user.fullName.toLowerCase().includes(searchLower) ||
        user.phone?.includes(searchLower) ||
        user.lineDisplayName?.toLowerCase().includes(searchLower)
      )
      setFilteredUsers(filtered)
    }
  }, [userSearchTerm, users])
  
  // Quick date ranges
  const setDateRange = (type: string) => {
    const now = new Date()
    setSelectedPreset(type) // Set selected preset
    
    switch (type) {
      case 'today':
        setStartDate(format(now, 'yyyy-MM-dd'))
        setEndDate(format(now, 'yyyy-MM-dd'))
        break
      case 'yesterday':
        const yesterday = new Date(now)
        yesterday.setDate(now.getDate() - 1)
        setStartDate(format(yesterday, 'yyyy-MM-dd'))
        setEndDate(format(yesterday, 'yyyy-MM-dd'))
        break
      case 'thisWeek':
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay())
        const weekEnd = new Date(now)
        weekEnd.setDate(now.getDate() + (6 - now.getDay()))
        setStartDate(format(weekStart, 'yyyy-MM-dd'))
        setEndDate(format(weekEnd, 'yyyy-MM-dd'))
        break
      case 'lastWeek':
        const lastWeekStart = new Date(now)
        lastWeekStart.setDate(now.getDate() - now.getDay() - 7)
        const lastWeekEnd = new Date(now)
        lastWeekEnd.setDate(now.getDate() - now.getDay() - 1)
        setStartDate(format(lastWeekStart, 'yyyy-MM-dd'))
        setEndDate(format(lastWeekEnd, 'yyyy-MM-dd'))
        break
      case 'thisMonth':
        setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'))
        setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'))
        break
      case 'lastMonth':
        const lastMonth = subMonths(now, 1)
        setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd'))
        setEndDate(format(endOfMonth(lastMonth), 'yyyy-MM-dd'))
        break
    }
    setCurrentPage(1) // Reset page when changing date range
  }
  
  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId)
      } else {
        return [...prev, userId]
      }
    })
  }
  
  // Remove selected user
  const removeSelectedUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(id => id !== userId))
  }
  
  // Clear all selected users
  const clearSelectedUsers = () => {
    setSelectedUsers([])
    setUserSearchTerm('')
  }
  
  // Generate report using API
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
        showOnlyPresent: true // Default to show only present
      } as AttendanceReportFilters // Type assertion to fix TS error
      
      console.log('Sending request with filters:', filters)
      
      const response = await getAttendanceReportPaginated(filters)
      console.log('Received response:', response)
      
      setCurrentPage(page)
      onGenerateReport(
        response.data, 
        response.summary || [], 
        filters,
        response.pagination
      )
      showToast('ดึงข้อมูลสำเร็จ', 'success')
    } catch (error: any) {
      console.error('Error generating report:', error)
      showToast(error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล', 'error')
    } finally {
      setLoading(false)
      onLoadingChange(false)
    }
  }
  
  // Export generate function to parent
  React.useEffect(() => {
    // Store the generateReport function in a way the parent can access
    if (typeof window !== 'undefined') {
      (window as any).__generateReport = generateReport
    }
  }, [startDate, endDate, selectedUsers, selectedLocation, pageSize])
  
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">ตัวกรองข้อมูล</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-sm">แสดง:</Label>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-500">รายการ</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Section */}
        <div className="space-y-3">
          {/* Quick Date Ranges */}
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium min-w-[60px]">ช่วงเวลา</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedPreset === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('today')}
                className="cursor-pointer hover:bg-gray-100 h-8"
              >
                วันนี้
              </Button>
              <Button
                variant={selectedPreset === 'yesterday' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('yesterday')}
                className="cursor-pointer hover:bg-gray-100 h-8"
              >
                เมื่อวาน
              </Button>
              <Button
                variant={selectedPreset === 'thisWeek' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('thisWeek')}
                className="cursor-pointer hover:bg-gray-100 h-8"
              >
                สัปดาห์นี้
              </Button>
              <Button
                variant={selectedPreset === 'lastWeek' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('lastWeek')}
                className="cursor-pointer hover:bg-gray-100 h-8"
              >
                สัปดาห์ที่แล้ว
              </Button>
              <Button
                variant={selectedPreset === 'thisMonth' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('thisMonth')}
                className="cursor-pointer hover:bg-gray-100 h-8"
              >
                เดือนนี้
              </Button>
              <Button
                variant={selectedPreset === 'lastMonth' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('lastMonth')}
                className="cursor-pointer hover:bg-gray-100 h-8"
              >
                เดือนที่แล้ว
              </Button>
            </div>
          </div>
          
          {/* Date Range Inputs + Location + User in one row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-sm mb-1">วันที่เริ่มต้น</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setSelectedPreset('') // Clear preset when custom date
                  setCurrentPage(1)
                }}
                className="cursor-pointer h-10"
              />
            </div>
            
            <div>
              <Label className="text-sm mb-1">วันที่สิ้นสุด</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setSelectedPreset('') // Clear preset when custom date
                  setCurrentPage(1)
                }}
                className="cursor-pointer h-10"
              />
            </div>
            
            {/* Location Filter */}
            <div>
              <Label className="text-sm mb-1">สถานที่</Label>
              <Select
                value={selectedLocation || 'all'}
                onValueChange={(value) => {
                  setSelectedLocation(value === 'all' ? '' : value)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="cursor-pointer h-10">
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {locations.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* User Filter with Auto Search */}
            <div>
              <Label className="text-sm mb-1">พนักงาน</Label>
              <Popover open={openUserSelect} onOpenChange={setOpenUserSelect}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openUserSelect}
                    className="w-full h-10 justify-between cursor-pointer font-normal px-3"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4" />
                      {selectedUsers.length > 0 
                        ? `${selectedUsers.length} คน`
                        : "ทั้งหมด"
                      }
                    </span>
                    {selectedUsers.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                        {selectedUsers.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <div className="flex items-center border-b px-3 py-2 bg-gray-50">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                      placeholder="ค้นหาชื่อหรือเบอร์โทร..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="flex h-8 w-full rounded-md bg-white px-2 py-1 text-sm outline-none border border-gray-200 focus:border-gray-400 placeholder:text-gray-400"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[300px] overflow-auto">
                    {selectedUsers.length > 0 && (
                      <div
                        onClick={clearSelectedUsers}
                        className="relative flex cursor-pointer select-none items-center rounded-sm px-4 py-2 text-sm outline-none hover:bg-gray-100 border-b"
                      >
                        <span className="font-medium text-red-600">ล้างการเลือกทั้งหมด ({selectedUsers.length})</span>
                      </div>
                    )}
                    {filteredUsers.length === 0 ? (
                      <div className="py-6 text-center text-sm text-gray-500">
                        ไม่พบพนักงานที่ค้นหา
                      </div>
                    ) : (
                      filteredUsers.map(user => (
                        <div
                          key={user.id}
                          onClick={() => toggleUserSelection(user.id!)}
                          className="relative flex cursor-pointer select-none items-center rounded-sm px-4 py-2 text-sm outline-none hover:bg-gray-100"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div>
                              <p className="font-medium">{user.fullName}</p>
                              {user.phone && (
                                <p className="text-sm text-gray-500">{user.phone}</p>
                              )}
                            </div>
                            {selectedUsers.includes(user.id!) && (
                              <Badge variant="default" className="ml-2">
                                ✓
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        
        {/* Selected Users Display - More compact */}
        {selectedUsers.length > 0 && (
          <div className="flex items-start gap-2">
            <Label className="text-sm text-gray-600 mt-1">เลือก:</Label>
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map(userId => {
                const user = users.find(u => u.id === userId)
                return user ? (
                  <Badge 
                    key={userId} 
                    variant="secondary"
                    className="cursor-pointer hover:bg-gray-200 flex items-center gap-1 h-6 px-2 text-xs"
                    onClick={() => removeSelectedUser(userId)}
                  >
                    {user.fullName}
                    <X className="w-3 h-3" />
                  </Badge>
                ) : null
              })}
            </div>
          </div>
        )}
        
        {/* Generate Button */}
        <div className="pt-2">
          <Button
            onClick={() => generateReport(1)}
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-500 to-rose-600 cursor-pointer h-10"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังดึงข้อมูล...
              </>
            ) : (
              <>
                <Filter className="w-4 h-4 mr-2" />
                ดูข้อมูล
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}