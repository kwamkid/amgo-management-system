// lib/services/excelExportService.ts

import * as XLSX from 'xlsx'
import { AttendanceReportData } from './reportService'
import { format, eachDayOfInterval } from 'date-fns'
import { th } from 'date-fns/locale'

/**
 * Export detailed attendance report (daily view)
 */
export function exportDetailedReport(
  data: AttendanceReportData[],
  summary: any[],
  options: {
    startDate: Date
    endDate: Date
    locationName?: string
  }
) {
  // Create workbook
  const wb = XLSX.utils.book_new()
  
  // Sheet 1: Daily Report
  const dailyHeaders = [
    'วันที่',
    'ชื่อพนักงาน',
    'เวลาเข้า',
    'เวลาออก',
    'รวม (ชม.)',
    'สถานที่',
    'สถานะ',
    'หมายเหตุ'
  ]
  
  const dailyRows = data.map(record => [
    format(new Date(record.date), 'dd/MM/yyyy'),
    record.userName,
    record.firstCheckIn,
    record.lastCheckOut,
    record.totalHours > 0 ? record.totalHours : '-',
    record.locationName || 'นอกสถานที่',
    getStatusText(record),
    record.note || ''
  ])
  
  const dailyWs = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyRows])
  
  // Set column widths
  dailyWs['!cols'] = [
    { wch: 12 }, // วันที่
    { wch: 25 }, // ชื่อพนักงาน
    { wch: 10 }, // เวลาเข้า
    { wch: 10 }, // เวลาออก
    { wch: 10 }, // รวม
    { wch: 20 }, // สถานที่
    { wch: 15 }, // สถานะ
    { wch: 30 }  // หมายเหตุ
  ]
  
  XLSX.utils.book_append_sheet(wb, dailyWs, 'รายงานรายวัน')
  
  // Sheet 2: Summary Report
  if (summary && summary.length > 0) {
    const summaryHeaders = [
      'ชื่อพนักงาน',
      'วันทำงาน',
      'วันขาด',
      'วันสาย',
      'รวมชั่วโมง',
      'เฉลี่ย/วัน'
    ]
    
    const summaryRows = summary.map(stat => [
      stat.userName,
      stat.presentDays,
      stat.absentDays,
      stat.lateDays,
      stat.totalHours.toFixed(2),
      stat.averageHoursPerDay.toFixed(2)
    ])
    
    const summaryWs = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows])
    
    // Set column widths
    summaryWs['!cols'] = [
      { wch: 25 }, // ชื่อพนักงาน
      { wch: 12 }, // วันทำงาน
      { wch: 10 }, // วันขาด
      { wch: 10 }, // วันสาย
      { wch: 12 }, // รวมชั่วโมง
      { wch: 12 }  // เฉลี่ย/วัน
    ]
    
    XLSX.utils.book_append_sheet(wb, summaryWs, 'สรุป')
  }
  
  // Generate filename
  const dateRange = `${format(options.startDate, 'ddMMyy')}-${format(options.endDate, 'ddMMyy')}`
  const locationPart = options.locationName ? `_${options.locationName}` : ''
  const filename = `รายงานเวลาทำงาน${locationPart}_${dateRange}.xlsx`
  
  // Save file
  XLSX.writeFile(wb, filename)
}

/**
 * Export attendance report grouped by employee
 * แสดงข้อมูลแยกตามพนักงาน พร้อมวันที่ครบทุกวัน (วันไหนไม่มาให้เว้นว่าง)
 */
