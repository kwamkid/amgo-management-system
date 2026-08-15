// lib/services/checkinService.ts
//
// เช็คอิน/เช็คเอาท์ บน Supabase
// ของเดิมที่ใช้ Firestore ลบทิ้งแล้ว — ย้อนดูได้ใน git history
//
// คง signature ของทุกฟังก์ชันไว้เหมือนเดิม หน้าจอกับ hook จึงไม่ต้องแก้
// เปลี่ยนแค่ import
//
// ── ต่างจากของเดิมตรงไหน ──────────────────────────────────────────────
// Firestore เก็บซ้อนเป็น checkins/{วันที่}/records/{id} ทำให้ทุกฟังก์ชัน
// ต้องรู้ "วันที่" ถึงจะหาเอกสารเจอ และ query ข้ามวันต้องวนทีละวัน
// Postgres เก็บแบนมี work_date เป็นคอลัมน์ → หาโดย id อย่างเดียวพอ
// พารามิเตอร์ dateStr ที่เหลืออยู่จึงไม่ได้ใช้ คงไว้เพื่อไม่ให้ผู้เรียกพัง

import { createClient } from '@/lib/supabase/client'
import type {
  CheckInRecord,
  CreateCheckInData,
  CheckOutData,
  CheckInFilters,
  DailyCheckInSummary,
} from '@/types/checkin'
import type { Database } from '@/types/database'
import { format } from 'date-fns'
import {
  calculateWorkingHours,
  needsOvertimeApproval,
  distanceMeters,
  normalEndTime,
  isForgotCheckout,
} from './workingHoursService'
import { getLocation } from './locationService'
import { getDeviceId } from '@/lib/utils/device'

type Row = Database['public']['Tables']['checkins']['Row']

/** แปลงแถวจาก Postgres (snake_case) เป็นรูปแบบที่หน้าจอเดิมใช้ (camelCase) */
function toRecord(r: Row): CheckInRecord {
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.user_name ?? '',
    userAvatar: r.user_avatar ?? undefined,

    checkinTime: r.checkin_time ? new Date(r.checkin_time) : new Date(),
    checkinLat: Number(r.checkin_lat ?? 0),
    checkinLng: Number(r.checkin_lng ?? 0),
    checkinType: (r.checkin_type ?? 'onsite') as CheckInRecord['checkinType'],
    checkinPhotoUrl: r.checkin_photo_url ?? undefined,

    locationsInRange: r.locations_in_range ?? [],
    primaryLocationId: r.primary_location_id,
    primaryLocationName: r.primary_location_name ?? undefined,

    selectedShift: r.shift_id ?? undefined,
    selectedShiftName: r.shift_name ?? undefined,
    shiftStartTime: r.shift_start_time ?? undefined,
    shiftEndTime: r.shift_end_time ?? undefined,

    checkoutTime: r.checkout_time ? new Date(r.checkout_time) : undefined,
    checkoutLat: r.checkout_lat != null ? Number(r.checkout_lat) : undefined,
    checkoutLng: r.checkout_lng != null ? Number(r.checkout_lng) : undefined,

    regularHours: Number(r.regular_hours ?? 0),
    overtimeHours: Number(r.overtime_hours ?? 0),
    totalHours: Number(r.total_hours ?? 0),
    breakHours: Number(r.break_hours ?? 0),

    status: r.status as CheckInRecord['status'],
    isOvernightShift: r.is_overnight_shift ?? undefined,
    isLate: r.is_late ?? false,
    lateMinutes: r.late_minutes ?? 0,
    forgotCheckout: r.forgot_checkout ?? undefined,
    autoCheckout: r.auto_checkout ?? undefined,
    needsOvertimeApproval: r.needs_overtime_approval ?? undefined,

    note: r.note ?? undefined,
    createdAt: r.created_at ? new Date(r.created_at) : undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at) : undefined,
  }
}

const sb = () => createClient()

