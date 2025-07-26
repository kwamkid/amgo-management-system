// lib/services/excelExportService.ts

import * as XLSX from 'xlsx'
import { AttendanceReportData } from './reportService'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

/**
 * Export attendance report to Excel
 */
export function exportAttendanceToExcel(
  data: AttendanceReportData[],
  filename?: string
) {
  // Create workbook
  const wb = XLSX.utils.book_new()
  
  // Prepare data for Excel
  const excelData = data.map(record => ({
    'วันที่': format(new Date(record.date), 'dd/MM/yyyy', { locale: th }),
    'ชื่อพนักงาน': record.userName,
    'เวลาเข้า': record.firstCheckIn,
    'เวลาออก': record.lastCheckOut,
    'รวม (ชม.)': record.totalHours,
    'สถานที่': record.locationName || 'นอกสถานที่',
    'สถานะ': getStatusLabel(record.status, record.isLate),
    'สาย (นาที)': record.lateMinutes || 0,
    'หมายเหตุ': record.note || ''
  }))
  
  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(excelData)
  
  // Set column widths
  const colWidths = [
    { wch: 12 }, // วันที่
    { wch: 25 }, // ชื่อพนักงาน
    { wch: 10 }, // เวลาเข้า
    { wch: 10 }, // เวลาออก
    { wch: 10 }, // รวม (ชม.)
    { wch: 20 }, // สถานที่
    { wch: 12 }, // สถานะ
    { wch: 12 }, // สาย (นาที)
    { wch: 30 }, // หมายเหตุ
  ]
  ws['!cols'] = colWidths
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'รายงานการเข้างาน')
  
  // Generate filename
  const exportFilename = filename || `attendance_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`
  
  // Write file
  XLSX.writeFile(wb, exportFilename)
}

/**
 * Export monthly summary to Excel
 */
export function exportMonthlySummaryToExcel(
  data: any[],
  year: number,
  month: number,
  filename?: string
) {
  // Create workbook
  const wb = XLSX.utils.book_new()
  
  // Prepare summary data
  const summaryData = data.map(record => ({
    'ชื่อพนักงาน': record.userName,
    'วันทำงาน': record.presentDays,
    'วันขาด': record.absentDays,
    'วันสาย': record.lateDays,
    'รวมชั่วโมง': record.totalHours,
    'เฉลี่ย/วัน': record.averageHoursPerDay
  }))
  
  // Create summary worksheet
  const ws = XLSX.utils.json_to_sheet(summaryData)
  
  // Set column widths
  const colWidths = [
    { wch: 25 }, // ชื่อพนักงาน
    { wch: 12 }, // วันทำงาน
    { wch: 10 }, // วันขาด
    { wch: 10 }, // วันสาย
    { wch: 12 }, // รวมชั่วโมง
    { wch: 12 }, // เฉลี่ย/วัน
  ]
  ws['!cols'] = colWidths
  
  // Add title row
  const monthName = format(new Date(year, month - 1), 'MMMM yyyy', { locale: th })
  XLSX.utils.sheet_add_aoa(ws, [[`สรุปการเข้างานประจำเดือน ${monthName}`]], { origin: 'A1' })
  
  // Merge cells for title
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }]
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'สรุปรายเดือน')
  
  // Generate filename
  const exportFilename = filename || `monthly_summary_${year}_${String(month).padStart(2, '0')}.xlsx`
  
  // Write file
  XLSX.writeFile(wb, exportFilename)
}

/**
 * Export detailed report with multiple sheets
 */
export function exportDetailedReport(
  attendanceData: AttendanceReportData[],
  summaryData: any[],
  filters: {
    startDate: Date
    endDate: Date
    locationName?: string
  },
  filename?: string
) {
  // Create workbook
  const wb = XLSX.utils.book_new()
  
  // Sheet 1: Daily attendance
  const dailyData = attendanceData.map(record => ({
    'วันที่': format(new Date(record.date), 'dd/MM/yyyy', { locale: th }),
    'ชื่อพนักงาน': record.userName,
    'เวลาเข้า': record.firstCheckIn,
    'เวลาออก': record.lastCheckOut,
    'รวม (ชม.)': record.totalHours,
    'สถานที่': record.locationName || 'นอกสถานที่',
    'สถานะ': getStatusLabel(record.status, record.isLate),
    'สาย (นาที)': record.lateMinutes || 0,
    'หมายเหตุ': record.note || ''
  }))
  
  const wsDaily = XLSX.utils.json_to_sheet(dailyData)
  wsDaily['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 30 }
  ]
  
  // Add header info
  const dateRange = `${format(filters.startDate, 'dd/MM/yyyy')} - ${format(filters.endDate, 'dd/MM/yyyy')}`
  const headerInfo = [
    [`รายงานการเข้างาน`],
    [`ช่วงวันที่: ${dateRange}`],
    filters.locationName ? [`สถานที่: ${filters.locationName}`] : [],
    [`วันที่พิมพ์: ${format(new Date(), 'dd/MM/yyyy HH:mm น.')}`],
    [] // Empty row
  ].filter(row => row.length > 0)
  
  // Create new data with header
  const dataWithHeader = [
    ...headerInfo,
    [], // Empty row before data
    Object.keys(dailyData[0] || {}), // Column headers
    ...dailyData.map(row => Object.values(row))
  ]
  
  const newWsDaily = XLSX.utils.aoa_to_sheet(dataWithHeader)
  newWsDaily['!cols'] = wsDaily['!cols']
  
  XLSX.utils.book_append_sheet(wb, newWsDaily, 'รายละเอียด')
  
  // Sheet 2: Summary by employee
  if (summaryData && summaryData.length > 0) {
    const wsSummary = XLSX.utils.json_to_sheet(summaryData.map(record => ({
      'ชื่อพนักงาน': record.userName,
      'วันทำงาน': record.presentDays,
      'วันขาด': record.absentDays,
      'วันสาย': record.lateDays,
      'รวมชั่วโมง': record.totalHours,
      'เฉลี่ย/วัน': record.averageHoursPerDay || 0
    })))
    
    wsSummary['!cols'] = [
      { wch: 25 }, { wch: 12 }, { wch: 10 },
      { wch: 10 }, { wch: 12 }, { wch: 12 }
    ]
    
    XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปรายคน')
  }
  
  // Generate filename
  const exportFilename = filename || `attendance_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`
  
  // Write file
  XLSX.writeFile(wb, exportFilename)
}

// Helper function
function getStatusLabel(status: string, isLate: boolean): string {
  switch (status) {
    case 'absent':
      return 'ขาด'
    case 'holiday':
      return 'วันหยุด'
    case 'late':
      return 'สาย'
    case 'normal':
      return isLate ? 'สาย' : 'ปกติ'
    default:
      return status
  }
}