export function exportByEmployeeReport(
  data: AttendanceReportData[],
  summary: any[],
  options: {
    startDate: Date
    endDate: Date
    locationName?: string
  }
) {
  // Create workbook
  const wb = XLSX.utils.book_new()
  
  // Get all dates in range
  const allDates = eachDayOfInterval({
    start: options.startDate,
    end: options.endDate
  })
  
  // Group data by employee
  const groupedData = data.reduce((acc, record) => {
    if (!acc[record.userId]) {
      acc[record.userId] = {
        userName: record.userName,
        records: {}
      }
    }
    // Use date as key for easy lookup
    acc[record.userId].records[record.date] = record
    return acc
  }, {} as Record<string, { userName: string, records: Record<string, AttendanceReportData> }>)
  
  // Sort employees by name
  const sortedEmployees = Object.entries(groupedData).sort(([, a], [, b]) => 
    a.userName.localeCompare(b.userName)
  )
  
  // Create header row
  const headers = [
    'พนักงาน',
    'วันที่',
    'วัน',
    'เวลาเข้า',
    'เวลาออก',
    'รวม (ชม.)',
    'OT (ชม.)',
    'สถานะ',
    'สถานที่',
    'หมายเหตุ'
  ]
  
  // Create data rows
  const rows: any[] = []
  
  sortedEmployees.forEach(([userId, employeeData]) => {
    const { userName, records } = employeeData
    let employeeTotalHours = 0
    let employeeWorkDays = 0
    let employeeAbsentDays = 0
    let employeeLateDays = 0
    
    // Add employee header row
    rows.push([userName, '', '', '', '', '', '', '', '', ''])
    
    // Add data for each date
    allDates.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayName = format(date, 'EEEE', { locale: th })
      const record = records[dateStr]
      
      if (record) {
        // มีข้อมูลการทำงาน
        const totalHours = record.totalHours || 0
        const otHours = totalHours > 8 ? totalHours - 8 : 0
        const regularHours = totalHours > 8 ? 8 : totalHours
        
        employeeTotalHours += totalHours
        
        if (record.status !== 'absent' && record.status !== 'holiday') {
          employeeWorkDays++
        }
        if (record.status === 'absent') {
          employeeAbsentDays++
        }
        if (record.isLate) {
          employeeLateDays++
        }
        
        let statusText = 'ปกติ'
        if (record.status === 'absent') statusText = 'ขาด'
        else if (record.status === 'holiday') statusText = 'วันหยุด'
        else if (record.isLate) statusText = `สาย ${record.lateMinutes} นาที`
        
        rows.push([
          '', // ชื่อพนักงาน (เว้นว่างเพราะแสดงข้างบนแล้ว)
          format(date, 'dd/MM/yyyy'),
          dayName,
          record.firstCheckIn === '-' ? '' : record.firstCheckIn,
          record.lastCheckOut === '-' ? '' : record.lastCheckOut,
          regularHours > 0 ? regularHours.toFixed(2) : '',
          otHours > 0 ? otHours.toFixed(2) : '',
          statusText,
          record.locationName || '',
          record.note || ''
        ])
      } else {
        // ไม่มีข้อมูล = ไม่มาทำงาน (แสดงวันที่แต่เว้นข้อมูลว่าง)
        const isWeekend = date.getDay() === 0 || date.getDay() === 6
        
        if (!isWeekend) {
          employeeAbsentDays++
        }
        
        rows.push([
          '', // ชื่อพนักงาน
          format(date, 'dd/MM/yyyy'),
          dayName,
          '', // เวลาเข้า
          '', // เวลาออก
          '', // รวม
          '', // OT
          isWeekend ? 'วันหยุด' : 'ขาด',
          '',
          ''
        ])
      }
    })
    
    // Add summary row for employee
    rows.push([
      `สรุป ${userName}`,
      `มาทำงาน ${employeeWorkDays} วัน`,
      `ขาด ${employeeAbsentDays} วัน`,
      `สาย ${employeeLateDays} วัน`,
      '',
      `รวม ${employeeTotalHours.toFixed(2)} ชม.`,
      '',
      '',
      '',
      ''
    ])
    
    // Add empty row between employees
    rows.push(['', '', '', '', '', '', '', '', '', ''])
  })
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  
  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, // พนักงาน
    { wch: 12 }, // วันที่
    { wch: 10 }, // วัน
    { wch: 10 }, // เวลาเข้า
    { wch: 10 }, // เวลาออก
    { wch: 10 }, // รวม
    { wch: 10 }, // OT
    { wch: 15 }, // สถานะ
    { wch: 20 }, // สถานที่
    { wch: 30 }  // หมายเหตุ
  ]
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'รายงานแยกพนักงาน')
  
  // Generate filename
  const dateRange = `${format(options.startDate, 'ddMMyy')}-${format(options.endDate, 'ddMMyy')}`
  const locationPart = options.locationName ? `_${options.locationName}` : ''
  const filename = `รายงานเวลาทำงาน_แยกพนักงาน${locationPart}_${dateRange}.xlsx`
  
  // Save file
  XLSX.writeFile(wb, filename)
}

// Helper function to get status text
function getStatusText(record: AttendanceReportData): string {
  if (record.status === 'absent') return 'ขาด'
  if (record.status === 'holiday') return 'วันหยุด'
  if (record.isLate) return `สาย ${record.lateMinutes} นาที`
  return 'ปกติ'
}