// กติกาคิดชั่วโมงเมื่อเช็คอินแบบไม่มีสาขา (นอกสถานที่/WFH):
// ไม่มี cap เวลาปิดร้าน · หักพัก 1 ชม. เมื่อทำเกิน 4 ชม. · เกิน 8 ชม./วัน = OT
const OFFSITE_HOURS_RULES = { workingHours: {} as Record<string, never>, breakHours: 1 }

/**
 * ทับ userName (snapshot ชื่อจริงตอนเช็คอิน) ด้วย "ชื่อจริง (ชื่อเล่น)" ปัจจุบัน
 * อ่านโปรไฟล์คนอื่นไม่ได้ (RLS) ก็คงชื่อเดิมไว้
 */
async function withDisplayNames(records: CheckInRecord[]): Promise<CheckInRecord[]> {
  const { getDisplayNames } = await import('./user/queries')
  const names = await getDisplayNames(records.map((r) => r.userId))
  if (!names.size) return records
  return records.map((r) => ({ ...r, userName: names.get(r.userId) || r.userName }))
}

/* ------------------------------------------------------------------ *
 *  ปิดกะที่ค้าง — ใช้ตอนคนลืมเช็คเอาท์แล้วมาเช็คอินวันใหม่
 *  ไม่ต้องใช้ GPS
 * ------------------------------------------------------------------ */
export async function forceCheckOut(
  recordId: string,
  _dateStr: string, // ไม่ได้ใช้แล้ว — ตารางแบนหาโดย id ได้เลย
  note: string
): Promise<void> {
  const { error } = await sb()
    .from('checkins')
    .update({
      checkout_time: new Date().toISOString(),
      status: 'completed',
      auto_checkout: true,
      forgot_checkout: true,
      auto_checkout_note: note,
      auto_checkout_at: new Date().toISOString(),
    })
    .eq('id', recordId)

  if (error) throw new Error(`ปิดกะค้างไม่สำเร็จ: ${error.message}`)
}

/* ------------------------------------------------------------------ */
export async function createCheckIn(
  data: CreateCheckInData & {
    locationsInRange: string[]
    primaryLocationId: string | null
    primaryLocationName?: string
    checkinType: 'onsite' | 'offsite' | 'wfh'
    selectedShift?: {
      id?: string
      name?: string
      startTime?: string
      endTime?: string
      graceMinutes?: number
    }
  }
): Promise<string> {
  const now = new Date()

  // สายรู้ได้ทันทีตอนเช็คอิน — เทียบกับเวลาเริ่มกะ + ช่วงผ่อนผัน
  // (เดิมเขียน false ตายตัวแล้วไม่มีใครแก้ทีหลัง → รายงานสายว่างทั้งระบบ)
  let isLate = false
  let lateMinutes = 0
  if (data.selectedShift?.startTime) {
    const [h, m] = data.selectedShift.startTime.split(':').map(Number)
    const shiftStart = new Date(now)
    shiftStart.setHours(h, m, 0, 0)
    const raw = Math.floor((now.getTime() - shiftStart.getTime()) / 60_000)
    const grace = data.selectedShift.graceMinutes ?? 15
    // |raw| เกิน 12 ชม. = กะข้ามคืน/ข้อมูลเพี้ยน — ไม่ตีสาย
    if (raw > grace && raw < 720) {
      isLate = true
      lateMinutes = raw
    }
  }

  const { data: row, error } = await sb()
    .from('checkins')
    .insert({
      user_id: data.userId,
      user_name: data.userName,
      user_avatar: data.userAvatar,

      work_date: format(now, 'yyyy-MM-dd'),
      checkin_time: now.toISOString(),
      checkin_lat: data.lat,
      checkin_lng: data.lng,
      checkin_type: data.checkinType,
      checkin_photo_url: data.checkinPhotoUrl ?? null,

      locations_in_range: data.locationsInRange,
      primary_location_id: data.primaryLocationId,
      primary_location_name: data.primaryLocationName ?? null,

      shift_id: data.selectedShift?.id ?? null,
      shift_name: data.selectedShift?.name ?? null,
      shift_start_time: data.selectedShift?.startTime ?? null,
      shift_end_time: data.selectedShift?.endTime ?? null,

      regular_hours: 0,
      overtime_hours: 0,
      break_hours: 0,

      status: 'checked-in',
      is_late: isLate,
      late_minutes: lateMinutes,
      note: data.note ?? null,
      device_id: getDeviceId(), // จับเครื่องเดียวเช็คอินหลายคน
    })
    .select('id')
    .single()

  if (error) throw new Error(`เช็คอินไม่สำเร็จ: ${error.message}`)
  return row.id
}

