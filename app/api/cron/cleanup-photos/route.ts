// app/api/cron/cleanup-photos/route.ts
//
// ลบรูปที่เก่าเกิน 60 วัน — รูปเช็คอิน · รูปหลักฐานส่งของ · รูปสต็อก/หน้าร้าน
// + ตาข่ายสำรองแบบกล้องวงจรปิด: พื้นที่ใกล้เต็มเมื่อไหร่ ลบรูปเก่าสุดก่อนไม่ว่าจะกี่วัน
//
// ทำไมต้องมี: ที่เก็บไฟล์เดิมบน Firebase โต 615.7 MB และโตไปเรื่อย ๆ
// เพราะไม่เคยลบรูปเก่าเลย  เจ้าของระบบสั่งไว้ว่า "ลบทุก ๆ 60 วันก็ได้ครับ
// ส่วนใหญ่เช็คไม่เกิน 1 เดือน" → คำนวณแล้วจะคงที่ประมาณ 148 MB
//
// ── กล้องวงจรปิด (เจ้าของขอ 7 ก.ย. 69) ─────────────────────────────────
// แพลน Free ของ Supabase มี 1 GB · ถ้ารูปโตเร็วกว่าที่กฎ 60 วันตามทัน (สาขาเพิ่ม
// คนถ่ายสต็อกเพิ่ม) ใช้เกิน 85% ของโควตาเมื่อไหร่ รอบนี้จะลบรูป "เก่าสุดทั้งระบบ"
// ก่อน (ดูวันเก่าสุดของทั้ง 3 ตาราง เลือกตารางที่เก่ากว่า) ทีละ 100 แถว จนเหลือ ≤ 75%
// กติกาตัวเลขอยู่ที่ lib/services/storageCapRules.ts (มีเทสต์) · โควตาอยู่ที่
// app_config.storage_quota_mb · ไม่แตะ bucket ที่ไม่ใช่ฟุตเทจ (โลโก้ avatar SRP สลิป)
//
// ── ขอบเขต ────────────────────────────────────────────────────────────
// ลบเฉพาะไฟล์ที่อยู่บน Supabase Storage เท่านั้น
//
// รูปเก่าที่ย้ายมาจาก Firebase เก็บเป็นลิงก์เต็ม (https://...) ตัวไฟล์จริง
// ยังอยู่บน Firebase ซึ่งเราไม่แตะตามที่ตกลงกันไว้ — ตัวนี้จึงข้ามไปเลย
// ไม่ล้างแม้แต่ลิงก์ เพราะไฟล์ยังเปิดดูได้อยู่ ลบลิงก์ทิ้งเปล่า ๆ ไม่ได้อะไร
// (ตอนเลิกใช้ Firebase ค่อยลบทั้ง bucket ทีเดียว)
//
// ── ทำไมต้องจำกัดจำนวนต่อรอบ ──────────────────────────────────────────
// cron-job.org รอผลลัพธ์ได้ 30 วินาที ถ้าเกินจะตัดการเชื่อมต่อ
// จึงทำทีละก้อนแล้วบอกว่าเหลืออีกเท่าไหร่ — รันซ้ำวันถัดไปก็ไล่เก็บต่อเอง

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { capPlan } from '@/lib/services/storageCapRules'
import { readQuotaMb, readStorageUsage } from '@/lib/services/storageUsageService'

export const maxDuration = 60

const RETENTION_DAYS = 60
// รูปสต็อก/หน้าร้านแยกค่าไว้ — เจ้าของสั่ง 4 ก.ย. 69 ให้ลบ "เหมือน selfie" (60 วัน)
// แต่ถ้าอยากไล่ดูของหายย้อนได้ไกลกว่านั้น แก้เลขนี้เลขเดียว
const STOCK_RETENTION_DAYS = 60
const DEFAULT_LIMIT = 300 // แถวต่อตารางต่อรอบ
const MAX_LIMIT = 2000
const REMOVE_BATCH = 100 // storage.remove() ต่อครั้ง
const CAP_BATCH = 100 // แถวต่อรอบตอนลบเพราะพื้นที่ใกล้เต็ม
const CAP_MAX_ROUNDS = 6 // รอบต่อการรันหนึ่งครั้ง — กัน timeout · คืนถัดไปไล่ต่อเอง

type Sb = ReturnType<typeof createAdminClient>
type CleanupResult = { rows: number; files: number; remaining: number }

function cutoff(days = RETENTION_DAYS) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

async function removeFiles(sb: Sb, bucket: string, paths: string[]) {
  let removed = 0
  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const { error } = await sb.storage.from(bucket).remove(paths.slice(i, i + REMOVE_BATCH))
    if (error) console.error(`ลบไฟล์ใน ${bucket} ไม่สำเร็จ:`, error.message)
    else removed += Math.min(REMOVE_BATCH, paths.length - i)
  }
  return removed
}

