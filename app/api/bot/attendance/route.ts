// GET /api/bot/attendance — การมาทำงานรายวัน (ใครมา/สาย/ขาด/ลา) + เวลาเข้า-ออกจริง
//   ?date=YYYY-MM-DD (ค่าเริ่มต้น วันนี้) หรือ ?from=&to= (รวมวันนั้น · ไม่เกิน 62 วัน)
//   ?person=me|<discord id>|<user id> · status=absent,late,… (กรองผล)
//   superadmin ไม่ส่ง person = ทุกคน · general = ของตัวเองเสมอ
//
// status มาจาก rpc attendance_summary (ตัวเดียวกับรายงาน/กล่องงาน HR):
//   worked · worked_wfh · leave · absent · day_off · holiday · not_tracked · not_scheduled
//   "late" ใช้กรองได้ = มาแต่สาย (is_late)
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi, resolvePeople } from '@/lib/services/bot/botApi'
import { todayBkk } from '@/lib/services/bot/botTasks'
import { bkkTime, canSee, checkRange } from '@/lib/services/bot/botHr'

const STATUSES = ['worked', 'worked_wfh', 'leave', 'absent', 'day_off', 'holiday', 'not_tracked', 'not_scheduled', 'late']

type CheckinRow = {
  user_id: string
  work_date: string
  checkin_time: string
  checkout_time: string | null
  late_minutes: number | null
  primary_location_name: string | null
  checkin_type: string | null
  forgot_checkout: boolean | null
  hours_status: string | null
}

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const p = request.nextUrl.searchParams

  const from = p.get('from') ?? p.get('date') ?? todayBkk()
  const to = p.get('to') ?? p.get('date') ?? from
  const bad = checkRange(from, to)
  if (bad) return apiError(400, bad)

  const filter = p.get('status')?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
  if (filter.some((s) => !STATUSES.includes(s))) return apiError(400, `status ต้องเป็น ${STATUSES.join(', ')}`)

  let userId: string | null = caller.scope === 'superadmin' ? null : caller.user.id
  const person = p.get('person')?.trim()
  if (person) {
    const { found } = await resolvePeople(caller.sb, [person], caller.user)
    if (!found.length) return apiError(400, `ไม่พบพนักงาน: ${person}`)
    if (!canSee(caller, found[0].id)) return apiError(403, 'ดูได้แค่ของตัวเอง')
    userId = found[0].id
  }

  const [sum, ci] = await Promise.all([
    caller.sb.rpc('attendance_summary', { p_from: from, p_to: to, ...(userId ? { p_user_id: userId } : {}) }),
    (() => {
      let q = caller.sb
        .from('checkins')
        .select('user_id, work_date, checkin_time, checkout_time, late_minutes, primary_location_name, checkin_type, forgot_checkout, hours_status')
        .gte('work_date', from)
        .lte('work_date', to)
        .order('checkin_time')
      if (userId) q = q.eq('user_id', userId)
      return q
    })(),
  ])
  if (sum.error) return apiError(500, sum.error.message)
  if (ci.error) return apiError(500, ci.error.message)

  // วันเดียวเช็คอินได้หลายรอบ (กะแยก) — เข้า = รอบแรก · ออก = รอบสุดท้าย
  const shifts = new Map<string, CheckinRow[]>()
  for (const c of (ci.data ?? []) as CheckinRow[]) {
    const k = `${c.user_id}|${c.work_date}`
    shifts.set(k, [...(shifts.get(k) ?? []), c])
  }

  const rows = (sum.data ?? []).map((r) => {
    const list = shifts.get(`${r.user_id}|${r.work_date}`) ?? []
    const last = list[list.length - 1]
    return {
      date: r.work_date,
      person: { id: r.user_id, name: r.full_name },
      company: r.company_code,
      unit: r.business_unit,
      status: r.status,
      expected: r.expected_mode,
      late: r.is_late,
      lateMinutes: list.reduce((m, c) => m + (c.late_minutes ?? 0), 0) || null,
      checkIn: bkkTime(list[0]?.checkin_time ?? null),
      checkOut: bkkTime(last?.checkout_time ?? null),
      /** ยังไม่เช็คเอาท์ (กะยังเปิดอยู่) */
      open: !!last && !last.checkout_time,
      /** ลืมเช็คเอาท์ ระบบปิดกะให้ — รอ HR ตรวจ */
      needsReview: list.some((c) => c.hours_status === 'needs_review'),
      location: list[0]?.primary_location_name ?? null,
      checkinType: r.checkin_type,
      leaveType: r.leave_type,
      hours: r.total_hours === null ? null : Number(r.total_hours),
    }
  })

  const shown = filter.length ? rows.filter((r) => filter.includes(r.status) || (filter.includes('late') && r.late)) : rows
  const summary: Record<string, number> = {}
  for (const r of rows) {
    summary[r.status] = (summary[r.status] ?? 0) + 1
    if (r.late) summary.late = (summary.late ?? 0) + 1
  }
  return apiJson({ from, to, summary, rows: shown, count: shown.length })
}