/**
 * สิทธิ์ OT: ตั้งรายคนชนะ ไม่ตั้งใช้ของตำแหน่ง — noti เช็คเอาท์ใช้ตัดสินว่าควรโชว์โอทีไหม
 * (พนักงานทั่วไปทำเกิน 8 ชม. ระบบเก็บชั่วโมงไว้เป็นข้อมูล แต่ไม่ใช่เงินโอที)
 */
export async function resolveOtEligible(userId: string): Promise<boolean> {
  const { data } = await sb()
    .from('users')
    .select('ot_eligible, job_functions(ot_eligible)')
    .eq('id', userId)
    .single()
  const jfRaw = data?.job_functions
  const jf = (Array.isArray(jfRaw) ? jfRaw[0] : jfRaw) as { ot_eligible: boolean | null } | null
  return data?.ot_eligible ?? jf?.ot_eligible ?? false
}

/* ------------------------------------------------------------------ */
export async function checkOut(
  userId: string,
  checkoutData: CheckOutData
): Promise<{ totalHours: number; overtimeHours: number; farKm: number; forgot: boolean }> {
  const active = await getActiveCheckIn(userId)
  if (!active) throw new Error('ไม่พบการเช็คอินที่ยังไม่ได้เช็คเอาท์')

  const location = active.primaryLocationId ? await getLocation(active.primaryLocationId) : null

  const checkinTime = new Date(active.checkinTime)
  const checkoutTime = new Date()
  const breakHours = location?.breakHours ?? OFFSITE_HOURS_RULES.breakHours

  // เวลาเลิกงานปกติของกะนี้ — เพดานเดียวใช้ได้ทั้งเคสเช็คเอาท์ไกลและเคสลืมเช็คเอาท์
  const normalEnd = normalEndTime(checkinTime, active.shiftEndTime, breakHours)

  // ── ลืมเช็คเอาท์ = มากดปิดกะข้ามวัน ─────────────────────────────────
  // กติกาเจ้าของ (14 ส.ค. 69): ลืมเช็คเอาท์ให้ปิดที่ "เวลาเลิกงานปกติ" คิด
  // ชั่วโมงถึงแค่นั้น ไม่มี OT + ติดธง needs_review ให้ HR ตรวจ
  //
  // กติกานี้เคยเขียนไว้ที่ autoCheckoutService (cron 23:59) ที่เดียว ซึ่งกวาด
  // เฉพาะกะที่เปิดค้างเกิน 12 ชม. — คนเข้าบ่าย/เย็นแล้วลืมจึงรอดตาข่ายไปกด
  // เช็คเอาท์เองเช้าวันรุ่งขึ้น แล้วได้ชั่วโมงเต็มดุ้น (ปู 14 ส.ค. 69: เข้า
  // 16:55 ออก 08:48 → 14.87 ชม. + OT 6.87) เพดาน "เช็คเอาท์ไกล" ก็ช่วยไม่ได้
  // เพราะคน WFH ไม่มีสาขาให้เทียบระยะ
  //
  // เส้นแบ่ง "ข้ามวัน" อยู่ใน isForgotCheckout (workingHoursService) — เทสต์ที่
  // scripts/test-checkout-hours.mjs ยิงตรงเข้าฟังก์ชันนั้น
  const forgot = isForgotCheckout(
    checkinTime,
    checkoutTime,
    active.shiftStartTime,
    active.shiftEndTime,
    breakHours
  )

  // ── เช็คเอาท์ไกลจากสาขาที่เช็คอิน = ตัดชั่วโมงที่เวลาเลิกงานปกติ ──────
  // เจ้าของสั่ง 14 ส.ค. 69: กันเคส "เช็คอินที่งาน กลับไปเช็คเอาท์ที่บ้าน
  // เพื่อปั๊มชั่วโมง" — ไม่บล็อก (คนลืมจะติดค้าง) แต่ชั่วโมงนับถึงเวลาเลิกงาน
  // เท่านั้น และไม่เกิด OT (OT อยู่หลังเวลาเลิกงาน โดนตัดก่อนพอดี)
  // ใช้เฉพาะเช็คอินที่สาขา — offsite/WFH ไม่มีจุดอ้างอิงให้เทียบ
  // เผื่อ GPS แกว่ง 300 ม. นอกรัศมีถึงนับว่า "ไกล"
  // ข้ามไปเลยถ้าเข้าข่ายลืม — คนลืมย่อมกดจากที่บ้านตอนเช้า ทักว่า "นอกพื้นที่"
  // ก็ผิดเรื่อง และเพดานเดียวกันโดนตัดไปแล้ว
  let farKm = 0
  let effectiveCheckout = forgot && normalEnd < checkoutTime ? normalEnd : checkoutTime
  if (
    !forgot &&
    active.checkinType === 'onsite' &&
    location &&
    checkoutData.lat != null &&
    checkoutData.lng != null
  ) {
    const dist = distanceMeters(location.lat, location.lng, checkoutData.lat, checkoutData.lng)
    if (dist > location.radius + 300) {
      farKm = Math.round(dist / 100) / 10
      if (normalEnd < checkoutTime) effectiveCheckout = normalEnd
    }
  }

  const shiftInfo = active.selectedShift
    ? {
        startTime: active.shiftStartTime!,
        endTime: active.shiftEndTime!,
        graceMinutes: 15,
      }
    : undefined

  // ไม่มีสาขา (นอกสถานที่/WFH) ก็ต้องได้ชั่วโมง/OT — ใช้กติกากลางแทนของสาขา
  // (เดิมคืน 0 หมด ทำให้คนทำงานที่บ้านไม่มีชั่วโมงและ OT หาย)
  const calcBase = calculateWorkingHours(
    checkinTime,
    effectiveCheckout,
    location ?? OFFSITE_HOURS_RULES,
    shiftInfo,
    false
  )
  // ไม่มีกะให้เทียบ → คงสถานะสายที่คิดไว้ตอนเช็คอิน
  const calcRaw = shiftInfo
    ? calcBase
    : { ...calcBase, isLate: active.isLate, lateMinutes: active.lateMinutes }
  // เช็คเอาท์ไกล/ลืมเช็คเอาท์ = ไม่มี OT เด็ดขาด (กันเศษ OT จากการปัดเวลา)
  const calc = farKm || forgot
    ? { ...calcRaw, overtimeHours: 0, totalHours: calcRaw.regularHours }
    : calcRaw

  // เคสลืมไม่ต้องเข้าคิวอนุมัติโอที — ชั่วโมงโดนตัดที่เวลาเลิกงานไปแล้ว
  // (ของเดิมปล่อยเข้าคิว ทำให้ใบที่ลืมค้างสถานะ "รออนุมัติ" ไม่มีวันจบ)
  const needsApproval = location && !farKm && !forgot
    ? needsOvertimeApproval(checkoutTime, location, checkinTime)
    : false

  // เคสลืม บันทึกเวลาออก = เวลาเลิกงานที่ระบบปิดให้ (เหมือน cron ปิดกะ) เวลาที่
  // กดจริงเก็บไว้ในหมายเหตุ — รายงานจะได้อ่านแล้วตรงกัน เวลาออกคู่กับชั่วโมง
  const recordedCheckout = forgot ? effectiveCheckout : checkoutTime

  // total_hours เป็น generated column ใน Postgres (regular + overtime) — ห้ามเขียนเอง
  const { error } = await sb()
    .from('checkins')
    .update({
      checkout_time: recordedCheckout.toISOString(),
      checkout_lat: checkoutData.lat ?? null,
      checkout_lng: checkoutData.lng ?? null,
      regular_hours: calc.regularHours,
      overtime_hours: calc.overtimeHours,
      break_hours: calc.breakHours,
      status: needsApproval ? 'pending' : 'completed',
      is_late: calc.isLate,
      late_minutes: calc.lateMinutes,
      is_overnight_shift: calc.isOvernightShift,
      forgot_checkout: forgot,
      needs_overtime_approval: needsApproval,
      checkout_note:
        [
          forgot
            ? `[ลืมเช็คเอาท์ — ระบบปิดให้ที่เวลาเลิกงาน ไม่มี OT · กดจริง ${format(checkoutTime, 'dd/MM HH:mm')}] HR แก้ได้ถ้าทำงานจริงเลยเวลา`
            : '',
          farKm ? `[เช็คเอาท์นอกพื้นที่ ${farKm} กม. — ตัดชั่วโมงที่เวลาเลิกงาน]` : '',
          checkoutData.note ?? '',
        ]
          .filter(Boolean)
          .join(' ') || null,
      hours_status: forgot ? 'needs_review' : 'original',
    })
    .eq('id', active.id!)

  if (error) throw new Error(`เช็คเอาท์ไม่สำเร็จ: ${error.message}`)

  // ส่งเลขที่คำนวณจริงกลับไปให้ noti — ไม่ต้องคิดเองจากเวลาดิบอีก
  return { totalHours: calc.totalHours, overtimeHours: calc.overtimeHours, farKm, forgot }
}

