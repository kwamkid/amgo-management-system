// lib/services/stockPhotoService.ts
//
// รูปสต็อก + หน้าร้านประจำวัน — PC บางคนต้องถ่ายทุกวัน (เจ้าของสั่ง 4 ก.ย. 69)
//
// ── กติกา ────────────────────────────────────────────────────────────
//   · ตั้งค่ารายคน (users.requires_stock_photos)
//   · ถ่ายตอนไหนก็ได้ระหว่างวัน ไม่ผูกกับเช็คอิน — ตอนเช็คอินอาจยังอยู่หน้าประตูห้าง
//   · แยกแค่ 2 อย่าง: หน้าร้าน / สต็อก · แต่ละอย่างกี่รูปก็ได้ (พื้นที่ใหญ่ หลายจุด)
//   · "ครบ" = วันนี้มีอย่างละอย่างน้อย 1 รูป · ไม่ครบ เช็คเอาท์ไม่ได้
//   · ลบได้เฉพาะรูปของตัวเองในวันนี้ (ถ่ายพลาด) — ย้อนหลังลบไม่ได้ เพราะเป็นหลักฐาน
//   · ระบบลบให้เองเมื่อเก่ากว่า 60 วัน (cron cleanup-photos) เท่ารูปเซลฟี่
//
// รูปบอกได้ว่า "เปลี่ยนเมื่อไหร่ ตรงไหน" ไม่ได้นับว่าหายกี่ชิ้น — เอาไว้ไล่ย้อน
// ตอนนับสต็อกแล้วขาด และคนรู้ว่ามีรูปทุกวันก็ไม่กล้าขยับ

import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { uploadImage, getImageUrls } from '@/lib/supabase/storage'

const sb = () => createClient()
const BUCKET = 'stock-photos' as const

// กติกา "ครบหรือยัง" อยู่ใน stockPhotoRules.ts (ไฟล์ล้วน เทสต์ยิงตรงได้)
export {
  stockPhotoStatus,
  missingLabel,
  KIND_LABEL,
  type StockPhotoKind,
  type StockPhotoStatus,
} from './stockPhotoRules.ts'
import type { StockPhotoKind } from './stockPhotoRules.ts'

export interface StockPhoto {
  id: string
  userId: string
  userName: string
  locationId: string | null
  locationName: string
  workDate: string
  kind: StockPhotoKind
  photoPath: string
  note: string
  takenAt: string
  /** signed URL — เติมให้ตอน list (หมดอายุ 7 วัน ห้ามเก็บ) */
  url?: string | null
}

interface Row {
  id: string
  user_id: string
  user_name: string | null
  location_id: string | null
  location_name: string | null
  work_date: string
  kind: string
  photo_path: string
  note: string | null
  taken_at: string
}

const toPhoto = (r: Row): StockPhoto => ({
  id: r.id,
  userId: r.user_id,
  userName: r.user_name ?? '',
  locationId: r.location_id,
  locationName: r.location_name ?? '',
  workDate: r.work_date,
  kind: r.kind as StockPhotoKind,
  photoPath: r.photo_path,
  note: r.note ?? '',
  takenAt: r.taken_at,
})

/** เติม signed URL ให้ทุกรูปทีเดียว */
async function withUrls(photos: StockPhoto[]): Promise<StockPhoto[]> {
  const urls = await getImageUrls(BUCKET, photos.map((p) => p.photoPath))
  return photos.map((p) => ({ ...p, url: urls.get(p.photoPath) ?? null }))
}

export const todayKey = () => format(new Date(), 'yyyy-MM-dd')

/* ------------------------------------------------------------------ */
export async function listMyPhotosToday(userId: string): Promise<StockPhoto[]> {
  const { data, error } = await sb()
    .from('stock_photos')
    .select('*')
    .eq('user_id', userId)
    .eq('work_date', todayKey())
    .order('taken_at')
  if (error) throw new Error(`ดึงรูปวันนี้ไม่สำเร็จ: ${error.message}`)
  return withUrls((data ?? []).map((r) => toPhoto(r as Row)))
}

/** ถ่าย → อัปโหลด → บันทึกแถว — สาขามาจากกะที่เช็คอินอยู่ */
export async function addStockPhoto(params: {
  userId: string
  userName: string
  locationId: string | null
  locationName: string
  kind: StockPhotoKind
  blob: Blob
  note?: string
}): Promise<StockPhoto> {
  const path = await uploadImage(BUCKET, params.userId, params.blob)

  const { data, error } = await sb()
    .from('stock_photos')
    .insert({
      user_id: params.userId,
      user_name: params.userName,
      location_id: params.locationId,
      location_name: params.locationName,
      work_date: todayKey(),
      kind: params.kind,
      photo_path: path,
      note: params.note?.trim() ?? '',
    })
    .select('*')
    .single()
  if (error) throw new Error(`บันทึกรูปไม่สำเร็จ: ${error.message}`)

  const [photo] = await withUrls([toPhoto(data as Row)])
  return photo
}

