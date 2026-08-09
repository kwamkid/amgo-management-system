// lib/services/locationService.ts
//
// สถานที่เช็คอิน บน Supabase
// ของเดิมที่ใช้ Firestore ลบทิ้งแล้ว — ย้อนดูได้ใน git history
//
// ── ต่างจากของเดิมตรงไหน ──────────────────────────────────────────────
// Firestore ยัด shifts เป็น array อยู่ในเอกสารสถานที่ → หา "กะที่ขึ้นต้น 10:00
// ทุกสาขา" ไม่ได้ ต้องโหลดมาไล่เอง  Postgres แยกเป็นตาราง shifts
// service ตัวนี้จึงต้องประกอบ/แยกกะเองตอนอ่านกับเขียน
// เพื่อให้หน้าจอเดิมยังเห็นเป็นก้อนเดียวเหมือนเคย
//
// ⚠️ ตัวนี้ถูก checkinService เรียกตอนคำนวณชั่วโมงทำงาน — ถ้ายังชี้ Firestore
//    อยู่ เช็คเอาท์จะคิดชั่วโมงจากข้อมูลคนละที่กับที่บันทึก

import { createClient } from '@/lib/supabase/client'
import type { Location, LocationFormData, Shift, WorkingHours } from '@/types/location'
import type { Database } from '@/types/database'

type LocationRow = Database['public']['Tables']['locations']['Row']
type ShiftRow = Database['public']['Tables']['shifts']['Row']

const sb = () => createClient()

/** เวลาใน Postgres เป็น time (10:00:00) หน้าจอใช้ HH:mm */
const hhmm = (t: string) => t.slice(0, 5)

const CLOSED: WorkingHours = { open: '00:00', close: '00:00', isClosed: true }

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

function toWorkingHours(json: unknown): Location['workingHours'] {
  const src = (json ?? {}) as Record<string, WorkingHours | undefined>
  return Object.fromEntries(
    DAYS.map((d) => [d, src[d] ?? CLOSED])
  ) as Location['workingHours']
}

function toLocation(row: LocationRow, shifts: ShiftRow[] = []): Location {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: Number(row.lat),
    lng: Number(row.lng),
    radius: row.radius,
    breakHours: Number(row.break_hours),
    workingHours: toWorkingHours(row.working_hours),
    shifts: shifts
      .filter((s) => s.location_id === row.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        startTime: hhmm(s.start_time),
        endTime: hhmm(s.end_time),
        graceMinutes: s.grace_minutes,
      })),
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

/* ------------------------------------------------------------------ *
 *  รายการสถานที่ทั้งหมด — 2 query (สถานที่ + กะ) ไม่ใช่ 1 ต่อสาขา
 * ------------------------------------------------------------------ */
export async function getLocations(activeOnly = false): Promise<Location[]> {
  const client = sb()

  let q = client.from('locations').select('*').order('name')
  if (activeOnly) q = q.eq('is_active', true)

  const { data: rows, error } = await q
  if (error) throw new Error(`ดึงรายการสถานที่ไม่สำเร็จ: ${error.message}`)
  if (!rows?.length) return []

  const { data: shifts } = await client
    .from('shifts')
    .select('*')
    .in('location_id', rows.map((r) => r.id))
    .order('start_time')

  return rows.map((r) => toLocation(r, shifts ?? []))
}

/* ------------------------------------------------------------------ */
export async function getLocation(locationId: string): Promise<Location | null> {
  if (!locationId) return null
  const client = sb()

  const { data: row, error } = await client
    .from('locations')
    .select('*')
    .eq('id', locationId)
    .maybeSingle()

  if (error) throw new Error(`ดึงข้อมูลสถานที่ไม่สำเร็จ: ${error.message}`)
  if (!row) return null

  const { data: shifts } = await client
    .from('shifts')
    .select('*')
    .eq('location_id', locationId)
    .order('start_time')

  return toLocation(row, shifts ?? [])
}

/* ------------------------------------------------------------------ */
export async function getLocationsByIds(locationIds: string[]): Promise<Location[]> {
  if (!locationIds.length) return []
  const client = sb()

  const { data: rows, error } = await client
    .from('locations')
    .select('*')
    .in('id', locationIds)
    .order('name')

  if (error) throw new Error(`ดึงข้อมูลสถานที่ไม่สำเร็จ: ${error.message}`)
  if (!rows?.length) return []

  const { data: shifts } = await client
    .from('shifts')
    .select('*')
    .in('location_id', rows.map((r) => r.id))
    .order('start_time')

  return rows.map((r) => toLocation(r, shifts ?? []))
}

