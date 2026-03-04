// components/reports/ReportResults.tsx - Updated with pagination

'use client'

import { useState } from 'react'
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AttendanceReportData, AttendanceReportFilters, AttendanceReportResponse } from '@/lib/services/reportService'

interface ReportResultsProps {
  reportData: AttendanceReportData[]
  summaryData: any[]
  loading: boolean
  filters: AttendanceReportFilters | null
  pagination?: AttendanceReportResponse['pagination']
  onPageChange?: (page: number) => void
  pageSize?: number
  onPageSizeChange?: (size: number) => void
}

export default function ReportResults({
  reportData,
  summaryData,
  loading,
  filters,
  pagination,
  onPageChange,
  pageSize = 50,
  onPageSizeChange,
}: ReportResultsProps) {
  const [activeTab, setActiveTab] = useState('daily')
  const [loadingPage, setLoadingPage] = useState(false)
  
  // Handle page change with loading state
  const handlePageChange = async (page: number) => {
    if (!onPageChange || loadingPage) return
    
    // เพิ่ม delay เล็กน้อยเพื่อให้เห็น loading state
    setLoadingPage(true)
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
    try {
      await onPageChange(page)
    } finally {
      // เพิ่ม delay เล็กน้อยเพื่อให้ UX ดีขึ้น
      setTimeout(() => {
        setLoadingPage(false)
      }, 300)
    }
  }
  
  // Empty State
  if (!loading && reportData.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Clock className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-gray-500 text-center">
            เลือกช่วงเวลาและกดปุ่ม "ดูข้อมูล" เพื่อดูรายงาน
          </p>
        </CardContent>
      </Card>
    )
  }
  
  // Loading State
  if (loading) {
    return null
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base">
            ผลลัพธ์รายงาน
            {pagination && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({reportData.length} / {pagination.totalRecords} รายการ)
              </span>
            )}
          </CardTitle>
          {filters && (
            <Badge variant="secondary" className="text-xs">
              {format(filters.startDate, 'dd MMM', { locale: th })} –{' '}
              {format(filters.endDate, 'dd MMM yyyy', { locale: th })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="daily">รายวัน</TabsTrigger>
            <TabsTrigger value="summary">สรุปรายคน</TabsTrigger>
          </TabsList>
          
          {/* Daily Report */}
          <TabsContent value="daily" className="mt-4">
            {loadingPage ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="inline-flex items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                      <span className="ml-3 text-gray-600">กำลังโหลดข้อมูล...</span>
                    </div>
                  </div>
                </div>
                {/* Skeleton loader */}
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <DailyReportTable data={reportData} />
                <PaginationControls
                  pagination={pagination}
                  onPageChange={handlePageChange}
                  loading={loadingPage}
                  pageSize={pageSize}
                  onPageSizeChange={onPageSizeChange}
                />
              </>
            )}
          </TabsContent>
          
          {/* Summary Report */}
          <TabsContent value="summary" className="mt-4">
            <SummaryReportTable data={summaryData} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// Pagination Controls Component
function PaginationControls({
  pagination,
  onPageChange,
  loading = false,
  pageSize,
  onPageSizeChange,
}: {
  pagination?: AttendanceReportResponse['pagination']
  onPageChange?: (page: number) => void
  loading?: boolean
  pageSize?: number
  onPageSizeChange?: (size: number) => void
}) {
  const getPageNumbers = (currentPage: number, totalPages: number) => {
    const pages: (number | string)[] = []
    const max = 7
    const half = Math.floor(max / 2)
    let start = Math.max(1, currentPage - half)
    let end = Math.min(totalPages, currentPage + half)
    if (currentPage <= half) end = Math.min(totalPages, max)
    if (currentPage + half >= totalPages) start = Math.max(1, totalPages - max + 1)
    if (start > 1) { pages.push(1); if (start > 2) pages.push('...') }
    for (let i = start; i <= end; i++) pages.push(i)
    if (end < totalPages) { if (end < totalPages - 1) pages.push('...'); pages.push(totalPages) }
    return pages
  }

  const showPages = pagination && pagination.totalPages > 1

  return (
    <div className="flex items-center justify-between mt-4 pt-3 border-t px-1">
      {/* Left: rows per page */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">แสดง</span>
        <Select
          value={String(pageSize ?? 50)}
          onValueChange={(v) => onPageSizeChange?.(Number(v))}
        >
          <SelectTrigger className="h-7 w-16 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[20, 50, 100, 200].map(n => (
              <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-500">รายการ/หน้า</span>
        {pagination && (
          <span className="text-xs text-gray-400 ml-2">
            หน้า {pagination.currentPage} / {pagination.totalPages}
          </span>
        )}
      </div>

      {/* Right: page navigation */}
      {showPages && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(pagination!.currentPage - 1)}
            disabled={!pagination!.hasPrev || loading}
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          {getPageNumbers(pagination!.currentPage, pagination!.totalPages).map((page, i) => (
            <div key={i}>
              {page === '...' ? (
                <span className="px-1.5 text-xs text-gray-400">...</span>
              ) : (
                <Button
                  variant={page === pagination!.currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange?.(page as number)}
                  disabled={loading}
                  className="h-7 min-w-[28px] px-1.5 text-xs"
                >
                  {page}
                </Button>
              )}
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(pagination!.currentPage + 1)}
            disabled={!pagination!.hasNext || loading}
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

// Daily Report Table Component
function DailyReportTable({ data }: { data: AttendanceReportData[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">ไม่มีข้อมูลตามเงื่อนไขที่เลือก</p>
      </div>
    )
  }
  
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>วันที่</TableHead>
            <TableHead>ชื่อพนักงาน</TableHead>
            <TableHead>เวลาเข้า</TableHead>
            <TableHead>เวลาออก</TableHead>
            <TableHead>รวม (ชม.)</TableHead>
            <TableHead>สถานที่</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead>หมายเหตุ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((record, index) => (
            <TableRow key={`${record.date}-${record.userId}-${index}`}>
              <TableCell>
                {format(new Date(record.date), 'dd/MM/yyyy')}
              </TableCell>
              <TableCell>{record.userName}</TableCell>
              <TableCell>
                <Badge variant={record.firstCheckIn === '-' ? 'secondary' : 'default'}>
                  {record.firstCheckIn}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={record.lastCheckOut === '-' ? 'secondary' : 'default'}>
                  {record.lastCheckOut}
                </Badge>
              </TableCell>
              <TableCell>
                {record.totalHours > 0 ? (
                  <span className="font-medium">{record.totalHours}</span>
                ) : '-'}
              </TableCell>
              <TableCell>{record.locationName || 'เช็คอินนอกสถานที่'}</TableCell>
              <TableCell>
                <AttendanceStatusBadge 
                  status={record.status} 
                  isLate={record.isLate}
                  lateMinutes={record.lateMinutes}
                />
              </TableCell>
              <TableCell className="text-sm text-gray-600">
                {record.note || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// Summary Report Table Component
function SummaryReportTable({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">ไม่มีข้อมูลสรุป</p>
      </div>
    )
  }
  
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ชื่อพนักงาน</TableHead>
            <TableHead className="text-center">วันทำงาน</TableHead>
            <TableHead className="text-center">วันขาด</TableHead>
            <TableHead className="text-center">วันสาย</TableHead>
            <TableHead className="text-center">รวมชั่วโมง</TableHead>
            <TableHead className="text-center">เฉลี่ย/วัน</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((summary, index) => (
            <TableRow key={summary.userId || index}>
              <TableCell className="font-medium">
                {summary.userName}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success">{summary.presentDays}</Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={summary.absentDays > 0 ? 'error' : 'secondary'}>
                  {summary.absentDays}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={summary.lateDays > 0 ? 'warning' : 'secondary'}>
                  {summary.lateDays}
                </Badge>
              </TableCell>
              <TableCell className="text-center font-medium">
                {summary.totalHours.toFixed(2)}
              </TableCell>
              <TableCell className="text-center">
                {(summary.averageHoursPerDay || 0).toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// Status Badge Component
function AttendanceStatusBadge({ 
  status, 
  isLate, 
  lateMinutes 
}: { 
  status: string
  isLate: boolean
  lateMinutes: number
}) {
  if (status === 'absent') {
    return <Badge variant="error">ขาด</Badge>
  }
  
  if (status === 'holiday') {
    return <Badge variant="secondary">วันหยุด</Badge>
  }
  
  if (status === 'late' || isLate) {
    return (
      <Badge variant="warning">
        สาย {lateMinutes > 0 ? `${lateMinutes} นาที` : ''}
      </Badge>
    )
  }
  
  return <Badge variant="success">ปกติ</Badge>
}