/** ลบรูปของตัวเองวันนี้ (ถ่ายพลาด) — RLS กันย้อนหลังให้แล้ว */
/**
 * ลบรูปที่ถ่ายพลาด — ลบแถวก่อน (RLS ยอมเฉพาะของตัวเองวันนี้) แล้วค่อยลบไฟล์
 * เดิมลบแค่แถว ไฟล์ค้างใน bucket ตลอดไป (cron ล้างตามแถว) · เจ้าของสั่ง 4 ก.ย. 69
 * "ให้มันลบไปเลย" · ลบไฟล์ไม่สำเร็จไม่ถือว่าล้ม — แถวหายแล้ว รูปไม่โผล่ที่ไหนอีก
 */
export async function deleteMyPhotoToday(id: string): Promise<void> {
  const { data, error } = await sb()
    .from('stock_photos')
    .delete()
    .eq('id', id)
    .select('photo_path')
    .maybeSingle()
  if (error) throw new Error(`ลบรูปไม่สำเร็จ: ${error.message}`)
  if (!data) throw new Error('ลบรูปไม่สำเร็จ: ลบได้เฉพาะรูปของตัวเองที่ถ่ายวันนี้')
  const { error: fileErr } = await sb().storage.from(BUCKET).remove([data.photo_path])
  if (fileErr) console.warn('[stock-photos] ลบไฟล์ไม่สำเร็จ (แถวลบแล้ว):', fileErr.message)
}

/* ------------------------------------------------------------------ *
 *  ฝั่ง HR — ไล่ดูรายสาขา รายวัน
 * ------------------------------------------------------------------ */
export async function listPhotos(params: {
  locationId?: string | null
  /** มุมมองรายคน — เจ้าของ/ผู้จัดการดูหน้าร้านของแต่ละคนตามช่วงเวลา */
  userId?: string | null
  from: Date
  to: Date
}): Promise<StockPhoto[]> {
  let q = sb()
    .from('stock_photos')
    .select('*')
    .gte('work_date', format(params.from, 'yyyy-MM-dd'))
    .lte('work_date', format(params.to, 'yyyy-MM-dd'))
    .order('work_date', { ascending: false })
    .order('taken_at')
  if (params.locationId) q = q.eq('location_id', params.locationId)
  if (params.userId) q = q.eq('user_id', params.userId)

  const { data, error } = await q
  if (error) throw new Error(`ดึงรูปไม่สำเร็จ: ${error.message}`)

  const photos = (data ?? []).map((r) => toPhoto(r as Row))
  // ชื่อ snapshot ตอนถ่าย ทับด้วย "ชื่อจริง (ชื่อเล่น)" ปัจจุบัน
  const { getDisplayNames } = await import('./user/queries')
  const names = await getDisplayNames(photos.map((p) => p.userId))
  return withUrls(photos.map((p) => ({ ...p, userName: names.get(p.userId) || p.userName })))
}

/** คนที่ถูกตั้งค่าให้ถ่าย + คนที่เคยถ่าย — ตัวเลือกในมุมมองรายคน */
export async function listPhotoPeople(): Promise<{ id: string; name: string }[]> {
  const client = sb()
  const [{ data: flagged }, { data: shot }] = await Promise.all([
    client.from('users').select('id, display_name').eq('requires_stock_photos', true).eq('is_active', true),
    client.from('stock_photos').select('user_id, user_name').order('taken_at', { ascending: false }).limit(2000),
  ])
  const byId = new Map<string, string>()
  for (const u of flagged ?? []) byId.set(u.id, u.display_name ?? '')
  for (const s of shot ?? []) if (!byId.has(s.user_id)) byId.set(s.user_id, s.user_name ?? '')

  const { getDisplayNames } = await import('./user/queries')
  const names = await getDisplayNames([...byId.keys()])
  return [...byId.entries()]
    .map(([id, snap]) => ({ id, name: names.get(id) || snap }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))
}

/** วันที่มีรูปในช่วง — ไว้ทำแถบเลือกวันให้กดข้ามวันว่างได้ */
export async function listPhotoDays(params: {
  locationId?: string | null
  userId?: string | null
  from: Date
  to: Date
}): Promise<{ workDate: string; storefront: number; stock: number }[]> {
  let q = sb()
    .from('stock_photos')
    .select('work_date, kind')
    .gte('work_date', format(params.from, 'yyyy-MM-dd'))
    .lte('work_date', format(params.to, 'yyyy-MM-dd'))
  if (params.locationId) q = q.eq('location_id', params.locationId)
  if (params.userId) q = q.eq('user_id', params.userId)
  const { data } = await q

  const byDay = new Map<string, { storefront: number; stock: number }>()
  for (const r of data ?? []) {
    const d = byDay.get(r.work_date) ?? { storefront: 0, stock: 0 }
    if (r.kind === 'storefront') d.storefront++
    else d.stock++
    byDay.set(r.work_date, d)
  }
  return [...byDay.entries()]
    .map(([workDate, c]) => ({ workDate, ...c }))
    .sort((a, b) => b.workDate.localeCompare(a.workDate))
}
