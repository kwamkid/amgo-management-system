// lib/utils/bgDownload.ts
//
// ดาวน์โหลดไฟล์ที่ server ใช้เวลาสร้างนาน (เช่น PDF ฉลากทั้งตู้ ~5–10 วิ) แบบ "ทำงานเบื้องหลัง"
// โหลดใน JS ของหน้า (ไม่ใช่ลิงก์ธรรมดาที่ดูเหมือนค้าง) · มี toast บอกว่ากำลังทำ · เสร็จแล้วบันทึกไฟล์ให้เอง
// เปลี่ยนหน้าในแอปได้ระหว่างรอ (Next เปลี่ยนหน้าแบบไม่โหลดใหม่ งานยังวิ่งต่อ) — ปิดแท็บ/รีเฟรช = ยกเลิก
// งานชื่อเดียวกันกดซ้ำระหว่างรอ → ไม่เริ่มใหม่

import { toast } from 'react-hot-toast'

const running = new Set<string>()

export interface BgDownloadText {
  already: (label: string) => string
  working: (label: string) => string
  done: (file: string) => string
  fail: (msg: string) => string
}

const TH: BgDownloadText = {
  already: (l) => `${l} กำลังสร้างอยู่แล้ว`,
  working: (l) => `กำลังสร้างไฟล์ ${l}… ทำงานอื่นต่อได้ เสร็จแล้วจะบันทึกให้เอง`,
  done: (f) => `บันทึก ${f} แล้ว`,
  fail: (m) => `สร้างไฟล์ไม่สำเร็จ: ${m}`,
}

/** fetch → save as `fileName`; JSON error bodies become the toast message · `text` for pages not in Thai */
export async function bgDownload(url: string, fileName: string, label = fileName, text: BgDownloadText = TH): Promise<boolean> {
  if (running.has(url)) {
    toast(text.already(label), { position: 'top-right' })
    return false
  }
  running.add(url)
  const id = toast.loading(text.working(label), { position: 'top-right' })
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
    toast.success(text.done(fileName), { id, duration: 4000 })
    return true
  } catch (e) {
    toast.error(text.fail((e as Error).message), { id, duration: 6000 })
    return false
  } finally {
    running.delete(url)
  }
}