/* ── แต่ละตารางลบ "เก่าสุดก่อน" · before = ลบเฉพาะที่เก่ากว่าวันนี้ · ไม่ส่ง = ทุกใบ (โหมดพื้นที่เต็ม) ── */

async function cleanupCheckinPhotos(sb: Sb, limit: number, before?: string): Promise<CleanupResult> {
  // not like 'http%' = เอาเฉพาะรูปที่อยู่บน Supabase (ของ Firebase ข้าม)
  const base = () =>
    sb.from('checkins').select('id, checkin_photo_url', { count: 'exact' })
      .not('checkin_photo_url', 'is', null)
      .not('checkin_photo_url', 'like', 'http%')
  const scoped = (q: ReturnType<typeof base>) => (before ? q.lt('work_date', before) : q)

  const { count: remainingBefore } = await scoped(base()).limit(0)
  const { data, error } = await scoped(base()).order('work_date').limit(limit)
  if (error) throw new Error(`หารูปเช็คอินเก่าไม่สำเร็จ: ${error.message}`)
  if (!data?.length) return { rows: 0, files: 0, remaining: 0 }

  const files = await removeFiles(sb, 'checkin-photos', data.map((r) => r.checkin_photo_url!).filter(Boolean))

  // ล้างคอลัมน์ด้วย ไม่งั้นหน้าจอจะพยายามสร้างลิงก์รูปที่ไม่มีแล้ว
  const { error: updErr } = await sb
    .from('checkins')
    .update({ checkin_photo_url: null })
    .in('id', data.map((r) => r.id))
  if (updErr) throw new Error(`ล้างลิงก์รูปเช็คอินไม่สำเร็จ: ${updErr.message}`)

  return { rows: data.length, files, remaining: Math.max(0, (remainingBefore ?? 0) - data.length) }
}

async function cleanupDeliveryPhotos(sb: Sb, limit: number, before?: string): Promise<CleanupResult> {
  const base = () =>
    sb.from('delivery_points').select('id, photo_url, photo_thumbnail_url', { count: 'exact' })
      .not('photo_url', 'is', null)
      .not('photo_url', 'like', 'http%')
  const scoped = (q: ReturnType<typeof base>) => (before ? q.lt('check_in_time', before) : q)

  const { count: remainingBefore } = await scoped(base()).limit(0)
  const { data, error } = await scoped(base()).order('check_in_time').limit(limit)
  if (error) throw new Error(`หารูปส่งของเก่าไม่สำเร็จ: ${error.message}`)
  if (!data?.length) return { rows: 0, files: 0, remaining: 0 }

  const paths = data
    .flatMap((r) => [r.photo_url, r.photo_thumbnail_url])
    .filter((p): p is string => !!p && !p.startsWith('http'))
  const files = await removeFiles(sb, 'delivery-photos', paths)

  const { error: updErr } = await sb
    .from('delivery_points')
    .update({
      photo_url: null,
      photo_thumbnail_url: null,
      photo_width: null,
      photo_height: null,
      photo_compressed_size: null,
    })
    .in('id', data.map((r) => r.id))
  if (updErr) throw new Error(`ล้างลิงก์รูปส่งของไม่สำเร็จ: ${updErr.message}`)

  return { rows: data.length, files, remaining: Math.max(0, (remainingBefore ?? 0) - data.length) }
}

async function cleanupStockPhotos(sb: Sb, limit: number, before?: string): Promise<CleanupResult> {
  const base = () => sb.from('stock_photos').select('id, photo_path, thumb_path', { count: 'exact' })
  const scoped = (q: ReturnType<typeof base>) => (before ? q.lt('work_date', before) : q)

  const { count: remainingBefore } = await scoped(base()).limit(0)
  const { data, error } = await scoped(base()).order('work_date').order('taken_at').limit(limit)
  if (error) throw new Error(`หารูปสต็อกเก่าไม่สำเร็จ: ${error.message}`)
  if (!data?.length) return { rows: 0, files: 0, remaining: 0 }

  const files = await removeFiles(
    sb,
    'stock-photos',
    data.flatMap((r) => [r.photo_path, r.thumb_path]).filter((p): p is string => !!p)
  )

  // แถวนี้ไม่มีค่าอะไรถ้าไม่มีรูป — ลบทั้งแถว (เซลฟี่ล้างแค่คอลัมน์เพราะแถว checkin
  // ยังมีเวลาเข้า-ออก/ชั่วโมงที่ต้องเก็บ)
  const { error: delErr } = await sb.from('stock_photos').delete().in('id', data.map((r) => r.id))
  if (delErr) throw new Error(`ลบแถวรูปสต็อกไม่สำเร็จ: ${delErr.message}`)

  return { rows: data.length, files, remaining: Math.max(0, (remainingBefore ?? 0) - data.length) }
}

