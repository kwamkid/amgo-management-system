'use client'

import { format } from 'date-fns'
import { createClient } from './client'

/**
 * อัปโหลดไฟล์ขึ้น Supabase Storage
 *
 * โครงพาธบังคับเป็น {user_id}/... เพราะ RLS ของ storage ตรวจจาก
 * โฟลเดอร์ชั้นแรก — ถ้าไม่ขึ้นต้นด้วย user_id ของตัวเอง จะอัปโหลดไม่ผ่าน
 *
 * bucket เป็นแบบไม่เปิดสาธารณะ จึงคืน signed URL ที่มีอายุจำกัด
 * (ของเดิมบน Firebase คืน download URL ที่ใครมีลิงก์ก็เปิดได้ตลอดกาล)
 */

export type Bucket = 'checkin-photos' | 'avatars' | 'delivery-photos' | 'leave-attachments'

/** อายุลิงก์รูป — ยาวพอให้เปิดดูย้อนหลังในหน้าประวัติ แต่ไม่ตลอดกาล */
const SIGNED_URL_TTL = 60 * 60 * 24 * 7 // 7 วัน

export async function uploadImage(
  bucket: Bucket,
  userId: string,
  blob: Blob,
  opts: { ext?: string; contentType?: string } = {}
): Promise<string> {
  const sb = createClient()
  const ext = opts.ext ?? 'jpg'
  const path = `${userId}/${format(new Date(), 'yyyy-MM-dd')}/${Date.now()}.${ext}`

  const { error } = await sb.storage.from(bucket).upload(path, blob, {
    contentType: opts.contentType ?? 'image/jpeg',
    upsert: false,
  })
  if (error) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${error.message}`)

  // เก็บ path ไว้ในฐานข้อมูล ไม่ใช่ URL — เพราะ signed URL หมดอายุ
  // เวลาจะแสดงผลค่อยเรียก getImageUrl() สร้างลิงก์ใหม่
  return path
}

/** สร้างลิงก์ดูรูปจาก path ที่เก็บไว้ */
export async function getImageUrl(bucket: Bucket, path: string): Promise<string | null> {
  if (!path) return null
  // ข้อมูลเก่าที่ย้ายมาจาก Firebase เก็บเป็น URL เต็ม — ใช้ได้เลย
  if (path.startsWith('http')) return path

  const sb = createClient()
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL)
  if (error) {
    console.warn(`สร้างลิงก์รูปไม่สำเร็จ (${path}):`, error.message)
    return null
  }
  return data.signedUrl
}

/** สร้างลิงก์หลายรูปพร้อมกัน — ใช้ในหน้าที่โชว์รูปเป็นตาราง */
export async function getImageUrls(
  bucket: Bucket,
  paths: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const sb = createClient()
  const out = new Map<string, string>()

  const needSigning = paths.filter((p): p is string => !!p && !p.startsWith('http'))
  for (const p of paths) {
    if (p?.startsWith('http')) out.set(p, p)
  }
  if (!needSigning.length) return out

  const { data } = await sb.storage.from(bucket).createSignedUrls(needSigning, SIGNED_URL_TTL)
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) out.set(item.path, item.signedUrl)
  }
  return out
}
