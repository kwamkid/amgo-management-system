// lib/services/delivery/points.ts
//
// จุดส่งของ
//
// ── ต่างจากของเดิมตรงไหน ──────────────────────────────────────────────
// สรุปเส้นทางรายวัน (จำนวนจุด/สำเร็จ/ไม่สำเร็จ) ไม่ต้องเขียนเองแล้ว
// trigger delivery_points_recalc_route คิดจากจุดส่งจริงให้ทุกครั้ง
//
// ของเดิมบวก totalPoints เองแบบอ่าน-บวก-เขียน ผลคือตัวเลขเพี้ยน:
// เจอเส้นทางค้าง 121 เส้นอ้างว่ามีจุดส่ง 966 จุดที่ไม่มีอยู่จริง
// (ของจริง 3,479 จุด แต่ผลรวมบอก 4,445) — ล้างไปแล้วตอน migrate

import { createClient } from '@/lib/supabase/client'
import type {
  DeliveryPoint,
  DeliveryRoute,
  CreateDeliveryPointData,
  UpdateDeliveryPointData,
  DeliveryFilters,
  DeliveryPhoto,
} from '@/types/delivery'
import type { Database } from '@/types/database'
import { uploadDeliveryPhoto, removeDeliveryPhotos, getDeliveryPhotoUrls } from './photos'

type PointRow = Database['public']['Tables']['delivery_points']['Row']
type RouteRow = Database['public']['Tables']['delivery_routes']['Row']

const sb = () => createClient()

// photoUrls: path → signed URL — ฐานข้อมูลเก็บ path ใน storage ไม่ใช่ลิงก์
// ถ้าสร้างลิงก์ไม่ได้ (ไฟล์หาย/หมดสิทธิ์) ถือว่าไม่มีรูป ดีกว่าส่ง path ไปให้ <img> แตก
function toPoint(r: PointRow, photoUrls: Map<string, string>): DeliveryPoint {
  const url = r.photo_url ? photoUrls.get(r.photo_url) : undefined
  const photo: DeliveryPhoto | undefined = url
    ? {
        id: r.id,
        url,
        thumbnailUrl: (r.photo_thumbnail_url && photoUrls.get(r.photo_thumbnail_url)) || undefined,
        originalSize: r.photo_original_size ?? 0,
        compressedSize: r.photo_compressed_size ?? undefined,
        width: r.photo_width ?? undefined,
        height: r.photo_height ?? undefined,
        uploadedAt: r.photo_uploaded_at ? new Date(r.photo_uploaded_at) : new Date(),
        capturedAt: r.photo_captured_at ? new Date(r.photo_captured_at) : new Date(),
      }
    : undefined

  return {
    id: r.id,
    driverId: r.driver_id,
    driverName: r.driver_name,
    checkInTime: r.check_in_time ? new Date(r.check_in_time) : new Date(),
    lat: Number(r.lat),
    lng: Number(r.lng),
    address: r.address ?? undefined,
    customerName: r.customer_name ?? undefined,
    customerPhone: r.customer_phone ?? undefined,
    orderNumber: r.order_number ?? undefined,
    deliveryType: r.delivery_type as DeliveryPoint['deliveryType'],
    deliveryStatus: r.delivery_status as DeliveryPoint['deliveryStatus'],
    failureReason: r.failure_reason ?? undefined,
    customerSignature: r.customer_signature ?? undefined,
    photo,
    photoUrl: url,
    note: r.note ?? undefined,
    createdAt: r.created_at ? new Date(r.created_at) : undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at) : undefined,
  }
}

function toRoute(r: RouteRow): DeliveryRoute {
  return {
    id: r.id,
    driverId: r.driver_id,
    driverName: r.driver_name,
    date: r.route_date,
    totalPoints: r.total_points,
    completedPoints: r.completed_points,
    failedPoints: r.failed_points,
    totalDistance: r.total_distance ? Number(r.total_distance) : undefined,
    totalDuration: r.total_duration ?? undefined,
    startTime: r.start_time ? new Date(r.start_time) : undefined,
    endTime: r.end_time ? new Date(r.end_time) : undefined,
    status: r.status as DeliveryRoute['status'],
    createdAt: r.created_at ? new Date(r.created_at) : undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at) : undefined,
  }
}

