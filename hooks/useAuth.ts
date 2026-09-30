// hooks/useAuth.ts
//
// อ่าน session จาก Supabase แทน Firebase Auth
//
// ⚠️ รูปแบบ UserData ที่คืนออกไป "ต้องเหมือนเดิมทุกฟิลด์" เพราะมีหน้าจอ
//    เรียกใช้อยู่หลายสิบจุด — ตัวนี้ทำหน้าที่แปลงชื่อคอลัมน์จาก snake_case
//    ของ Postgres กลับเป็น camelCase ที่โค้ดเดิมคาดหวัง
//    พอย้ายหน้าจอครบแล้วค่อยเลิกแปลงแล้วใช้ชื่อคอลัมน์ตรง ๆ
//
// ── โหลดครั้งเดียว แชร์ทั้งแอป (30 ก.ย. 69) ────────────────────────────
// เดิม useAuth เป็น hook เดี่ยว ๆ — ทุก component ที่เรียก (layout · Sidebar ·
// Navbar · หน้า · การ์ดบน Dashboard อีกนับสิบ) ต่างคนต่างยิง getUser + users +
// job_functions + srp + web_owners เอง หน้าเดียวหลายสิบคำขอ และระหว่างที่ตัวไหน
// ยังโหลดไม่เสร็จ หน้าที่เช็คสิทธิ์จาก userData?.role จะเห็นว่า "ไม่ใช่แอดมิน"
// แล้วขึ้นแถบแดง "ไม่มีสิทธิ์" แวบหนึ่ง — เจ้าของเจอเกือบทุกหน้า แม้แต่ Dashboard
//
// ตอนนี้ AuthProvider (components/auth/AuthProvider.tsx ใน app/layout.tsx) โหลด
// ครั้งเดียว useAuth แค่อ่านจาก context · เปลี่ยนหน้าไม่ต้องโหลดใหม่
// หน้าที่แก้ข้อมูลตัวเอง (setup/โปรไฟล์) ใช้ window.location.reload() อยู่แล้ว

'use client'

import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { mapUser, type UserData } from '@/lib/services/user/mappers'
import { applyViewAs } from '@/lib/utils/viewAs'

// การแปลงแถว users → UserData ย้ายไปอยู่ที่ lib/services/user/mappers.ts แล้ว
// เพราะ userService ต้องใช้ตัวเดียวกัน — เดิมแปลงคนละที่แล้วไม่ตรงกัน
export type { UserData }

export interface AuthState {
  user: User | null
  userData: UserData | null
  loading: boolean
  error: string | null
  /** สิทธิ์จริงตามฐานข้อมูล — ต่างจาก userData.role เมื่อแอดมินสลับ "ดูในมุมมองอื่น" */
  realRole: UserData['role'] | null
}

export const INITIAL_AUTH: AuthState = {
  user: null,
  userData: null,
  loading: true,
  error: null,
  realRole: null,
}

/** ข้อความ error ตอนดึงข้อมูลพลาดชั่วคราว (เน็ตหลุด/เปิดแอปกลับมา) — ต่างจากบัญชีใช้ไม่ได้จริง */
export const FETCH_ERROR = 'เกิดข้อผิดพลาดในการดึงข้อมูล'

export const AuthContext = createContext<AuthState | null>(null)

/** ข้อมูลผู้ใช้ที่ล็อกอินอยู่ — อ่านจาก AuthProvider (โหลดครั้งเดียวทั้งแอป) */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    // ไม่ควรเกิด — AuthProvider ครอบทั้งแอปใน app/layout.tsx
    if (typeof window !== 'undefined') console.error('useAuth() ถูกเรียกนอก <AuthProvider>')
    return INITIAL_AUTH
  }
  return ctx
}

const signedOut = (error: string | null = null): AuthState => ({
  user: null,
  userData: null,
  loading: false,
  error,
  realRole: null,
})

