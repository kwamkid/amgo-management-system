// lib/services/reportService.ts
//
// รายงานการมาทำงาน
// ของเดิมที่ใช้ Firestore ลบทิ้งแล้ว — ย้อนดูได้ใน git history
//
// ── ต่างจากของเดิมตรงไหน (สำคัญ) ───────────────────────────────────────
// 1. 🔴 ของเดิมถือว่า "เสาร์-อาทิตย์ = วันหยุด" ของทุกคน
//    ซึ่งผิดกับธุรกิจนี้ — ร้าน/ห้างเปิด 7 วัน คลังทำ จ-ส
//    คนที่ทำงานเสาร์จึงถูกนับเป็น "วันหยุด" ทั้งที่มาทำงานจริง
//    และคนที่หยุดวันอังคารกลับถูกนับเป็น "ขาดงาน"
//
//    ตอนนี้ใช้ attendance_summary() ที่รู้ตารางเวรจริงของแต่ละคน
//    (location_work_schedules · user_work_schedules · schedule_exceptions
//     · job_function_work_days) และรู้ช่วงเวลาที่ยังเป็นพนักงานอยู่ด้วย
//
// 2. ของเดิมยิง 1 query ต่อ 1 วัน — รายงานทั้งเดือน = 31 query
//    แล้วดึงพนักงานทั้งบริษัทมากรองในเบราว์เซอร์อีกที
//    ตอนนี้ query เดียวจบ ฐานข้อมูลประกอบตารางให้เลย
//
// 3. วันลาแยกออกจาก "ขาดงาน" แล้ว — ของเดิมมองเป็นขาดงานเหมือนกันหมด

import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

export interface AttendanceReportData {
  date: string
  userId: string
  userName: string
  firstCheckIn: string
  lastCheckOut: string
  totalHours: number
  status: 'normal' | 'late' | 'absent' | 'holiday'
  locationName?: string
  isLate: boolean
  lateMinutes: number
  note?: string
  holidayName?: string
  isWorkingHoliday?: boolean
}

export interface AttendanceReportFilters {
  startDate: Date
  endDate: Date
  userIds?: string[]
  locationId?: string
  page?: number
  pageSize?: number
  showOnlyPresent?: boolean
}

export interface AttendanceReportResponse {
  data: AttendanceReportData[]
  summary: ReturnType<typeof getAttendanceSummary>
  pagination: {
    currentPage: number
    totalPages: number
    totalRecords: number
    pageSize: number
    hasNext: boolean
    hasPrev: boolean
  }
}

const sb = () => createClient()
const ymd = (d: Date) => format(d, 'yyyy-MM-dd')

/**
 * แถวที่ attendance_report() คืนมา — ฐานข้อมูลกรอง เรียง นับ และตัดหน้าให้แล้ว
 *
 * ของเดิมเรียก attendance_summary() แล้วลากมาทั้งเดือนเพื่อโชว์ 50 แถว
 * (46 คน × 31 วัน = 1,357 แถว) แถม PostgREST ตัดที่ 1,000 แถวโดยไม่มี error
 * → 357 แถวหายเงียบ ๆ คนท้าย ๆ ลำดับหายจากรายงานทั้งเดือน
 */
type ReportRow = {
  work_date: string
  user_id: string
  full_name: string
  status: 'worked' | 'absent' | 'leave' | 'day_off' | 'not_tracked'
  checkin_type: string | null
  leave_type: string | null
  total_hours: number | null
  is_late: boolean | null
  late_minutes: number | null
  first_in: string | null
  last_out: string | null
  location_name: string | null
  holiday_name: string | null
  is_working_holiday: boolean | null
  total_count: number
}

const LEAVE_LABEL: Record<string, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
  vacation: 'ลาพักร้อน',
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '-')

function toReportData(r: ReportRow): AttendanceReportData {
  return {
    date: r.work_date,
    userId: r.user_id,
    userName: r.full_name,
    firstCheckIn: hhmm(r.first_in),
    lastCheckOut: hhmm(r.last_out),
    totalHours: Math.round(Number(r.total_hours ?? 0) * 100) / 100,
    status: mapStatus(r),
    locationName: r.location_name ?? undefined,
    isLate: r.is_late ?? false,
    lateMinutes: r.late_minutes ?? 0,
    note: buildNote(r),
    holidayName: r.holiday_name ?? undefined,
    isWorkingHoliday: r.is_working_holiday ?? undefined,
  }
}

