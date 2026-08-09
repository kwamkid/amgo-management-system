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
//     · business_unit_work_days) และรู้ช่วงเวลาที่ยังเป็นพนักงานอยู่ด้วย
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

/** แถวที่ attendance_summary() คืนมา */
type SummaryRow = {
  user_id: string
  full_name: string
  work_date: string
  expected_mode: string
  status: 'worked' | 'absent' | 'leave' | 'day_off' | 'not_tracked'
  checkin_type: string | null
  leave_type: string | null
  total_hours: number | null
  is_late: boolean | null
}

const LEAVE_LABEL: Record<string, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
  vacation: 'ลาพักร้อน',
}

/* ------------------------------------------------------------------ *
 *  ดึงตารางการมาทำงานจากฐานข้อมูล แล้วเติมรายละเอียดเวลาเข้า-ออก
 * ------------------------------------------------------------------ */
async function loadReport(
  filters: AttendanceReportFilters
): Promise<AttendanceReportData[]> {
  const client = sb()
  const from = ymd(filters.startDate)
  const to = ymd(filters.endDate)

  const { data: grid, error } = await client.rpc('attendance_summary', {
    p_from: from,
    p_to: to,
    p_user_id: filters.userIds?.length === 1 ? filters.userIds[0] : undefined,
  })

  if (error) throw new Error(`ดึงรายงานไม่สำเร็จ: ${error.message}`)

  let rows = (grid ?? []) as SummaryRow[]

  if (filters.userIds?.length) {
    const wanted = new Set(filters.userIds)
    rows = rows.filter((r) => wanted.has(r.user_id))
  }

  if (filters.locationId) {
    const { data: links } = await client
      .from('user_allowed_locations')
      .select('user_id')
      .eq('location_id', filters.locationId)

    const allowed = new Set((links ?? []).map((l) => l.user_id))
    rows = rows.filter((r) => allowed.has(r.user_id))
  }

  if (!rows.length) return []

  // เวลาเข้า-ออกกับชื่อสาขาไม่ได้อยู่ใน attendance_summary — ดึงเสริมทีเดียว
  const detail = await loadCheckinDetail(from, to, [...new Set(rows.map((r) => r.user_id))])

  // วันหยุดตามประกาศ (ต่างจาก "วันหยุดตามตารางเวร" ที่ attendance_summary รู้อยู่แล้ว)
  const { data: holidays } = await client
    .from('holidays')
    .select('holiday_date, name, is_working_day')
    .gte('holiday_date', from)
    .lte('holiday_date', to)
    .eq('is_active', true)

  const holidayByDate = new Map(
    (holidays ?? []).map((h) => [h.holiday_date, h])
  )

  return rows
    .map((r) => {
      const d = detail.get(`${r.user_id}|${r.work_date}`)
      const holiday = holidayByDate.get(r.work_date)

      return {
        date: r.work_date,
        userId: r.user_id,
        userName: r.full_name,
        firstCheckIn: d?.firstIn ?? '-',
        lastCheckOut: d?.lastOut ?? '-',
        totalHours: Math.round(Number(r.total_hours ?? 0) * 100) / 100,
        status: mapStatus(r, !!holiday),
        locationName: d?.locationName,
        isLate: r.is_late ?? false,
        lateMinutes: d?.lateMinutes ?? 0,
        note: buildNote(r, holiday?.name),
        holidayName: holiday?.name,
        isWorkingHoliday: holiday?.is_working_day,
      } satisfies AttendanceReportData
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.userName.localeCompare(b.userName))
}

function mapStatus(r: SummaryRow, isHoliday: boolean): AttendanceReportData['status'] {
  if (r.status === 'worked') return r.is_late ? 'late' : 'normal'
  // ลากับวันหยุดตามตารางเวร ไม่ใช่การขาดงาน
  if (r.status === 'leave' || r.status === 'day_off' || r.status === 'not_tracked') return 'holiday'
  return isHoliday ? 'holiday' : 'absent'
}

function buildNote(r: SummaryRow, holidayName?: string): string {
  const parts: string[] = []

  if (holidayName) parts.push(holidayName)
  if (r.status === 'leave') parts.push(LEAVE_LABEL[r.leave_type ?? ''] ?? 'ลา')
  else if (r.status === 'day_off') parts.push('วันหยุดตามตาราง')
  else if (r.status === 'not_tracked') parts.push('ไม่ต้องเช็คอิน')
  if (r.checkin_type === 'wfh') parts.push('ทำงานที่บ้าน')
  else if (r.checkin_type === 'offsite') parts.push('เช็คอินนอกสถานที่')

  return parts.join(' · ')
}

/** เวลาเข้าแรก-ออกสุดท้ายของแต่ละคนแต่ละวัน — query เดียวทั้งช่วง */
async function loadCheckinDetail(from: string, to: string, userIds: string[]) {
  const out = new Map<
    string,
    { firstIn: string; lastOut: string; locationName?: string; lateMinutes: number }
  >()
  if (!userIds.length) return out

  const { data, error } = await sb()
    .from('checkins')
    .select(
      'user_id, work_date, checkin_time, checkout_time, primary_location_name, late_minutes, checkin_type'
    )
    .gte('work_date', from)
    .lte('work_date', to)
    .in('user_id', userIds)
    .order('checkin_time')

  if (error) {
    console.error('ดึงรายละเอียดเช็คอินไม่สำเร็จ:', error.message)
    return out
  }

  for (const c of data ?? []) {
    const key = `${c.user_id}|${c.work_date}`
    const prev = out.get(key)

    const inAt = c.checkin_time ? format(new Date(c.checkin_time), 'HH:mm') : '-'
    const outAt = c.checkout_time ? format(new Date(c.checkout_time), 'HH:mm') : '-'

    if (!prev) {
      out.set(key, {
        firstIn: inAt,
        lastOut: outAt,
        locationName: c.primary_location_name ?? 'เช็คอินนอกสถานที่',
        lateMinutes: c.late_minutes ?? 0,
      })
    } else {
      // เรียงตามเวลาเข้าอยู่แล้ว — เข้าแรกคงเดิม เอาออกล่าสุด
      if (outAt !== '-') prev.lastOut = outAt
    }
  }

  return out
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
  const showOnlyPresent = filters.showOnlyPresent !== false

  const all = await loadReport(filters)

  const filtered = showOnlyPresent
    ? all.filter((r) => r.status !== 'absent' && (r.status !== 'holiday' || r.isWorkingHoliday))
    : all

  const totalRecords = filtered.length
  const totalPages = Math.ceil(totalRecords / pageSize)
  const start = (page - 1) * pageSize

  return {
    data: filtered.slice(start, start + pageSize),
    summary: getAttendanceSummary(filtered),
    pagination: {
      currentPage: page,
      totalPages,
      totalRecords,
      pageSize,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }
}

export async function getAttendanceReportForExport(
  filters: Omit<AttendanceReportFilters, 'page' | 'pageSize'>
): Promise<AttendanceReportResponse> {
  const all = await loadReport(filters)
  const showOnlyPresent = filters.showOnlyPresent !== false

  const filtered = showOnlyPresent
    ? all.filter((r) => r.status !== 'absent' && (r.status !== 'holiday' || r.isWorkingHoliday))
    : all

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