/* ------------------------------------------------------------------ *
 *  กะที่ยังเปิดอยู่
 *
 *  ของเดิมต้องยิง 2 query (วันนี้ + เมื่อวาน เผื่อกะข้ามคืน)
 *  ตารางแบนหาได้ทีเดียว แค่มองย้อนไป 2 วัน
 * ------------------------------------------------------------------ */
export async function getActiveCheckIn(userId: string): Promise<CheckInRecord | null> {
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  const { data, error } = await sb()
    .from('checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'checked-in')
    .is('checkout_time', null)
    .gte('work_date', format(twoDaysAgo, 'yyyy-MM-dd'))
    .order('checkin_time', { ascending: false })
    .limit(1)

  if (error) throw new Error(`ดึงกะที่เปิดอยู่ไม่สำเร็จ: ${error.message}`)
  return data?.length ? toRecord(data[0]) : null
}

/* ------------------------------------------------------------------ *
 *  รายการเช็คอินตามตัวกรอง
 *
 *  ของเดิมส่ง lastDoc ของ Firestore ไปมาเพื่อแบ่งหน้า
 *  Postgres ใช้ offset ตรง ๆ — คงชื่อพารามิเตอร์ไว้ให้ผู้เรียกไม่ต้องแก้
 *  โดยตีความ lastDoc เป็นตัวเลข offset
 * ------------------------------------------------------------------ */
export async function getCheckInRecords(
  filters: CheckInFilters,
  pageSize = 20,
  lastDoc?: number
): Promise<{ records: CheckInRecord[]; lastDoc: number; hasMore: boolean }> {
  const offset = typeof lastDoc === 'number' ? lastDoc : 0

  let q = sb()
    .from('checkins')
    .select('*')
    .order('checkin_time', { ascending: false })
    .range(offset, offset + pageSize) // ขอเกินมา 1 แถวเพื่อรู้ว่ายังมีต่อไหม

  // ของเดิมบังคับดูทีละวันเพราะโครงสร้างซ้อน — ตอนนี้ช่วงวันที่ก็ได้
  if (filters.date) q = q.eq('work_date', filters.date)
  if (filters.startDate) q = q.gte('work_date', filters.startDate)
  if (filters.endDate) q = q.lte('work_date', filters.endDate)
  if (filters.userId) q = q.eq('user_id', filters.userId)
  if (filters.locationId) q = q.eq('primary_location_id', filters.locationId)
  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status)
  if (filters.isLate !== undefined) q = q.eq('is_late', filters.isLate)
  if (filters.hasOvertime) q = q.gt('overtime_hours', 0)

  const { data, error } = await q
  if (error) throw new Error(`ดึงรายการเช็คอินไม่สำเร็จ: ${error.message}`)

  const rows = data ?? []
  const hasMore = rows.length > pageSize

  return {
    records: await withDisplayNames(rows.slice(0, pageSize).map(toRecord)),
    lastDoc: offset + pageSize,
    hasMore,
  }
}

