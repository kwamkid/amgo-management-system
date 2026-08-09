// lib/services/delivery/cleanup.ts
//
// ลบรูปและข้อมูลส่งของที่เก่าเกินกำหนด
//
// ── ต่างจากของเดิมตรงไหน ──────────────────────────────────────────────
// ของเดิมจดว่า "ล้างข้อมูลรอบล่าสุดเมื่อไหร่" ไว้ในเอกสาร config/deliveryCleanup
// แล้วให้เบราว์เซอร์คอยเช็คว่าถึงเวลาหรือยัง — แปลว่าถ้าไม่มีใครเปิดเว็บ
// ก็ไม่มีการล้างข้อมูลเลย และตัว updateCleanupTimestamp ของเดิมก็มีบั๊ก
// (ตอน document ยังไม่มี ไป addDoc สร้างเอกสารใหม่ที่ id สุ่ม ไม่ใช่ id เดิม
//  → เช็คครั้งหน้าก็ยังไม่เจอ วนแบบนั้นตลอด)
//
// ตอนนี้ย้ายมาไว้ที่ตาราง app_config แล้วให้ cron เป็นคนเรียก

import { createClient } from '@/lib/supabase/client'
import { DELIVERY_CLEANUP_CONFIG } from '@/types/delivery'
import { removeDeliveryPhotos } from './photos'

const sb = () => createClient()
const CLEANUP_KEY = 'delivery_cleanup_last_run'

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

/** ลบเฉพาะรูป เก็บข้อมูลจุดส่งไว้ */
export const cleanupOldPhotos = async (): Promise<number> => {
  const client = sb()
  const cutoff = daysAgo(DELIVERY_CLEANUP_CONFIG.photosRetentionDays)

  const { data, error } = await client
    .from('delivery_points')
    .select('id, photo_url, photo_thumbnail_url')
    .lt('check_in_time', cutoff.toISOString())
    .not('photo_url', 'is', null)

  if (error) throw new Error(`หารูปเก่าไม่สำเร็จ: ${error.message}`)
  if (!data?.length) {
    await markCleanupRun()
    return 0
  }

  await removeDeliveryPhotos(data.flatMap((r) => [r.photo_url, r.photo_thumbnail_url]))

  const { error: updErr } = await client
    .from('delivery_points')
    .update({
      photo_url: null,
      photo_thumbnail_url: null,
      photo_width: null,
      photo_height: null,
      photo_compressed_size: null,
    })
    .in('id', data.map((r) => r.id))

  if (updErr) throw new Error(`ล้างข้อมูลรูปไม่สำเร็จ: ${updErr.message}`)

  await markCleanupRun()
  return data.length
}

/** ลบจุดส่งที่เก่าเกิน 1 ปี */
export const cleanupOldDeliveryData = async (): Promise<number> => {
  const client = sb()
  const cutoff = daysAgo(DELIVERY_CLEANUP_CONFIG.dataRetentionDays)

  const { data, error } = await client
    .from('delivery_points')
    .delete()
    .lt('check_in_time', cutoff.toISOString())
    .select('id')

  if (error) throw new Error(`ลบข้อมูลเก่าไม่สำเร็จ: ${error.message}`)
  return data?.length ?? 0
}

async function markCleanupRun() {
  await sb()
    .from('app_config')
    .upsert({ key: CLEANUP_KEY, value: new Date().toISOString() }, { onConflict: 'key' })
}

export const shouldRunCleanup = async (): Promise<boolean> => {
  const { data } = await sb()
    .from('app_config')
    .select('value')
    .eq('key', CLEANUP_KEY)
    .maybeSingle()

  if (!data?.value) return true

  const days = Math.floor((Date.now() - new Date(data.value).getTime()) / 86_400_000)
  return days >= DELIVERY_CLEANUP_CONFIG.runCleanupEveryDays
}
