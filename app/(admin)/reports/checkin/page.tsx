'use client'

import { useState } from 'react'
import { FileSpreadsheet, AlertCircle } from 'lucide-react'
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
  getAttendanceSummary
} from '@/lib/services/reportService'
import { exportDetailedReport, exportByEmployeeReport, exportPayrollReport } from '@/lib/services/excelExportService'
import TechLoader from '@/components/shared/TechLoader'
import ReportFilters from '@/components/reports/ReportFilters'
import ReportResults from '@/components/reports/ReportResults'
import { useLocations } from '@/hooks/useLocations'

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
  
  // Store the current filters for pagination
  const [currentFilters, setCurrentFilters] = useState<AttendanceReportFilters | null>(null)
  
  // Handle report generation with pagination
  const handleGenerateReport = (
    data: AttendanceReportData[], 
    summary: any[], 
    filters: AttendanceReportFilters,
    paginationInfo?: AttendanceReportResponse['pagination']
  ) => {
    setReportData(data)
    setSummaryData(summary)
    setFilters(filters)
    setCurrentFilters(filters) // Store filters for pagination
    setPagination(paginationInfo)
    setLoading(false)
  }
  
  // Handle page change
  const handlePageChange = async (page: number) => {
    if (!currentFilters) return
    
    try {
      setLoading(true)
      const response = await getAttendanceReportPaginated({
        ...currentFilters,
        page
      })
      
      setReportData(response.data)
      setSummaryData(response.summary || [])
      setPagination(response.pagination)
    } catch (error: any) {
      console.error('Error changing page:', error)
      showToast(error.message || 'เกิดข้อผิดพลาดในการเปลี่ยนหน้า', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  // Export to Excel - fetch all data
  const handleExport = async (exportType: 'daily' | 'byEmployee' | 'payroll' = 'daily') => {
    if (!filters) {
      showToast('กรุณาสร้างรายงานก่อน Export', 'error')
      return
    }

    // Prevent multiple exports
    if (exporting) {
      return
    }

    try {
      setExporting(true)

      // Get checkbox state from DOM
      const showOnlyWithData = (document.querySelector('input[type="checkbox"]') as HTMLInputElement)?.checked ?? true

      // Fetch all data without pagination
      const response = await getAttendanceReportForExport({
        startDate: filters.startDate,
        endDate: filters.endDate,
        userIds: filters.userIds,
        locationId: filters.locationId,
        showOnlyPresent: showOnlyWithData
      })
      
      // Filter data if needed
      const dataToExport = showOnlyWithData 
        ? response.data.filter(record => record.status !== 'absent' && record.status !== 'holiday')
        : response.data
      
      const locationName = locations.find(l => l.id === filters.locationId)?.name
      
      if (exportType === 'payroll') {
        // Export payroll report
        exportPayrollReport(
          dataToExport,
          response.summary || [],
          {
            startDate: filters.startDate,
            endDate: filters.endDate,
            locationName
          }
        )
      } else if (exportType === 'byEmployee') {
        // Export grouped by employee
        exportByEmployeeReport(
          dataToExport,
          response.summary || [],
          {
            startDate: filters.startDate,
            endDate: filters.endDate,
            locationName
          }
        )
      } else {
        // Export daily report
        exportDetailedReport(
          dataToExport,
          response.summary || [],
          {
            startDate: filters.startDate,
            endDate: filters.endDate,
            locationName
          }
        )
      }
      
      showToast('Export สำเร็จ', 'success')
    } catch (error: any) {
      console.error('Export error:', error)
      showToast(error.message || 'เกิดข้อผิดพลาดในการ Export', 'error')
    } finally {
      setExporting(false)
    }
  }
  
  // Check permissions
  if (userData?.role !== 'admin' && userData?.role !== 'hr') {
    return (
      <div className="p-8">
        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  
  if (!userData) {
    return <TechLoader />
  }
  
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">รายงานการเข้างาน</h1>
          <p className="mt-2 text-gray-600">ตรวจสอบและ Export รายงานเวลาเข้า-ออกของพนักงาน</p>
        </div>
        
        {reportData.length > 0 && (
          <div className="flex gap-2">
            <Button
              onClick={() => handleExport('payroll')}
              disabled={exporting}
              className="bg-gradient-to-r from-purple-500 to-pink-600"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {exporting ? 'กำลัง Export...' : 'Export เงินเดือน'}
            </Button>
            <Button
              onClick={() => handleExport('daily')}
              disabled={exporting}
              className="bg-gradient-to-r from-green-500 to-emerald-600"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {exporting ? 'กำลัง Export...' : 'Export รายวัน'}
            </Button>
            <Button
              onClick={() => handleExport('byEmployee')}
              disabled={exporting}
              className="bg-gradient-to-r from-blue-500 to-indigo-600"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {exporting ? 'กำลัง Export...' : 'Export แยกพนักงาน'}
            </Button>
          </div>
        )}
      </div>
      
      {/* Filters */}
      <ReportFilters
        onGenerateReport={handleGenerateReport}
        onLoadingChange={setLoading}
      />
      
      {/* Results with Pagination */}
      <ReportResults
        reportData={reportData}
        summaryData={summaryData}
        loading={loading}
        filters={filters}
        pagination={pagination}
        onPageChange={handlePageChange}
      />
    </div>
  )
}