/* ── โหมดพื้นที่ใกล้เต็ม: หาว่าตารางไหนมีรูปเก่าสุด แล้วลบจากตารางนั้นทีละก้อน ── */

type Footage = 'checkin' | 'delivery' | 'stock'

async function oldestFootage(sb: Sb): Promise<{ table: Footage; date: string } | null> {
  const [c, d, s] = await Promise.all([
    sb.from('checkins').select('work_date').not('checkin_photo_url', 'is', null).not('checkin_photo_url', 'like', 'http%').order('work_date').limit(1).maybeSingle(),
    sb.from('delivery_points').select('check_in_time').not('photo_url', 'is', null).not('photo_url', 'like', 'http%').order('check_in_time').limit(1).maybeSingle(),
    sb.from('stock_photos').select('work_date').order('work_date').limit(1).maybeSingle(),
  ])
  const candidates: { table: Footage; date: string }[] = []
  if (c.data?.work_date) candidates.push({ table: 'checkin', date: String(c.data.work_date).slice(0, 10) })
  if (d.data?.check_in_time) candidates.push({ table: 'delivery', date: String(d.data.check_in_time).slice(0, 10) })
  if (s.data?.work_date) candidates.push({ table: 'stock', date: String(s.data.work_date).slice(0, 10) })
  if (!candidates.length) return null
  return candidates.sort((a, b) => a.date.localeCompare(b.date))[0]
}

async function enforceStorageCap(sb: Sb) {
  const quotaMb = await readQuotaMb(sb)
  const usage = await readStorageUsage(sb)
  const start = capPlan(usage.totalBytes, quotaMb)
  const deleted: Record<Footage, number> = { checkin: 0, delivery: 0, stock: 0 }
  let files = 0
  let rounds = 0
  let total = usage.totalBytes
  let oldestRemoved: string | null = null

  while (capPlan(total, quotaMb).over && rounds < CAP_MAX_ROUNDS) {
    const oldest = await oldestFootage(sb)
    if (!oldest) break // ไม่มีฟุตเทจให้ลบแล้ว — ที่เกินเป็นของ bucket อื่น ต้องอัปเกรดแพลน
    const r =
      oldest.table === 'checkin'
        ? await cleanupCheckinPhotos(sb, CAP_BATCH)
        : oldest.table === 'delivery'
        ? await cleanupDeliveryPhotos(sb, CAP_BATCH)
        : await cleanupStockPhotos(sb, CAP_BATCH)
    if (r.rows === 0) break
    deleted[oldest.table] += r.rows
    files += r.files
    oldestRemoved = oldest.date
    rounds++
    total = (await readStorageUsage(sb)).totalBytes
  }

  return {
    quotaMb,
    pctBefore: Math.round(start.pct * 1000) / 10,
    pctAfter: Math.round(capPlan(total, quotaMb).pct * 1000) / 10,
    triggered: start.over,
    rounds,
    deleted,
    files,
    oldestRemoved,
    stillOver: capPlan(total, quotaMb).over,
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = Math.min(MAX_LIMIT, Number(request.nextUrl.searchParams.get('limit')) || DEFAULT_LIMIT)
  const sb = createAdminClient()

  try {
    const checkin = await cleanupCheckinPhotos(sb, limit, cutoff().toISOString().slice(0, 10))
    const delivery = await cleanupDeliveryPhotos(sb, limit, cutoff().toISOString())
    const stock = await cleanupStockPhotos(sb, limit, cutoff(STOCK_RETENTION_DAYS).toISOString().slice(0, 10))
    const cap = await enforceStorageCap(sb)

    const note =
      `ลบรูปเช็คอิน ${checkin.files} · รูปส่งของ ${delivery.files} · รูปสต็อก ${stock.files} ` +
      `· เหลือ ${checkin.remaining + delivery.remaining + stock.remaining}` +
      ` · พื้นที่ ${cap.pctAfter}% ของ ${cap.quotaMb} MB` +
      (cap.triggered ? ` · ใกล้เต็ม ลบเก่าสุดเพิ่ม ${cap.files} ไฟล์ (ถึง ${cap.oldestRemoved})` : '')

    await sb.from('app_config').upsert(
      { key: 'photo_cleanup_last_run', value: new Date().toISOString(), note },
      { onConflict: 'key' }
    )

    return NextResponse.json({
      success: true,
      retentionDays: RETENTION_DAYS,
      limit,
      checkin,
      delivery,
      stock,
      cap,
      // ยังเหลือ = รันรอบหน้าจะไล่เก็บต่อ ไม่ต้องทำอะไร
      done: checkin.remaining === 0 && delivery.remaining === 0 && stock.remaining === 0 && !cap.stillOver,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[ลบรูปเก่า] ล้มเหลว:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ไม่ทราบสาเหตุ' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
