'use client'

// lib/services/leave/attachments.ts
//
// ไฟล์แนบใบลา (ใบรับรองแพทย์ ฯลฯ)
//
// ⚠️ ของเดิมมีบั๊ก: อัปโหลดไฟล์ขึ้น Firebase Storage สำเร็จ แต่ไม่เคยเก็บ URL
//    ลงใบลาเลย (useLeave.ts มีคอมเมนต์ค้างไว้ว่า "You'll need to add an
//    updateLeaveRequest function") → ไฟล์ที่พนักงานแนบมาหายทุกใบ
//    รอบนี้เพิ่ม attachTo() แล้วเรียกต่อจาก upload ทันที

import { createClient } from '@/lib/supabase/client'
import { getImageUrls } from '@/lib/supabase/storage'

const BUCKET = 'leave-attachments' as const

/** รูปจากมือถือใหญ่เกินจำเป็น ย่อก่อนอัปโหลด — PDF/ไฟล์อื่นปล่อยผ่าน */
async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.size < 500_000) return file

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const maxSize = 1200
        let { width, height } = img

        if (width > height && width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        } else if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.8)
      }
      img.onerror = () => resolve(file)
      img.src = e.target?.result as string
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}

/**
 * อัปโหลดไฟล์แนบ — คืน path ไม่ใช่ URL
 *
 * โครงพาธต้องขึ้นต้นด้วย user_id เพราะ RLS ของ storage ตรวจโฟลเดอร์ชั้นแรก
 * (ดู policy "ใบลา: แนบไฟล์ของตัวเอง")
 */
export async function uploadLeaveAttachment(leaveId: string, file: File): Promise<string> {
  const client = createClient()

  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error('ยังไม่ได้เข้าสู่ระบบ')

  const body = await compressImage(file)
  const isImage = file.type.startsWith('image/')
  const ext = isImage ? 'jpg' : (file.name.split('.').pop() ?? 'bin')
  const path = `${user.id}/${leaveId}/${Date.now()}.${ext}`

  const { error } = await client.storage.from(BUCKET).upload(path, body, {
    contentType: isImage ? 'image/jpeg' : file.type,
    upsert: false,
  })
  if (error) throw new Error(`แนบไฟล์ไม่สำเร็จ: ${error.message}`)

  return path
}

/** ผูก path ที่อัปโหลดแล้วเข้ากับใบลา — ขั้นที่ของเดิมลืมทำ */
export async function attachToLeaveRequest(leaveId: string, paths: string[]): Promise<void> {
  if (!paths.length) return

  const client = createClient()

  const { data: current } = await client
    .from('leave_requests')
    .select('attachments')
    .eq('id', leaveId)
    .single()

  const { error } = await client
    .from('leave_requests')
    .update({ attachments: [...(current?.attachments ?? []), ...paths] })
    .eq('id', leaveId)

  if (error) throw new Error(`บันทึกไฟล์แนบไม่สำเร็จ: ${error.message}`)
}

/** อัปโหลดหลายไฟล์แล้วผูกกับใบลาในทีเดียว */
export async function uploadLeaveAttachments(
  leaveId: string,
  files: File[]
): Promise<string[]> {
  if (!files.length) return []

  const paths = await Promise.all(files.map((f) => uploadLeaveAttachment(leaveId, f)))
  await attachToLeaveRequest(leaveId, paths)
  return paths
}

/** สร้างลิงก์เปิดดูไฟล์แนบ (bucket ไม่เปิดสาธารณะ ลิงก์มีอายุ) */
export async function getLeaveAttachmentUrls(
  paths: (string | null | undefined)[]
): Promise<Map<string, string>> {
  return getImageUrls(BUCKET, paths)
}

/**
 * ลบไฟล์แนบที่เก่าเกิน 5 เดือน (HR เท่านั้น)
 *
 * ใบรับรองแพทย์เป็นข้อมูลสุขภาพ ไม่ควรเก็บไว้นานเกินจำเป็น
 */
export async function cleanupOldAttachments(): Promise<{ leaves: number; files: number }> {
  const client = createClient()

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 5)

  const { data, error } = await client
    .from('leave_requests')
    .select('id, attachments')
    .lt('created_at', cutoff.toISOString())
    .not('attachments', 'eq', '{}')

  if (error) throw new Error(`หาไฟล์แนบเก่าไม่สำเร็จ: ${error.message}`)

  const rows = (data ?? []).filter((r) => (r.attachments?.length ?? 0) > 0)
  if (!rows.length) return { leaves: 0, files: 0 }

  const paths = rows.flatMap((r) => r.attachments ?? []).filter((p) => !p.startsWith('http'))
  if (paths.length) await client.storage.from(BUCKET).remove(paths)

  for (const r of rows) {
    await client.from('leave_requests').update({ attachments: [] }).eq('id', r.id)
  }

  return { leaves: rows.length, files: paths.length }
}
