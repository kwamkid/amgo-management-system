// lib/services/holidayService.ts
//
// วันหยุด บน Supabase
// ของเดิมที่ใช้ Firestore ลบทิ้งแล้ว — ย้อนดูได้ใน git history
//
// ── ต่างจากของเดิมตรงไหน ──────────────────────────────────────────────
// 1. เก็บ holiday_date เป็น date ไม่ใช่ timestamp — เดิมต้องคำนวณ
//    "ต้นวัน/ท้ายวัน" ทุกครั้งที่เช็คว่าวันนี้เป็นวันหยุดไหม
// 2. ห้ามซ้ำวันด้วย unique constraint ที่ฐานข้อมูล เดิมต้อง query เช็คก่อน
//    ทุกครั้งตอนนำเข้าวันหยุดราชการ (แข่งกันก็ยังซ้ำได้)

import { createClient } from '@/lib/supabase/client'
import type {
  Holiday,
  HolidayFormData,
  HolidayFilters,
  PublicHolidayImport,
} from '@/types/holiday'
import { DEFAULT_OT_RATES } from '@/types/holiday'
import type { Database } from '@/types/database'
import { format } from 'date-fns'

type HolidayRow = Database['public']['Tables']['holidays']['Row']

const sb = () => createClient()
const ymd = (d: Date | string) =>
  typeof d === 'string' ? d.slice(0, 10) : format(d, 'yyyy-MM-dd')

function toHoliday(r: HolidayRow): Holiday {
  return {
    id: r.id,
    name: r.name,
    // เก็บเป็น date ล้วน ไม่มีเวลา — บวกเวลาเที่ยงกันเพี้ยนข้ามวันจาก timezone
    date: new Date(`${r.holiday_date}T12:00:00`),
    type: r.holiday_type as Holiday['type'],
    isWorkingDay: r.is_working_day,
    overtimeRates: (r.overtime_rates ?? DEFAULT_OT_RATES) as Holiday['overtimeRates'],
    applicableLocationIds: r.applicable_location_ids ?? [],
    applicableRoles: r.applicable_roles ?? [],
    description: r.description || undefined,
    recurring: r.recurring,
    recurringDay: r.recurring_day ?? undefined,
    recurringMonth: r.recurring_month ?? undefined,
    isActive: r.is_active,
    createdAt: new Date(r.created_at),
    createdBy: r.created_by ?? undefined,
    updatedAt: new Date(r.updated_at),
    updatedBy: r.updated_by ?? undefined,
  }
}

function toColumns(data: Partial<HolidayFormData>) {
  const patch: Record<string, unknown> = {}

  if (data.name !== undefined) patch.name = data.name
  if (data.date !== undefined) patch.holiday_date = ymd(data.date)
  if (data.type !== undefined) patch.holiday_type = data.type
  if (data.isWorkingDay !== undefined) patch.is_working_day = data.isWorkingDay
  if (data.overtimeRates !== undefined) patch.overtime_rates = data.overtimeRates
  if (data.applicableLocationIds !== undefined)
    patch.applicable_location_ids = data.applicableLocationIds
  if (data.applicableRoles !== undefined) patch.applicable_roles = data.applicableRoles
  if (data.description !== undefined) patch.description = data.description ?? ''
  if (data.recurring !== undefined) patch.recurring = data.recurring
  if (data.recurringDay !== undefined) patch.recurring_day = data.recurringDay
  if (data.recurringMonth !== undefined) patch.recurring_month = data.recurringMonth

  return patch
}

/* ------------------------------------------------------------------ */
export async function createHoliday(
  data: HolidayFormData,
  userId: string
): Promise<string> {
  const { data: row, error } = await sb()
    .from('holidays')
    .insert({
      ...toColumns(data),
      overtime_rates: data.overtimeRates ?? DEFAULT_OT_RATES,
      is_active: true,
      created_by: userId,
      updated_by: userId,
    } as never)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('วันที่นี้มีวันหยุดอยู่แล้ว')
    throw new Error(`สร้างวันหยุดไม่สำเร็จ: ${error.message}`)
  }
  return row.id
}

export async function updateHoliday(
  holidayId: string,
  data: Partial<HolidayFormData>,
  userId: string
): Promise<void> {
  const { error } = await sb()
    .from('holidays')
    .update({ ...toColumns(data), updated_by: userId } as never)
    .eq('id', holidayId)

  if (error) {
    if (error.code === '23505') throw new Error('วันที่นี้มีวันหยุดอยู่แล้ว')
    throw new Error(`แก้ไขวันหยุดไม่สำเร็จ: ${error.message}`)
  }
}

/** ลบจริง — วันหยุดไม่มีใครอ้างถึงด้วย foreign key */
export async function deleteHoliday(holidayId: string): Promise<void> {
  const { error } = await sb().from('holidays').delete().eq('id', holidayId)
  if (error) throw new Error(`ลบวันหยุดไม่สำเร็จ: ${error.message}`)
}