/* ------------------------------------------------------------------ *
 *  HR เติมวันทำงานย้อนหลัง — กรณีพิสูจน์ได้ว่าพนักงานมาทำงานแต่ลืมเช็คอิน
 *
 *  RLS: policy checkins_manage ให้เฉพาะ HR/แอดมินเขียนแถวของคนอื่นได้
 *  เหตุผลบังคับกรอก และขึ้นต้น note ให้เสมอ — ในรายงานจะเห็นชัดว่าเป็นวันที่เติมให้
 * ------------------------------------------------------------------ */
export async function backfillWorkDay(params: {
  userId: string
  userName: string
  workDate: string // YYYY-MM-DD
  inTime: string // HH:mm
  outTime: string // HH:mm
  reason: string
}): Promise<void> {
  const { userId, userName, workDate, inTime, outTime, reason } = params

  if (!reason.trim()) throw new Error('กรุณาระบุเหตุผล/หลักฐานที่เติมวันให้')

  const checkin = new Date(`${workDate}T${inTime}:00+07:00`)
  const checkout = new Date(`${workDate}T${outTime}:00+07:00`)
  const hours = (checkout.getTime() - checkin.getTime()) / 3_600_000
  if (hours <= 0) throw new Error('เวลาออกต้องอยู่หลังเวลาเข้า')

  // กันเติมซ้ำวันที่มีเช็คอินอยู่แล้ว
  const { data: existing } = await sb()
    .from('checkins')
    .select('id')
    .eq('user_id', userId)
    .eq('work_date', workDate)
    .limit(1)
  if (existing?.length) throw new Error('วันนี้มีเช็คอินอยู่แล้ว')

  const rounded = Math.round(hours * 100) / 100
  const { error } = await sb().from('checkins').insert({
    user_id: userId,
    user_name: userName,
    work_date: workDate,
    checkin_time: checkin.toISOString(),
    checkout_time: checkout.toISOString(),
    checkin_lat: 0,
    checkin_lng: 0,
    checkin_type: 'offsite',
    status: 'completed',
    regular_hours: rounded,
    total_hours: rounded,
    note: `HR เติมวันทำงานย้อนหลัง: ${reason.trim()}`,
  })
  if (error) throw new Error(`เติมวันทำงานไม่สำเร็จ: ${error.message}`)
}