/* ------------------------------------------------------------------ */
export const createDeliveryPoint = async (
  data: CreateDeliveryPointData,
  driverId: string,
  driverName: string
): Promise<string> => {
  const client = sb()

  // แปลงพิกัดเป็นที่อยู่ — ล้มเหลวก็ยังบันทึกจุดส่งได้ แค่ไม่มีที่อยู่
  let address = ''
  try {
    const { getAddressFromCoords } = await import('@/lib/utils/location')
    address = (await getAddressFromCoords(data.lat, data.lng)) ?? ''
  } catch (error) {
    console.error('แปลงพิกัดเป็นที่อยู่ไม่สำเร็จ:', error)
  }

  const { data: row, error } = await client
    .from('delivery_points')
    .insert({
      driver_id: driverId,
      driver_name: driverName,
      check_in_time: new Date().toISOString(),
      lat: data.lat,
      lng: data.lng,
      address: address ?? '',
      customer_name: data.customerName ?? null,
      customer_phone: data.customerPhone ?? null,
      order_number: data.orderNumber ?? null,
      delivery_type: data.deliveryType,
      delivery_status: 'pending',
      note: data.note ?? '',
    })
    .select('id')
    .single()

  if (error) throw new Error(`บันทึกจุดส่งไม่สำเร็จ: ${error.message}`)

  if (data.photoCaptureData) {
    try {
      const photo = await uploadDeliveryPhoto(data.photoCaptureData, driverId, row.id)
      await client
        .from('delivery_points')
        .update({
          photo_url: photo.url,
          photo_thumbnail_url: photo.thumbnailUrl ?? null,
          photo_width: photo.width ?? null,
          photo_height: photo.height ?? null,
          photo_original_size: photo.originalSize,
          photo_compressed_size: photo.compressedSize ?? null,
          photo_captured_at: photo.capturedAt.toISOString(),
          photo_uploaded_at: photo.uploadedAt.toISOString(),
        })
        .eq('id', row.id)
    } catch (error) {
      // จุดส่งบันทึกไปแล้ว รูปพลาดไม่ควรทำให้ทั้งหมดล้ม
      console.error('อัปโหลดรูปหลักฐานไม่สำเร็จ:', error)
    }
  }

  return row.id
}

/* ------------------------------------------------------------------ */
export const updateDeliveryPoint = async (
  deliveryId: string,
  data: UpdateDeliveryPointData
): Promise<void> => {
  const patch: Database['public']['Tables']['delivery_points']['Update'] = {}

  if (data.deliveryStatus !== undefined) patch.delivery_status = data.deliveryStatus
  if (data.failureReason !== undefined) patch.failure_reason = data.failureReason
  if (data.customerSignature !== undefined) patch.customer_signature = data.customerSignature
  if (data.note !== undefined) patch.note = data.note

  if (!Object.keys(patch).length) return

  const { error } = await sb().from('delivery_points').update(patch).eq('id', deliveryId)
  if (error) throw new Error(`อัปเดตจุดส่งไม่สำเร็จ: ${error.message}`)
}

/* ------------------------------------------------------------------ *
 *  รายการจุดส่ง
 *
 *  ของเดิมส่ง document snapshot ไปมาเพื่อแบ่งหน้า — ตีความ lastDoc
 *  เป็นตัวเลข offset แทน ผู้เรียกไม่ต้องแก้
 * ------------------------------------------------------------------ */
export const getDeliveryPoints = async (
  filters: DeliveryFilters,
  pageSize = 20,
  lastDoc?: number
): Promise<{ points: DeliveryPoint[]; lastDoc: number; hasMore: boolean }> => {
  const offset = typeof lastDoc === 'number' ? lastDoc : 0

  let q = sb()
    .from('delivery_points')
    .select('*')
    .order('check_in_time', { ascending: false })
    .range(offset, offset + pageSize)

  if (filters.driverId) q = q.eq('driver_id', filters.driverId)
  if (filters.deliveryType) q = q.eq('delivery_type', filters.deliveryType)
  if (filters.deliveryStatus) q = q.eq('delivery_status', filters.deliveryStatus)

  if (filters.date) {
    // filters.date เป็น YYYY-MM-DD ตามเวลาไทย — แปลงเป็นช่วงเวลาจริงก่อนเทียบ
    const start = new Date(`${filters.date}T00:00:00+07:00`)
    const end = new Date(`${filters.date}T23:59:59.999+07:00`)
    q = q.gte('check_in_time', start.toISOString()).lte('check_in_time', end.toISOString())
  }

  const { data, error } = await q
  if (error) throw new Error(`ดึงรายการจุดส่งไม่สำเร็จ: ${error.message}`)

  const rows = ((data ?? []) as PointRow[]).slice(0, pageSize)
  const [photoUrls, driverNames] = await Promise.all([
    getDeliveryPhotoUrls(rows.flatMap((r) => [r.photo_url, r.photo_thumbnail_url])),
    // driver_name เป็น snapshot ชื่อจริงตอนเช็คอิน — ทับด้วย "ชื่อจริง (ชื่อเล่น)" ปัจจุบัน
    import('../user/queries').then(({ getDisplayNames }) =>
      getDisplayNames(rows.map((r) => r.driver_id))
    ),
  ])
  return {
    points: rows.map((r) => {
      const p = toPoint(r, photoUrls)
      p.driverName = driverNames.get(p.driverId) || p.driverName
      return p
    }),
    lastDoc: offset + pageSize,
    hasMore: (data ?? []).length > pageSize,
  }
}

