// ชนิดข้อมูลและค่าคงที่ของหน้า bulk edit
//
// ⚠️ ต้องแยกออกมาจาก actions.ts — ไฟล์ที่ขึ้นต้นด้วย 'use server'
// ส่งออกได้เฉพาะ async function เท่านั้น อย่างอื่นจะถูกแทนด้วย proxy
// ของ server action ทำให้ฝั่ง client เรียก .includes() ไม่ได้

export type EmploymentStatus =
  | 'active'
  | 'probation'
  | 'resigned'
  | 'terminated'
  | 'retired'

/** สถานะที่แปลว่า "ไม่ได้อยู่แล้ว" — ต้องมีวันสุดท้ายเสมอ */
export const ENDED_STATUSES: EmploymentStatus[] = ['resigned', 'terminated', 'retired']

export const isEnded = (s: EmploymentStatus) => ENDED_STATUSES.includes(s)

export type BulkRow = {
  id: string
  business_unit_id: string | null
  employment_type: 'monthly' | 'daily'
  employment_status: EmploymentStatus
  start_date: string | null
  start_date_verified: boolean
  end_date: string | null
  days_per_week: number | null
  payroll_cycle: string | null
  base_salary: number | null
}

export type SaveResult = {
  ok: boolean
  updated: number
  salaryRows: number
  errors: string[]
}