/* ------------------------------------------------------------------ *
 *  คนที่ลืมเช็คเอาท์
 *
 *  ของเดิมวน query 7 วัน ทีละวัน = 7 รอบ · ตอนนี้ query เดียว
 * ------------------------------------------------------------------ */
export async function getPendingCheckouts(): Promise<CheckInRecord[]> {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const { data, error } = await sb()
    .from('checkins')
    .select('*')
    .eq('status', 'checked-in')
    .is('checkout_time', null)
    .gte('work_date', format(weekAgo, 'yyyy-MM-dd'))
    .order('checkin_time', { ascending: false })

  if (error) throw new Error(`ดึงรายการที่ลืมเช็คเอาท์ไม่สำเร็จ: ${error.message}`)
  return withDisplayNames((data ?? []).map(toRecord))
}

/* ------------------------------------------------------------------ *
 *  HR ปิดกะให้พนักงาน — ต้องเก็บร่องรอยว่าใครแก้ เพราะกระทบค่าแรง
 * ------------------------------------------------------------------ */
export async function manualCheckout(
  recordId: string,
  _dateStr: string,
  checkoutTime: Date,
  approvedBy: string,
  approvedByName: string,
  reason: string,
  approveOvertime = false
): Promise<void> {
  const client = sb()

  const { data: rec, error: getErr } = await client
    .from('checkins')
    .select('*')
    .eq('id', recordId)
    .single()

  if (getErr || !rec) throw new Error('ไม่พบข้อมูลการเช็คอิน')

  const location = rec.primary_location_id ? await getLocation(rec.primary_location_id) : null
  const checkinTime = new Date(rec.checkin_time!)

  const calc = calculateWorkingHours(
    checkinTime,
    checkoutTime,
    location ?? OFFSITE_HOURS_RULES, // ไม่มีสาขา (นอกสถานที่/WFH) ใช้กติกากลาง
    rec.shift_start_time && rec.shift_end_time
      ? { startTime: rec.shift_start_time, endTime: rec.shift_end_time, graceMinutes: 15 }
      : undefined,
    approveOvertime // ไม่อนุมัติ = ชั่วโมงที่เกินเวลาปิดไม่ถูกนับเป็นโอที
  )

  const { error } = await client
    .from('checkins')
    .update({
      checkout_time: checkoutTime.toISOString(),
      regular_hours: calc.regularHours,
      overtime_hours: calc.overtimeHours,
      break_hours: calc.breakHours,
      status: 'completed',
      is_overnight_shift: calc.isOvernightShift,
      forgot_checkout: true,
      manual_checkout: true,
      manual_checkout_by: approvedBy,
      manual_checkout_at: new Date().toISOString(),
      manual_note: reason,
      overtime_approved: approveOvertime,
      needs_overtime_approval: false,
      hours_status: 'original',
    })
    .eq('id', recordId)

  if (error) throw new Error(`ปิดกะไม่สำเร็จ: ${error.message}`)

  // ร่องรอยที่ HR เปิดดูได้เอง — ส่วน audit_log เก็บให้อัตโนมัติอยู่แล้ว
  await client.from('checkin_edits').insert({
    checkin_id: recordId,
    edited_at: new Date().toISOString(),
    edited_by: approvedBy,
    edited_by_name: approvedByName,
    field: 'checkoutTime',
    old_value: null,
    new_value: checkoutTime.toISOString(),
    reason,
  })
}

