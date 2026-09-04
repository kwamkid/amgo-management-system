// lib/push/notify.ts
//
// ฝั่งเบราว์เซอร์: บอก server ว่า "เกิดเหตุการณ์นี้ ยิง push ให้ที" — ยิงแล้วไม่รอ
// เพราะแจ้งเตือนพลาดไม่ควรทำให้ใบลา/ใบสลับที่บันทึกไปแล้วดูเหมือนล้ม
//
// ข้อความและผู้รับตัดสินที่ server (lib/push/events.ts) — เบราว์เซอร์ส่งแค่ข้อเท็จจริง
// ชื่อคนทำเรื่อง server อ่านจากบัญชีที่ล็อกอินเอง จึงไม่มีช่องให้ปลอมชื่อ
import type { PushEventInput } from './events'

export type PushNotifyInput = Omit<PushEventInput, 'actorName'>

export function pushNotify(input: PushNotifyInput): void {
  if (typeof window === 'undefined') return
  fetch('/api/push/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    keepalive: true, // ผู้ใช้ปิดหน้าทันทีหลังกดส่ง คำขอยังไปถึง
  }).catch(() => {})
}

/** Date → 'yyyy-mm-dd' ตามเวลาเครื่อง (ไม่ใช้ toISOString — เที่ยงคืนไทยจะกลายเป็นเมื่อวานใน UTC) */
export function toYmd(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