function mapStatus(r: ReportRow): AttendanceReportData['status'] {
  if (r.status === 'worked') return r.is_late ? 'late' : 'normal'
  // ลา · วันหยุดตามตาราง · ไม่ต้องเช็คอิน — ไม่ใช่การขาดงาน
  if (r.status === 'leave' || r.status === 'day_off' || r.status === 'not_tracked') return 'holiday'
  return r.holiday_name ? 'holiday' : 'absent'
}

function buildNote(r: ReportRow): string {
  const parts: string[] = []
  if (r.holiday_name) parts.push(r.holiday_name)
  if (r.status === 'leave') parts.push(LEAVE_LABEL[r.leave_type ?? ''] ?? 'ลา')
  else if (r.status === 'day_off') parts.push('วันหยุดตามตาราง')
  else if (r.status === 'not_tracked') parts.push('ไม่ต้องเช็คอิน')
  if (r.checkin_type === 'wfh') parts.push('ทำงานที่บ้าน')
  else if (r.checkin_type === 'offsite') parts.push('เช็คอินนอกสถานที่')
  return parts.join(' · ')
}

async function fetchReport(
  filters: AttendanceReportFilters,
  limit: number,
  offset: number
): Promise<{ rows: AttendanceReportData[]; total: number }> {
  const { data, error } = await sb().rpc('attendance_report', {
    p_from: ymd(filters.startDate),
    p_to: ymd(filters.endDate),
    p_user_ids: filters.userIds?.length ? filters.userIds : undefined,
    p_location_id: filters.locationId ?? undefined,
    p_only_present: filters.showOnlyPresent !== false,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) throw new Error(`ดึงรายงานไม่สำเร็จ: ${error.message}`)

  const rows = (data ?? []) as ReportRow[]
  return {
    rows: rows.map(toReportData),
    total: rows.length ? Number(rows[0].total_count) : 0,
  }
}

/* ------------------------------------------------------------------ */
export async function getAttendanceReport(
  filters: AttendanceReportFilters
): Promise<AttendanceReportData[]> {
  return (await getAttendanceReportPaginated(filters)).data
}

export async function getAttendanceReportPaginated(
  filters: AttendanceReportFilters
): Promise<AttendanceReportResponse> {
  const page = filters.page || 1
  const pageSize = filters.pageSize || 50

  const { rows, total } = await fetchReport(filters, pageSize, (page - 1) * pageSize)
  const totalPages = Math.ceil(total / pageSize)

  // สรุปด้านบนต้องคิดจากทั้งช่วง ไม่ใช่แค่หน้าที่กำลังดู
  const { rows: all } = await fetchReport(filters, 100_000, 0)

  return {
    data: rows,
    summary: getAttendanceSummary(all),
    pagination: {
      currentPage: page,
      totalPages,
      totalRecords: total,
      pageSize,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }
}

export async function getAttendanceReportForExport(
  filters: Omit<AttendanceReportFilters, 'page' | 'pageSize'>
): Promise<AttendanceReportResponse> {
  const { rows: filtered } = await fetchReport(filters, 100_000, 0)

  return {
    data: filtered,
    summary: getAttendanceSummary(filtered),
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalRecords: filtered.length,
      pageSize: filtered.length,
      hasNext: false,
      hasPrev: false,
    },
  }
}

/* ------------------------------------------------------------------ */
export function getAttendanceSummary(data: AttendanceReportData[]) {
  const byUser = new Map<
    string,
    {
      userId: string
      userName: string
      totalDays: number
      presentDays: number
      absentDays: number
      lateDays: number
      holidayDays: number
      workingHolidayDays: number
      totalHours: number
      averageHoursPerDay: number
    }
  >()

  for (const r of data) {
    let s = byUser.get(r.userId)
    if (!s) {
      s = {
        userId: r.userId,
        userName: r.userName,
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        holidayDays: 0,
        workingHolidayDays: 0,
        totalHours: 0,
        averageHoursPerDay: 0,
      }
      byUser.set(r.userId, s)
    }

    s.totalDays++

    if (r.status === 'absent') {
      s.absentDays++
    } else if (r.status === 'holiday') {
      s.holidayDays++
      if (r.totalHours > 0) {
        // มาทำงานในวันหยุด — นับเป็นวันทำงานด้วย
        s.workingHolidayDays++
        s.presentDays++
        s.totalHours += r.totalHours
      }
    } else {
      s.presentDays++
      s.totalHours += r.totalHours
      if (r.status === 'late') s.lateDays++
    }
  }

  const results = [...byUser.values()]
  for (const s of results) {
    s.averageHoursPerDay =
      s.presentDays > 0 ? Math.round((s.totalHours / s.presentDays) * 100) / 100 : 0
  }
  return results
}
