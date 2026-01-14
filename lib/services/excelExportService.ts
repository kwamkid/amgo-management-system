// lib/services/excelExportService.ts - Updated with Holiday Support

import * as XLSX from 'xlsx'
import { AttendanceReportData } from './reportService'
import { format, eachDayOfInterval } from 'date-fns'
import { th } from 'date-fns/locale'

/**
 * Export detailed attendance report (daily view) with holiday support
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
    record.locationName || 'เช็คอินนอกสถานที่',
    getStatusText(record),
    getRecordNote(record)
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
    { wch: 40 }  // หมายเหตุ (เพิ่มขนาดสำหรับชื่อวันหยุด)
  ]
  
  // Apply styles for holidays
  applyHolidayStyles(dailyWs, data)
  
  XLSX.utils.book_append_sheet(wb, dailyWs, 'รายงานรายวัน')
  
  // Sheet 2: Summary Report
  if (summary && summary.length > 0) {
    const summaryHeaders = [
      'ชื่อพนักงาน',
      'วันทำงาน',
      'วันขาด',
      'วันสาย',
      'วันหยุด',
      'ทำงานวันหยุด',
      'รวมชั่วโมง',
      'เฉลี่ย/วัน'
    ]
    
    const summaryRows = summary.map(stat => [
      stat.userName,
      stat.presentDays,
      stat.absentDays,
      stat.lateDays,
      stat.holidayDays || 0,
      stat.workingHolidayDays || 0,
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
      { wch: 10 }, // วันหยุด
      { wch: 15 }, // ทำงานวันหยุด
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
 * Export attendance report grouped by employee with holiday support
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
    let employeeHolidayDays = 0
    let employeeWorkingHolidayDays = 0
    
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
        
        if (record.status === 'holiday') {
          employeeHolidayDays++
          if (record.isWorkingHoliday && totalHours > 0) {
            employeeWorkingHolidayDays++
            employeeWorkDays++
            employeeTotalHours += totalHours
          }
        } else if (record.status !== 'absent') {
          employeeWorkDays++
          employeeTotalHours += totalHours
        }
        
        if (record.status === 'absent') {
          employeeAbsentDays++
        }
        if (record.isLate) {
          employeeLateDays++
        }
        
        let statusText = getStatusText(record)
        
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
          getRecordNote(record)
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
          isWeekend ? 'วันหยุดสุดสัปดาห์' : ''
        ])
      }
    })
    
    // Add summary row for employee
    rows.push([
      `สรุป ${userName}`,
      `มาทำงาน ${employeeWorkDays} วัน`,
      `ขาด ${employeeAbsentDays} วัน`,
      `สาย ${employeeLateDays} วัน`,
      `วันหยุด ${employeeHolidayDays} วัน`,
      `ทำงานวันหยุด ${employeeWorkingHolidayDays} วัน`,
      `รวม ${employeeTotalHours.toFixed(2)} ชม.`,
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
    { wch: 40 }  // หมายเหตุ (เพิ่มขนาดสำหรับชื่อวันหยุด)
  ]
  
  // Apply styles for employee summary rows
  applyEmployeeSummaryStyles(ws, rows)
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'รายงานแยกพนักงาน')
  
  // Generate filename
  const dateRange = `${format(options.startDate, 'ddMMyy')}-${format(options.endDate, 'ddMMyy')}`
  const locationPart = options.locationName ? `_${options.locationName}` : ''
  const filename = `รายงานเวลาทำงาน_แยกพนักงาน${locationPart}_${dateRange}.xlsx`
  
  // Save file
  XLSX.writeFile(wb, filename)
}

/**
 * Helper function to get status text
 */
function getStatusText(record: AttendanceReportData): string {
  if (record.status === 'absent') return 'ขาด'
  if (record.status === 'holiday') {
    if (record.isWorkingHoliday && record.totalHours > 0) {
      return 'ทำงานวันหยุด'
    }
    return 'วันหยุด'
  }
  if (record.isLate) return `สาย ${record.lateMinutes} นาที`
  return 'ปกติ'
}

/**
 * Helper function to get record note with holiday name
 */
function getRecordNote(record: AttendanceReportData): string {
  const notes: string[] = []
  
  // Add holiday name
  if (record.holidayName) {
    notes.push(`🎉 ${record.holidayName}`)
  }
  
  // Add working holiday note
  if (record.isWorkingHoliday && record.totalHours > 0) {
    notes.push('(ทำงานวันหยุด)')
  }
  
  // Add other notes
  if (record.note) {
    notes.push(record.note)
  }
  
  return notes.join(' ')
}

/**
 * Apply styles for holiday rows
 */
function applyHolidayStyles(ws: XLSX.WorkSheet, data: AttendanceReportData[]) {
  // Add cell styles for holiday rows
  data.forEach((record, index) => {
    if (record.status === 'holiday') {
      const rowIndex = index + 2 // +2 because of header row and 0-based index
      
      // Style cells in holiday rows
      for (let col = 0; col < 8; col++) {
        const cellAddr = XLSX.utils.encode_cell({ r: rowIndex, c: col })
        if (!ws[cellAddr]) continue
        
        ws[cellAddr].s = {
          fill: {
            patternType: 'solid',
            fgColor: { rgb: record.isWorkingHoliday ? 'FFE4E1' : 'F0F0F0' }
          },
          font: {
            color: { rgb: record.isWorkingHoliday ? 'B91C1C' : '666666' }
          }
        }
      }
    }
  })
}

/**
 * Apply styles for employee summary rows
 */
function applyEmployeeSummaryStyles(ws: XLSX.WorkSheet, rows: any[]) {
  rows.forEach((row, index) => {
    if (row[0] && row[0].startsWith('สรุป')) {
      const rowIndex = index + 2 // +2 because of header row and 0-based index
      
      // Style summary row
      for (let col = 0; col < 10; col++) {
        const cellAddr = XLSX.utils.encode_cell({ r: rowIndex, c: col })
        if (!ws[cellAddr]) continue
        
        ws[cellAddr].s = {
          fill: {
            patternType: 'solid',
            fgColor: { rgb: 'E5E7EB' }
          },
          font: {
            bold: true,
            color: { rgb: '1F2937' }
          }
        }
      }
    }
  })
}