/* ------------------------------------------------------------------ */
export async function getHolidays(filters?: HolidayFilters): Promise<Holiday[]> {
  let q = sb().from('holidays').select('*').order('holiday_date')

  if (filters?.year) {
    q = q.gte('holiday_date', `${filters.year}-01-01`).lte('holiday_date', `${filters.year}-12-31`)
  }
  if (filters?.type) q = q.eq('holiday_type', filters.type)
  if (filters?.isActive !== undefined) q = q.eq('is_active', filters.isActive)

  const { data, error } = await q
  if (error) throw new Error(`ดึงรายการวันหยุดไม่สำเร็จ: ${error.message}`)

  let rows = (data ?? []).map(toHoliday)

  // กรองตามสาขา/ตำแหน่งทำในโค้ด — เป็น array ที่ "ว่าง = ใช้ทุกที่"
  // ซึ่งเขียนเป็นเงื่อนไข SQL แล้วอ่านยากกว่าที่ได้
  if (filters?.locationId) {
    rows = rows.filter(
      (h) => !h.applicableLocationIds?.length || h.applicableLocationIds.includes(filters.locationId!)
    )
  }

  return rows
}

export async function getHoliday(holidayId: string): Promise<Holiday | null> {
  const { data, error } = await sb()
    .from('holidays')
    .select('*')
    .eq('id', holidayId)
    .maybeSingle()

  if (error) throw new Error(`ดึงข้อมูลวันหยุดไม่สำเร็จ: ${error.message}`)
  return data ? toHoliday(data) : null
}

/* ------------------------------------------------------------------ *
 *  วันนี้เป็นวันหยุดไหม
 *
 *  ของเดิมต้องสร้างช่วงเวลา 00:00:00 → 23:59:59 มาเทียบ เพราะเก็บเป็น
 *  timestamp — คอลัมน์เป็น date แล้วเทียบตรง ๆ ได้
 * ------------------------------------------------------------------ */
export async function isHoliday(
  date: Date,
  locationId?: string,
  role?: string
): Promise<{ isHoliday: boolean; holiday?: Holiday }> {
  const { data, error } = await sb()
    .from('holidays')
    .select('*')
    .eq('holiday_date', ymd(date))
    .eq('is_active', true)

  if (error) {
    console.error('ตรวจวันหยุดไม่สำเร็จ:', error.message)
    return { isHoliday: false }
  }

  for (const row of data ?? []) {
    const holiday = toHoliday(row)

    const locOk =
      !holiday.applicableLocationIds?.length ||
      !locationId ||
      holiday.applicableLocationIds.includes(locationId)

    const roleOk =
      !holiday.applicableRoles?.length || !role || holiday.applicableRoles.includes(role)

    if (locOk && roleOk) return { isHoliday: true, holiday }
  }

  return { isHoliday: false }
}

/* ------------------------------------------------------------------ *
 *  นำเข้าวันหยุดราชการ
 *
 *  ของเดิมยิง isHoliday() เช็คทีละวันก่อนสร้าง = 2 query ต่อวันหยุด 1 วัน
 *  ตอนนี้ยัดทีเดียวแล้วให้ unique constraint กันซ้ำ
 * ------------------------------------------------------------------ */
export async function importPublicHolidays(
  holidays: PublicHolidayImport[],
  year: number,
  userId: string
): Promise<{ success: number; failed: number }> {
  if (!holidays.length) return { success: 0, failed: 0 }

  const { data, error } = await sb()
    .from('holidays')
    .upsert(
      holidays.map((h) => ({
        name: h.name,
        holiday_date: ymd(h.date),
        holiday_type: 'public',
        is_working_day: false,
        overtime_rates: DEFAULT_OT_RATES,
        description: `วันหยุดราชการประจำปี ${year}`,
        is_active: true,
        created_by: userId,
        updated_by: userId,
      })) as never,
      { onConflict: 'holiday_date', ignoreDuplicates: true }
    )
    .select('id')

  if (error) throw new Error(`นำเข้าวันหยุดไม่สำเร็จ: ${error.message}`)

  const success = data?.length ?? 0
  return { success, failed: holidays.length - success }
}

/* ------------------------------------------------------------------ */
export async function getHolidaysInRange(
  startDate: Date,
  endDate: Date,
  locationId?: string
): Promise<Map<string, Holiday>> {
  const { data, error } = await sb()
    .from('holidays')
    .select('*')
    .gte('holiday_date', ymd(startDate))
    .lte('holiday_date', ymd(endDate))
    .eq('is_active', true)
    .order('holiday_date')

  if (error) {
    console.error('ดึงวันหยุดในช่วงไม่สำเร็จ:', error.message)
    return new Map()
  }

  const out = new Map<string, Holiday>()
  for (const row of data ?? []) {
    const holiday = toHoliday(row)
    const applies =
      !locationId ||
      !holiday.applicableLocationIds?.length ||
      holiday.applicableLocationIds.includes(locationId)

    if (applies) out.set(row.holiday_date, holiday)
  }
  return out
}

/* ------------------------------------------------------------------ */
export function getHolidayOTRate(holiday: Holiday, role: string): number {
  const rates = holiday.overtimeRates
  return (
    rates?.[role as keyof typeof rates] ??
    DEFAULT_OT_RATES[role as keyof typeof DEFAULT_OT_RATES] ??
    1.5
  )
}