/* ------------------------------------------------------------------ *
 *  สร้าง / แก้ไข — ต้องซิงค์ตารางกะไปด้วย
 * ------------------------------------------------------------------ */
async function replaceShifts(
  locationId: string,
  shifts: LocationFormData['shifts']
): Promise<void> {
  const client = sb()

  // แทนที่ทั้งชุด ไม่ไล่เทียบทีละกะ — หน้าจอส่งมาทั้งก้อนอยู่แล้ว
  // (กะไม่ได้ถูกอ้างจากที่อื่นด้วย foreign key จึงลบทิ้งได้)
  await client.from('shifts').delete().eq('location_id', locationId)
  if (!shifts?.length) return

  const { error } = await client.from('shifts').insert(
    shifts.map((s) => ({
      location_id: locationId,
      name: s.name,
      start_time: s.startTime,
      end_time: s.endTime,
      grace_minutes: s.graceMinutes ?? 15,
    }))
  )
  if (error) throw new Error(`บันทึกกะไม่สำเร็จ: ${error.message}`)
}

export async function createLocation(data: LocationFormData): Promise<string> {
  const { data: row, error } = await sb()
    .from('locations')
    .insert({
      name: data.name,
      address: data.address ?? '',
      lat: data.lat,
      lng: data.lng,
      radius: data.radius,
      break_hours: data.breakHours ?? 0,
      working_hours: data.workingHours as never,
      is_active: data.isActive ?? true,
    })
    .select('id')
    .single()

  if (error) throw new Error(`เพิ่มสถานที่ไม่สำเร็จ: ${error.message}`)

  await replaceShifts(row.id, data.shifts)
  return row.id
}

export async function updateLocation(
  locationId: string,
  data: Partial<LocationFormData>
): Promise<void> {
  const patch: Database['public']['Tables']['locations']['Update'] = {}

  if (data.name !== undefined) patch.name = data.name
  if (data.address !== undefined) patch.address = data.address
  if (data.lat !== undefined) patch.lat = data.lat
  if (data.lng !== undefined) patch.lng = data.lng
  if (data.radius !== undefined) patch.radius = data.radius
  if (data.breakHours !== undefined) patch.break_hours = data.breakHours
  if (data.workingHours !== undefined) patch.working_hours = data.workingHours as never
  if (data.isActive !== undefined) patch.is_active = data.isActive

  if (Object.keys(patch).length) {
    const { error } = await sb().from('locations').update(patch).eq('id', locationId)
    if (error) throw new Error(`แก้ไขสถานที่ไม่สำเร็จ: ${error.message}`)
  }

  if (data.shifts !== undefined) await replaceShifts(locationId, data.shifts)
}

/** ปิดใช้งาน — ไม่ลบจริง เพราะเช็คอินเก่ายังอ้างถึงอยู่ */
export async function deleteLocation(locationId: string): Promise<void> {
  const { error } = await sb()
    .from('locations')
    .update({ is_active: false })
    .eq('id', locationId)

  if (error) throw new Error(`ปิดใช้งานสถานที่ไม่สำเร็จ: ${error.message}`)
}

/**
 * ลบถาวร
 *
 * ⚠️ ฐานข้อมูลจะปฏิเสธถ้ายังมีเช็คอินอ้างถึง (foreign key) — ตั้งใจให้เป็นแบบนั้น
 *    ของเดิมบน Firestore ลบได้เลยแล้วเช็คอินเก่ากลายเป็นอ้างถึงของที่ไม่มีอยู่
 */
export async function hardDeleteLocation(locationId: string): Promise<void> {
  const { error } = await sb().from('locations').delete().eq('id', locationId)

  if (error) {
    if (error.code === '23503') {
      throw new Error('ลบไม่ได้เพราะมีประวัติเช็คอินอ้างถึงอยู่ — ใช้ปิดใช้งานแทน')
    }
    throw new Error(`ลบสถานที่ไม่สำเร็จ: ${error.message}`)
  }
}

/* ------------------------------------------------------------------ */
export async function isLocationNameExists(
  name: string,
  excludeId?: string
): Promise<boolean> {
  let q = sb().from('locations').select('id').eq('name', name).limit(1)
  if (excludeId) q = q.neq('id', excludeId)

  const { data, error } = await q
  if (error) throw new Error(`ตรวจชื่อซ้ำไม่สำเร็จ: ${error.message}`)
  return !!data?.length
}