/** โหลดข้อมูลผู้ใช้หนึ่งรอบ — AuthProvider เรียก */
export async function loadAuthState(authUser: User | null): Promise<AuthState> {
  if (!authUser) return signedOut()

  const sb = createClient()
  const [{ data: row, error }, { data: locs }] = await Promise.all([
    sb.from('users').select('*').eq('id', authUser.id).maybeSingle(),
    sb.from('user_allowed_locations').select('location_id').eq('user_id', authUser.id),
  ])

  if (error) {
    console.error('ดึงข้อมูลผู้ใช้ไม่สำเร็จ:', error.message)
    return signedOut(FETCH_ERROR)
  }

  if (!row || row.deleted_at) return signedOut('ไม่พบข้อมูลผู้ใช้')

  if (!row.is_active) {
    const ended = ['resigned', 'terminated', 'retired'].includes(row.employment_status)
    await sb.auth.signOut()
    return signedOut(ended ? 'บัญชีนี้สิ้นสุดการเป็นพนักงานแล้ว' : 'บัญชีของคุณยังไม่ได้รับการอนุมัติ')
  }

  // สิทธิ์พิเศษตามตำแหน่ง — เห็นเมนูส่งของ (sees_delivery) + เมนูผลิต (code = production)
  let seesDelivery = false
  let jobFunctionCode: string | undefined
  // แบบตารางงาน — หน้าเช็คอินใช้ตัดสินว่าเลือกกะสาขา (PC) หรือใช้เวลาปกติ (คนไม่มีกะ)
  let scheduleType: string | undefined
  // เวลาทำงานของตำแหน่ง (ฝ่ายผลิต 04:00–15:00) — ไม่ตั้ง = เวลาปกติ 08:30/09:00
  let jobWorkHours: { start: string; end: string } | null = null

  // 3 เรื่องนี้ไม่ขึ้นต่อกัน — ยิงพร้อมกัน
  const [jfRes, srpRes, webRes] = await Promise.all([
    row.job_function_id
      ? sb
          .from('job_functions')
          .select('sees_delivery, code, schedule_type, work_start_time, work_end_time')
          .eq('id', row.job_function_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // เมนู SRP Calculator — เห็นเมื่อได้รับสิทธิ์อย่างน้อย 1 แบรนด์ (แอดมินเห็นเสมอ)
    row.role === 'admin'
      ? Promise.resolve({ count: 1 })
      : sb.from('srp_brand_access').select('id', { count: 'exact', head: true }).eq('user_id', row.id),
    // เมนูดูแลเว็บไซต์ลูกค้า — งานส่วนตัวของเจ้าของ ไม่ผูกกับ role
    // (แอดมินคนอื่นก็ไม่เห็น ต้องมีชื่อใน web_owners เท่านั้น)
    sb.from('web_owners').select('user_id', { count: 'exact', head: true }).eq('user_id', row.id),
  ])

  const jf = jfRes.data
  if (jf) {
    seesDelivery = jf.sees_delivery ?? false
    jobFunctionCode = jf.code ?? undefined
    scheduleType = jf.schedule_type ?? undefined
    if (jf.work_start_time && jf.work_end_time) {
      jobWorkHours = { start: jf.work_start_time, end: jf.work_end_time }
    }
  }
  const hasSrpAccess = (srpRes.count ?? 0) > 0
  const hasWebAccess = (webRes.count ?? 0) > 0

  // แอดมินสลับดูมุมมองสิทธิ์อื่นได้ (เครื่องมือทดสอบ) — จำลองแค่หน้าจอ ไม่ใช่สิทธิ์จริง
  const real = {
    ...mapUser(row, (locs ?? []).map((l) => l.location_id)),
    seesDelivery,
    jobFunctionCode,
    scheduleType,
    jobWorkHours,
    hasSrpAccess,
    hasWebAccess,
  }
  return {
    user: authUser,
    userData: applyViewAs(real),
    loading: false,
    error: null,
    realRole: real.role,
  }
}
