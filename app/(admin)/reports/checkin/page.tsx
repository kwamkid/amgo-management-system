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
  getAttendanceReportForExport,
} from '@/lib/services/reportService'
import { exportDetailedReport, exportByEmployeeReport, exportPayrollReport } from '@/lib/services/excelExportService'
import TechLoader from '@/components/shared/TechLoader'
import ReportFilters from '@/components/reports/ReportFilters'
import ReportResults from '@/components/reports/ReportResults'
import { useLocations } from '@/hooks/useLocations'
import { PageHeader } from '@/components/shared'
import { ActionMenu } from '@/components/aoo'

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
  // แถวเต็มช่วงหลังกรองคน/สาขา (รวมวันขาด) — แท็บตารางวันใช้ ไม่ต้อง query เอง
  const [fullData, setFullData] = useState<AttendanceReportData[]>([])
  const [summaryData, setSummaryData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState<AttendanceReportFilters | null>(null)
  const [pagination, setPagination] = useState<AttendanceReportResponse['pagination'] | undefined>()
  const [pageSize, setPageSize] = useState(50)

  // Handle report generation with pagination
  const handleGenerateReport = (
    data: AttendanceReportData[],
    summary: any[],
    newFilters: AttendanceReportFilters,
    paginationInfo?: AttendanceReportResponse['pagination'],
    full?: AttendanceReportData[]
  ) => {
    setReportData(data)
    setFullData(full ?? data)
    setSummaryData(summary)
    setFilters(newFilters)
    setPagination(paginationInfo)
    setLoading(false)
  }

  // เปลี่ยนหน้า/ขนาดหน้า = ตัดหน้าจาก cache ในเบราว์เซอร์ — ไม่ query ใหม่
  // (__generateReport ของ ReportFilters จะ query เฉพาะตอนช่วงวันที่เปลี่ยน/บังคับ)
  const handlePageChange = async (page: number) => {
    ;(window as any).__generateReport?.(page)
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    ;(window as any).__generateReport?.(1, newSize)
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
    <div className="space-y-5">
      <PageHeader
        title="รายงานการเข้างาน"
        description="ตรวจสอบและ Export รายงานเวลาเข้า-ออกของพนักงาน"
        icon={FileSpreadsheet}
        backHref="/reports"
        actions={
          // ปุ่ม export ทั้งหมดยุบเป็นเมนูเดียว — เดิมเรียง 5 ปุ่มเต็มแถว
          reportData.length > 0 ? (
            <ActionMenu
              minWidth={220}
              triggerIcon="Download"
              items={[
                { label: 'เงินเดือน (Excel)', icon: 'FileSpreadsheet', onSelect: () => handleExport('payroll') },
                { label: 'รายวัน (Excel)', icon: 'FileSpreadsheet', onSelect: () => handleExport('daily') },
                { label: 'รายคน (Excel)', icon: 'FileSpreadsheet', onSelect: () => handleExport('byEmployee') },
                { kind: 'divider' },
                { label: 'รายวัน (CSV)', icon: 'Download', onSelect: () => handleExportCSV('daily') },
                { label: 'รายคน (CSV)', icon: 'Download', onSelect: () => handleExportCSV('byEmployee') },
              ]}
            />
          ) : undefined
        }
      />

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
        fullData={fullData}
        summaryData={summaryData}
        loading={loading}
        filters={filters}
        pagination={pagination}
        onPageChange={handlePageChange}
        pageSize={pageSize}
        onPageSizeChange={handlePageSizeChange}
        // HR เติมวัน/แก้ตารางเวรแล้ว ข้อมูลใน DB เปลี่ยน — บังคับดึงก้อนใหม่ (force)
        onDataChanged={() =>
          (window as any).__generateReport?.(pagination?.currentPage ?? 1, undefined, true)
        }
      />
    </div>
  )
}