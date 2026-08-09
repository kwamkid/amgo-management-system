// app/api/cron/cleanup-photos/route.ts
//
// ลบรูปที่เก่าเกิน 60 วัน — รูปเช็คอินและรูปหลักฐานส่งของ
//
// ทำไมต้องมี: ที่เก็บไฟล์เดิมบน Firebase โต 615.7 MB และโตไปเรื่อย ๆ
// เพราะไม่เคยลบรูปเก่าเลย  เจ้าของระบบสั่งไว้ว่า "ลบทุก ๆ 60 วันก็ได้ครับ
// ส่วนใหญ่เช็คไม่เกิน 1 เดือน" → คำนวณแล้วจะคงที่ประมาณ 148 MB
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

export const maxDuration = 60

const RETENTION_DAYS = 60
const DEFAULT_LIMIT = 300 // แถวต่อตารางต่อรอบ
const MAX_LIMIT = 2000
const REMOVE_BATCH = 100 // storage.remove() ต่อครั้ง

type Sb = ReturnType<typeof createAdminClient>

function cutoff() {
  const d = new Date()
  d.setDate(d.getDate() - RETENTION_DAYS)
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

async function cleanupCheckinPhotos(sb: Sb, limit: number) {
  const before = cutoff().toISOString().slice(0, 10)

  // not like 'http%' = เอาเฉพาะรูปที่อยู่บน Supabase (ของ Firebase ข้าม)
  const { count: remainingBefore } = await sb
    .from('checkins')
    .select('id', { count: 'exact', head: true })
    .lt('work_date', before)
    .not('checkin_photo_url', 'is', null)
    .not('checkin_photo_url', 'like', 'http%')

  const { data, error } = await sb
    .from('checkins')
    .select('id, checkin_photo_url')
    .lt('work_date', before)
    .not('checkin_photo_url', 'is', null)
    .not('checkin_photo_url', 'like', 'http%')
    .limit(limit)
  if (error) throw new Error(`หารูปเช็คอินเก่าไม่สำเร็จ: ${error.message}`)
  if (!data?.length) return { rows: 0, files: 0, remaining: 0 }

  const files = await removeFiles(
    sb,
    'checkin-photos',
    data.map((r) => r.checkin_photo_url!).filter(Boolean)
  )

  // ล้างคอลัมน์ด้วย ไม่งั้นหน้าจอจะพยายามสร้างลิงก์รูปที่ไม่มีแล้ว
  const { error: updErr } = await sb
    .from('checkins')
    .update({ checkin_photo_url: null })
    .in('id', data.map((r) => r.id))

  if (updErr) throw new Error(`ล้างลิงก์รูปเช็คอินไม่สำเร็จ: ${updErr.message}`)

  return {
    rows: data.length,
    files,
    remaining: Math.max(0, (remainingBefore ?? 0) - data.length),
  }
}

async function cleanupDeliveryPhotos(sb: Sb, limit: number) {
  const before = cutoff().toISOString()

  const { count: remainingBefore } = await sb
    .from('delivery_points')
    .select('id', { count: 'exact', head: true })
    .lt('check_in_time', before)
    .not('photo_url', 'is', null)
    .not('photo_url', 'like', 'http%')

  const { data, error } = await sb
    .from('delivery_points')
    .select('id, photo_url, photo_thumbnail_url')
    .lt('check_in_time', before)
    .not('photo_url', 'is', null)
    .not('photo_url', 'like', 'http%')
    .limit(limit)

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

  return {
    rows: data.length,
    files,
    remaining: Math.max(0, (remainingBefore ?? 0) - data.length),
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = Math.min(
    MAX_LIMIT,
    Number(request.nextUrl.searchParams.get('limit')) || DEFAULT_LIMIT
  )

  const sb = createAdminClient()

  try {
    const checkin = await cleanupCheckinPhotos(sb, limit)
    const delivery = await cleanupDeliveryPhotos(sb, limit)

    const note =
      `ลบรูปเช็คอิน ${checkin.files} · รูปส่งของ ${delivery.files} ` +
      `· เหลือ ${checkin.remaining + delivery.remaining}`

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
      // ยังเหลือ = รันรอบหน้าจะไล่เก็บต่อ ไม่ต้องทำอะไร
      done: checkin.remaining === 0 && delivery.remaining === 0,
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
