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
  getAttendanceSummary
} from '@/lib/services/reportService'
import { exportDetailedReport } from '@/lib/services/excelExportService'
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
  const [filters, setFilters] = useState<AttendanceReportFilters | null>(null)
  
  // Handle report generation
  const handleGenerateReport = (data: AttendanceReportData[], summary: any[], filters: AttendanceReportFilters) => {
    setReportData(data)
    setSummaryData(summary)
    setFilters(filters)
    setLoading(false)
  }
  
  // Export to Excel
  const handleExport = () => {
    if (reportData.length === 0) {
      showToast('ไม่มีข้อมูลสำหรับ Export', 'error')
      return
    }
    
    if (!filters) return
    
    const locationName = locations.find(l => l.id === filters.locationId)?.name
    
    // Get current filtered data from DOM or recalculate
    const showOnlyWithData = (document.querySelector('input[type="checkbox"]') as HTMLInputElement)?.checked ?? true
    const dataToExport = showOnlyWithData 
      ? reportData.filter(record => record.status !== 'absent' && record.status !== 'holiday')
      : reportData
    const summaryToExport = getAttendanceSummary(dataToExport)
    
    exportDetailedReport(
      dataToExport,
      summaryToExport,
      {
        startDate: filters.startDate,
        endDate: filters.endDate,
        locationName
      }
    )
    
    showToast('Export สำเร็จ', 'success')
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
          <Button
            onClick={handleExport}
            className="bg-gradient-to-r from-green-500 to-emerald-600"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        )}
      </div>
      
      {/* Filters */}
      <ReportFilters
        onGenerateReport={handleGenerateReport}
        onLoadingChange={setLoading}
      />
      
      {/* Results */}
      <ReportResults
        reportData={reportData}
        summaryData={summaryData}
        loading={loading}
        filters={filters}
      />
    </div>
  )
}