/* ------------------------------------------------------------------ *
 *  สรุปรายวัน
 *
 *  ของเดิมดึงทุกแถวของวันนั้นมานับใน JavaScript
 *  ตอนนี้ให้ Postgres นับให้ — ส่งกลับแค่ตัวเลขสรุป
 * ------------------------------------------------------------------ */
export async function getDailySummary(date: Date = new Date()): Promise<DailyCheckInSummary> {
  const dateStr = format(date, 'yyyy-MM-dd')

  const { data, error } = await sb()
    .from('checkins')
    .select('user_id, status, is_late, overtime_hours, total_hours')
    .eq('work_date', dateStr)

  if (error) throw new Error(`ดึงสรุปรายวันไม่สำเร็จ: ${error.message}`)

  const rows = data ?? []

  return {
    date: dateStr,
    totalEmployees: new Set(rows.map((r) => r.user_id)).size,
    checkedIn: rows.length,
    checkedOut: rows.filter((r) => r.status === 'completed').length,
    late: rows.filter((r) => r.is_late).length,
    // absent/onLeave คำนวณจากตารางเวร ไม่ใช่จากตารางเช็คอิน
    // ใช้ attendance_summary() แทน — ที่นี่คืน 0 ไว้ก่อนเพื่อไม่ให้ตัวเลขหลอก
    absent: 0,
    onLeave: 0,
    working: rows.filter((r) => r.status === 'checked-in').length,
    overtime: rows.filter((r) => Number(r.overtime_hours ?? 0) > 0).length,
  }
}
