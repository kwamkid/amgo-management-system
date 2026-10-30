// lib/utils/bgDownload.ts
//
// ดาวน์โหลดไฟล์ที่ server ใช้เวลาสร้างนาน (เช่น PDF ฉลากทั้งตู้ ~5–10 วิ) แบบ "ทำงานเบื้องหลัง"
// โหลดใน JS ของหน้า (ไม่ใช่ลิงก์ธรรมดาที่ดูเหมือนค้าง) · มี toast บอกว่ากำลังทำ · เสร็จแล้วบันทึกไฟล์ให้เอง
// เปลี่ยนหน้าในแอปได้ระหว่างรอ (Next เปลี่ยนหน้าแบบไม่โหลดใหม่ งานยังวิ่งต่อ) — ปิดแท็บ/รีเฟรช = ยกเลิก
// งานชื่อเดียวกันกดซ้ำระหว่างรอ → ไม่เริ่มใหม่

import { toast } from 'react-hot-toast'

const running = new Set<string>()

/** fetch → save as `fileName`; JSON error bodies become the toast message */
export async function bgDownload(url: string, fileName: string, label = fileName): Promise<boolean> {
  if (running.has(url)) {
    toast(`${label} กำลังสร้างอยู่แล้ว`, { position: 'top-right' })
    return false
  }
  running.add(url)
  const id = toast.loading(`กำลังสร้างไฟล์ ${label}… ทำงานอื่นต่อได้ เสร็จแล้วจะบันทึกให้เอง`, { position: 'top-right' })
  try {
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
    }
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 60_000)
    toast.success(`บันทึก ${fileName} แล้ว`, { id, duration: 4000 })
    return true
  } catch (e) {
    toast.error(`สร้างไฟล์ไม่สำเร็จ: ${(e as Error).message}`, { id, duration: 6000 })
    return false
  } finally {
    running.delete(url)
  }
}
