// lib/utils/viewAs.ts
//
// "ดูระบบในมุมมองของสิทธิ์อื่น" — เครื่องมือทดสอบของแอดมิน (เจ้าของขอ 14 ส.ค. 69)
//
// ⚠️ เป็นการจำลอง "หน้าจอ" เท่านั้น ไม่ใช่การลดสิทธิ์จริง — RLS ฝั่งฐานข้อมูล
// ยังอ่าน role จาก JWT ของแอดมินอยู่ ดังนั้นใช้เช็คว่าเมนู/ปุ่ม/หน้าไหนโผล่บ้าง
// อย่าเอาไปสรุปว่า "พนักงานเห็นข้อมูลนี้ได้" — เรื่องข้อมูลต้องดูที่ policy
//
// เก็บใน localStorage เพราะ useAuth เป็น hook แยกกันต่อ component
// (ไม่มี context กลาง) — สลับมุมมองแล้วโหลดหน้าใหม่ทุก component จึงตรงกัน

import type { UserData } from '@/lib/services/user/mappers'

const KEY = 'amgo_view_as'

export interface ViewAsPreset {
  value: string
  label: string
  role: UserData['role']
  seesDelivery?: boolean
  jobFunctionCode?: string
  hasSrpAccess?: boolean
}

/** มุมมองที่เลือกได้ — ครอบคลุมทุกกติกาที่ Sidebar ใช้ตัดสินใจโชว์เมนู */
export const VIEW_AS_PRESETS: ViewAsPreset[] = [
  { value: 'off', label: 'มุมมองปกติ (ผู้ดูแลระบบ)', role: 'admin', hasSrpAccess: true },
  { value: 'hr', label: 'ฝ่ายบุคคล', role: 'hr' },
  { value: 'manager', label: 'ผู้จัดการ', role: 'manager' },
  { value: 'marketing', label: 'การตลาด', role: 'marketing' },
  { value: 'driver', label: 'พนักงานขับรถ', role: 'driver' },
  { value: 'employee', label: 'พนักงานทั่วไป', role: 'employee' },
  { value: 'delivery', label: 'พนักงาน + เห็นงานส่งของ (Call Center/คลัง)', role: 'employee', seesDelivery: true },
  { value: 'production', label: 'พนักงานฝ่ายผลิต', role: 'employee', jobFunctionCode: 'production' },
  { value: 'srp', label: 'พนักงาน + สิทธิ์ SRP Calculator', role: 'employee', hasSrpAccess: true },
]

export function getViewAs(): string {
  if (typeof window === 'undefined') return 'off'
  try {
    return localStorage.getItem(KEY) || 'off'
  } catch {
    return 'off'
  }
}

export function setViewAs(value: string) {
  try {
    if (value === 'off') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, value)
  } catch {
    /* เขียนไม่ได้ก็ข้าม */
  }
}

/** แปลง userData ของแอดมินให้เป็นมุมมองที่เลือก — คนที่ไม่ใช่แอดมินไม่มีผล */
export function applyViewAs(user: UserData): UserData {
  if (user.role !== 'admin') return user
  const preset = VIEW_AS_PRESETS.find((p) => p.value === getViewAs())
  if (!preset || preset.value === 'off') return user
  return {
    ...user,
    role: preset.role,
    seesDelivery: preset.seesDelivery ?? false,
    jobFunctionCode: preset.jobFunctionCode,
    hasSrpAccess: preset.hasSrpAccess ?? false,
  }
}