export const getDeliveryPoint = async (deliveryId: string): Promise<DeliveryPoint | null> => {
  const { data, error } = await sb()
    .from('delivery_points')
    .select('*')
    .eq('id', deliveryId)
    .maybeSingle()

  if (error) throw new Error(`ดึงข้อมูลจุดส่งไม่สำเร็จ: ${error.message}`)
  if (!data) return null

  const row = data as PointRow
  const photoUrls = await getDeliveryPhotoUrls([row.photo_url, row.photo_thumbnail_url])
  return toPoint(row, photoUrls)
}

/* ------------------------------------------------------------------ *
 *  เส้นทางรายวัน — ฐานข้อมูลสรุปให้แล้ว แค่อ่าน
 * ------------------------------------------------------------------ */
export const getDeliveryRoutes = async (filters?: {
  driverId?: string
  from?: Date
  to?: Date
}): Promise<DeliveryRoute[]> => {
  let q = sb().from('delivery_routes').select('*').order('route_date', { ascending: false })

  if (filters?.driverId) q = q.eq('driver_id', filters.driverId)
  if (filters?.from) q = q.gte('route_date', filters.from.toISOString().slice(0, 10))
  if (filters?.to) q = q.lte('route_date', filters.to.toISOString().slice(0, 10))

  const { data, error } = await q
  if (error) throw new Error(`ดึงเส้นทางไม่สำเร็จ: ${error.message}`)
  return ((data ?? []) as RouteRow[]).map(toRoute)
}

/* ------------------------------------------------------------------ */
export const deleteDeliveryPoint = async (deliveryId: string): Promise<void> => {
  const client = sb()

  const { data: row } = await client
    .from('delivery_points')
    .select('photo_url, photo_thumbnail_url')
    .eq('id', deliveryId)
    .maybeSingle()

  if (!row) throw new Error('ไม่พบจุดส่งนี้')

  await removeDeliveryPhotos([row.photo_url, row.photo_thumbnail_url])

  const { error } = await client.from('delivery_points').delete().eq('id', deliveryId)
  if (error) throw new Error(`ลบจุดส่งไม่สำเร็จ: ${error.message}`)
}

/* ------------------------------------------------------------------ *
 *  สรุปงานส่งรายเดือน — วันไหนใครส่งกี่เจ้า (หน้ารายงานการส่งของ)
 *  นับจากจุดที่เช็คอินแล้วจริง · ตัดวันตามเวลาไทย
 *  เปิดให้ทั้งคนขับและ Call Center ดู — RLS ฝั่งตารางเปิดอ่านตาม role อยู่แล้ว
 * ------------------------------------------------------------------ */
export const getDeliveryMonthlySummary = async (
  month: Date
): Promise<{
  drivers: { id: string; name: string }[]
  /** `${YYYY-MM-DD}|${driverId}` → จำนวนจุดส่งที่เช็คอินแล้ว */
  counts: Map<string, number>
}> => {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = month.getFullYear()
  const m = month.getMonth()
  const next = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }
  const startIso = new Date(`${y}-${pad(m + 1)}-01T00:00:00+07:00`).toISOString()
  const endIso = new Date(`${next.y}-${pad(next.m + 1)}-01T00:00:00+07:00`).toISOString()

  // PostgREST ตัดผลที่ 1,000 แถวเงียบ ๆ — ไล่เก็บเป็นช่วงจนหมด
  type Row = { driver_id: string; driver_name: string; check_in_time: string }
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb()
      .from('delivery_points')
      .select('driver_id, driver_name, check_in_time')
      .gte('check_in_time', startIso)
      .lt('check_in_time', endIso)
      .order('check_in_time')
      .range(from, from + 999)
    if (error) throw new Error(`ดึงสรุปงานส่งไม่สำเร็จ: ${error.message}`)
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < 1000) break
  }

  // driver_name เป็น snapshot — ทับด้วย "ชื่อจริง (ชื่อเล่น)" ปัจจุบันตามกติกาแสดงชื่อ
  const { getDisplayNames } = await import('../user/queries')
  const names = await getDisplayNames([...new Set(rows.map((r) => r.driver_id))])

  const driverMap = new Map<string, string>()
  const counts = new Map<string, number>()
  for (const r of rows) {
    driverMap.set(r.driver_id, names.get(r.driver_id) || r.driver_name)
    const day = new Date(new Date(r.check_in_time).getTime() + 7 * 3_600_000)
      .toISOString()
      .slice(0, 10)
    const k = `${day}|${r.driver_id}`
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  return {
    drivers: [...driverMap]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th')),
    counts,
  }
}
