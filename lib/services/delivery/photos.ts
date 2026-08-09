'use client'

// lib/services/delivery/photos.ts
//
// บีบอัดและอัปโหลดรูปหลักฐานการส่งของ
//
// ส่วนบีบอัดเป็นโค้ดเบราว์เซอร์ล้วน ยกมาจากของเดิมทั้งดุ้น ไม่ได้แก้ตรรกะ
// ส่วนอัปโหลดเปลี่ยนไปใช้ Supabase Storage:
//   · เก็บ "path" ไม่ใช่ URL — ของเดิมเก็บ download URL ที่ใครมีลิงก์ก็เปิดได้ตลอดกาล
//   · โฟลเดอร์ชั้นแรกต้องเป็น user_id ไม่งั้น RLS ไม่ให้อัปโหลด

import { createClient } from '@/lib/supabase/client'
import { getImageUrls } from '@/lib/supabase/storage'
import {
  DELIVERY_PHOTO_CONFIG,
  type DeliveryPhoto,
  type CompressedPhotoResult,
} from '@/types/delivery'

const BUCKET = 'delivery-photos' as const

/* ------------------------------------------------------------------ *
 *  บีบอัด
 * ------------------------------------------------------------------ */
export const compressPhoto = async (
  input: string | Blob,
  options = DELIVERY_PHOTO_CONFIG.compressionOptions
): Promise<CompressedPhotoResult> => {
  return new Promise((resolve, reject) => {
    const img = new Image()

    const processImage = () => {
      let { width, height } = img
      const { maxWidth, maxHeight } = options

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
      } else if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height)
        height = maxHeight
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('สร้าง canvas ไม่สำเร็จ'))
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      const mime = `image/${options.format || 'jpeg'}`
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('บีบอัดรูปไม่สำเร็จ'))
            return
          }
          resolve({
            blob,
            dataUrl: canvas.toDataURL(mime, options.quality),
            width,
            height,
            originalSize: input instanceof Blob ? input.size : new Blob([input]).size,
            compressedSize: blob.size,
          })
        },
        mime,
        options.quality
      )
    }

    img.onload = processImage
    img.onerror = () => reject(new Error('อ่านรูปไม่สำเร็จ'))

    if (typeof input === 'string') {
      img.src = input
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(input)
    }
  })
}

export const createThumbnail = async (
  input: string | Blob
): Promise<CompressedPhotoResult> => compressPhoto(input, DELIVERY_PHOTO_CONFIG.thumbnailOptions)

/* ------------------------------------------------------------------ *
 *  อัปโหลด
 * ------------------------------------------------------------------ */
export const uploadDeliveryPhoto = async (
  photoData: string,
  driverId: string,
  deliveryId: string
): Promise<DeliveryPhoto> => {
  const client = createClient()

  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error('ยังไม่ได้เข้าสู่ระบบ')

  const [compressed, thumbnail] = await Promise.all([
    compressPhoto(photoData),
    createThumbnail(photoData),
  ])

  const photoId = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
  // RLS ตรวจโฟลเดอร์ชั้นแรกว่าเป็นของตัวเอง — ต้องเป็น user.id ไม่ใช่ driverId
  const base = `${user.id}/${deliveryId}/${photoId}`

  const [full, thumb] = await Promise.all([
    client.storage.from(BUCKET).upload(`${base}.jpg`, compressed.blob, {
      contentType: 'image/jpeg',
      upsert: false,
    }),
    client.storage.from(BUCKET).upload(`${base}_thumb.jpg`, thumbnail.blob, {
      contentType: 'image/jpeg',
      upsert: false,
    }),
  ])

  if (full.error) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${full.error.message}`)
  if (thumb.error) console.warn('อัปโหลดรูปย่อไม่สำเร็จ:', thumb.error.message)

  return {
    id: photoId,
    url: `${base}.jpg`, // เก็บ path — สร้างลิงก์ตอนแสดงผลด้วย getDeliveryPhotoUrls()
    thumbnailUrl: thumb.error ? undefined : `${base}_thumb.jpg`,
    originalSize: compressed.originalSize,
    compressedSize: compressed.compressedSize,
    width: compressed.width,
    height: compressed.height,
    uploadedAt: new Date(),
    capturedAt: new Date(),
  }
}

/** สร้างลิงก์เปิดดูรูปจาก path ที่เก็บไว้ (ลิงก์มีอายุจำกัด) */
export const getDeliveryPhotoUrls = (paths: (string | null | undefined)[]) =>
  getImageUrls(BUCKET, paths)

/** ลบรูปออกจากที่เก็บ — ข้ามลิงก์เก่าจาก Firebase ที่ลบไม่ได้แล้ว */
export const removeDeliveryPhotos = async (paths: (string | null | undefined)[]) => {
  const removable = paths.filter((p): p is string => !!p && !p.startsWith('http'))
  if (!removable.length) return 0

  const { error } = await createClient().storage.from(BUCKET).remove(removable)
  if (error) console.warn('ลบรูปไม่สำเร็จ:', error.message)
  return removable.length
}
