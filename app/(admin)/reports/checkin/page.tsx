'use client'

import { useState } from 'react'
import { FileSpreadsheet, Download, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import {
  AttendanceReportData,
  AttendanceReportFilters,
  AttendanceReportResponse,
  getAttendanceReportPaginated,
  getAttendanceReportForExport,
} from '@/lib/services/reportService'
import { exportDetailedReport, exportByEmployeeReport, exportPayrollReport } from '@/lib/services/excelExportService'
import TechLoader from '@/components/shared/TechLoader'
import ReportFilters from '@/components/reports/ReportFilters'
import ReportResults from '@/components/reports/ReportResults'
import { useLocations } from '@/hooks/useLocations'

function downloadCSV(rows: (string | number)[][], filename: string) {
  const csv = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function CheckInReportPage() {
  const { userData } = useAuth()
  const { locations } = useLocations()
  const { showToast } = useToast()

  // States
  const [reportData, setReportData] = useState<AttendanceReportData[]>([])
  const [summaryData, setSummaryData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState<AttendanceReportFilters | null>(null)
  const [pagination, setPagination] = useState<AttendanceReportResponse['pagination'] | undefined>()
  const [pageSize, setPageSize] = useState(50)

  // Store the current filters for pagination
  const [currentFilters, setCurrentFilters] = useState<AttendanceReportFilters | null>(null)

  // Handle report generation with pagination
  const handleGenerateReport = (
    data: AttendanceReportData[],
    summary: any[],
    newFilters: AttendanceReportFilters,
    paginationInfo?: AttendanceReportResponse['pagination']
  ) => {
    setReportData(data)
    setSummaryData(summary)
    setFilters(newFilters)
    setCurrentFilters(newFilters)
    setPagination(paginationInfo)
    setLoading(false)
  }

  // Handle page change
  const handlePageChange = async (page: number) => {
    if (!currentFilters) return
    try {
      setLoading(true)
      const response = await getAttendanceReportPaginated({ ...currentFilters, page })
      setReportData(response.data)
      setSummaryData(response.summary || [])
      setPagination(response.pagination)
    } catch (error: any) {
      showToast(error.message || 'เกิดข้อผิดพลาดในการเปลี่ยนหน้า', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Handle page size change - re-fetch with new size
  const handlePageSizeChange = async (newSize: number) => {
    setPageSize(newSize)
    if (!currentFilters) return
    try {
      setLoading(true)
      const updatedFilters = { ...currentFilters, pageSize: newSize, page: 1 }
      const response = await getAttendanceReportPaginated(updatedFilters)
      setReportData(response.data)
      setSummaryData(response.summary || [])
      setPagination(response.pagination)
      setCurrentFilters(updatedFilters)
    } catch (error: any) {
      showToast(error.message || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Export to Excel
  const handleExport = async (exportType: 'daily' | 'byEmployee' | 'payroll') => {
    if (!filters || exporting) return
    try {
      setExporting(true)
      const response = await getAttendanceReportForExport({
        startDate: filters.startDate,
        endDate: filters.endDate,
        userIds: filters.userIds,
        locationId: filters.locationId,
        showOnlyPresent: true
      })
      const dataToExport = response.data.filter(r => r.status !== 'absent' && r.status !== 'holiday')
      const locationName = locations.find(l => l.id === filters.locationId)?.name
      const opts = { startDate: filters.startDate, endDate: filters.endDate, locationName }

      if (exportType === 'payroll') exportPayrollReport(dataToExport, response.summary || [], opts)
      else if (exportType === 'byEmployee') exportByEmployeeReport(dataToExport, response.summary || [], opts)
      else exportDetailedReport(dataToExport, response.summary || [], opts)

      showToast('Export สำเร็จ', 'success')
    } catch (error: any) {
      showToast(error.message || 'เกิดข้อผิดพลาดในการ Export', 'error')
    } finally {
      setExporting(false)
    }
  }

  // Export to CSV
  const handleExportCSV = async (exportType: 'daily' | 'byEmployee') => {
    if (!filters || exporting) return
    try {
      setExporting(true)
      const response = await getAttendanceReportForExport({
        startDate: filters.startDate,
        endDate: filters.endDate,
        userIds: filters.userIds,
        locationId: filters.locationId,
        showOnlyPresent: true
      })
      const dateLabel = format(filters.startDate, 'yyyyMMdd')

      if (exportType === 'daily') {
        const rows: (string | number)[][] = [
          ['วันที่', 'ชื่อพนักงาน', 'เวลาเข้า', 'เวลาออก', 'รวมชั่วโมง', 'สถานที่', 'สถานะ', 'หมายเหตุ']
        ]
        response.data.forEach(r => {
          const statusLabel = r.status === 'absent' ? 'ขาด' : r.isLate ? `สาย ${r.lateMinutes} นาที` : 'ปกติ'
          rows.push([r.date, r.userName, r.firstCheckIn, r.lastCheckOut, r.totalHours, r.locationName || 'นอกสถานที่', statusLabel, r.note || ''])
        })
        downloadCSV(rows, `checkin-daily-${dateLabel}.csv`)
      } else {
        const rows: (string | number)[][] = [
          ['ชื่อพนักงาน', 'วันทำงาน', 'วันขาด', 'วันสาย', 'รวมชั่วโมง', 'เฉลี่ย/วัน']
        ]
        ;(response.summary || []).forEach((s: any) => {
          rows.push([s.userName, s.presentDays, s.absentDays, s.lateDays, Number(s.totalHours).toFixed(2), Number(s.averageHoursPerDay || 0).toFixed(2)])
        })
        downloadCSV(rows, `checkin-by-employee-${dateLabel}.csv`)
      }
      showToast('Export CSV สำเร็จ', 'success')
    } catch (error: any) {
      showToast(error.message || 'เกิดข้อผิดพลาดในการ Export', 'error')
    } finally {
      setExporting(false)
    }
  }

  // Check permissions
  if (!['admin', 'hr', 'manager'].includes(userData?.role || '')) {
    return (
      <div className="p-8">
        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!userData) return <TechLoader />

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">รายงานการเข้างาน</h1>
          <p className="mt-1 text-sm text-gray-500">ตรวจสอบและ Export รายงานเวลาเข้า-ออกของพนักงาน</p>
        </div>

        {reportData.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end">
            {/* Excel exports */}
            <Button onClick={() => handleExport('payroll')} disabled={exporting} size="sm" className="bg-gradient-to-r from-purple-500 to-pink-600">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              เงินเดือน (XLS)
            </Button>
            <Button onClick={() => handleExport('daily')} disabled={exporting} size="sm" className="bg-gradient-to-r from-green-500 to-emerald-600">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              รายวัน (XLS)
            </Button>
            <Button onClick={() => handleExport('byEmployee')} disabled={exporting} size="sm" className="bg-gradient-to-r from-blue-500 to-indigo-600">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              รายคน (XLS)
            </Button>
            {/* CSV exports */}
            <Button onClick={() => handleExportCSV('daily')} disabled={exporting} size="sm" variant="outline">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              รายวัน (CSV)
            </Button>
            <Button onClick={() => handleExportCSV('byEmployee')} disabled={exporting} size="sm" variant="outline">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              รายคน (CSV)
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <ReportFilters
        onGenerateReport={handleGenerateReport}
        onLoadingChange={setLoading}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />

      {/* Results with Pagination */}
      <ReportResults
        reportData={reportData}
        summaryData={summaryData}
        loading={loading}
        filters={filters}
        pagination={pagination}
        onPageChange={handlePageChange}
        pageSize={pageSize}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}