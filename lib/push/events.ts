// lib/push/events.ts
//
// เหตุการณ์ที่ยิง push + ข้อความ + ใครได้รับ — กติกาล้วน ไม่แตะฐานข้อมูล
// (ทดสอบด้วย node ตรง ๆ ได้ → ห้ามใช้ '@/' alias และ import ต้องมีนามสกุล .ts)
//
// หลัก: "เรื่องที่ต้องมีคนกดอนุมัติ" ไปหาคนอนุมัติ · "ผลอนุมัติ" ไปหาเจ้าของเรื่อง
// เช็คอิน/เช็คเอาท์ไม่ยิง push — วันละหลายสิบครั้ง คนรับจะปิดแจ้งเตือนทิ้งทั้งแอป
// (Discord ยังแจ้งอยู่เหมือนเดิม ไม่ได้แทนกัน)

export type PushEvent =
  | 'leave_request'
  | 'leave_approved'
  | 'leave_rejected'
  | 'swap_request'
  | 'swap_approved'
  | 'swap_rejected'

export const PUSH_EVENTS: readonly PushEvent[] = [
  'leave_request', 'leave_approved', 'leave_rejected',
  'swap_request', 'swap_approved', 'swap_rejected',
]

/** ตำแหน่งที่อนุมัติใบลา/ใบสลับวันหยุดได้ — ตรงกับ canManage ในหน้าจัดการ */
export const APPROVER_ROLES = ['admin', 'hr', 'manager'] as const

export interface PushEventInput {
  event: PushEvent
  /** ชื่อคนทำเรื่อง (คนขอ หรือคนอนุมัติ) — server ใส่จากบัญชีที่ล็อกอิน ไม่รับจากเบราว์เซอร์ */
  actorName: string
  /** เจ้าของเรื่อง — ใช้กับผลอนุมัติ/ปฏิเสธ */
  targetUserId?: string
  leaveType?: string
  /** ISO yyyy-mm-dd */
  startDate?: string
  endDate?: string
  totalDays?: number
  /** ใบสลับวันหยุด: วันที่มาทำแทน / วันที่จะหยุดแทน */
  workedDate?: string
  offDate?: string
  reason?: string
  isUrgent?: boolean
}

export interface PushMessage {
  title: string
  body: string
  url: string
  /** tag เดียวกันแทนที่กัน — เรื่องเดียวกันไม่ซ้อนหลายใบ */
  tag: string
}

export type PushRecipients =
  | { roles: readonly string[] }
  | { userIds: string[] }

/** เหตุการณ์ที่ต้องเป็นคนอนุมัติเท่านั้นถึงยิงได้ (กันพนักงานยิง "อนุมัติแล้ว" หากันเอง) */
export function requiresApprover(event: PushEvent): boolean {
  return event.endsWith('_approved') || event.endsWith('_rejected')
}

export function recipientsOf(input: PushEventInput): PushRecipients | null {
  if (requiresApprover(input.event)) {
    return input.targetUserId ? { userIds: [input.targetUserId] } : null
  }
  return { roles: APPROVER_ROLES }
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** '2026-09-12' → '12 ก.ย.' (ไม่ผ่าน Date — กัน timezone เลื่อนวัน) */
export function thaiShort(iso: string | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${Number(m[3])} ${TH_MONTHS[Number(m[2]) - 1] ?? ''}`
}

export function dateRange(start?: string, end?: string, days?: number): string {
  const s = thaiShort(start)
  const e = thaiShort(end)
  const span = !e || e === s ? s : `${s} – ${e}`
  return days && days > 1 ? `${span} (${days} วัน)` : span
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

export function buildMessage(input: PushEventInput): PushMessage {
  const who = firstName(input.actorName)
  switch (input.event) {
    case 'leave_request':
      return {
        title: `${input.isUrgent ? '🚨 ' : ''}${who} ขอ${input.leaveType || 'ลา'}`,
        body: [dateRange(input.startDate, input.endDate, input.totalDays), input.reason].filter(Boolean).join(' · ').slice(0, 120),
        url: '/leaves/management',
        tag: `leave-request-${input.startDate || ''}-${who}`,
      }
    case 'leave_approved':
      return {
        title: `✅ ${input.leaveType || 'ใบลา'}ได้รับอนุมัติ`,
        body: `${dateRange(input.startDate, input.endDate, input.totalDays)} · อนุมัติโดย ${who}`,
        url: '/leaves',
        tag: `leave-result-${input.startDate || ''}`,
      }
    case 'leave_rejected':
      return {
        title: `❌ ${input.leaveType || 'ใบลา'}ไม่ได้รับอนุมัติ`,
        body: [dateRange(input.startDate, input.endDate, input.totalDays), input.reason ? `เหตุผล: ${input.reason}` : ''].filter(Boolean).join(' · ').slice(0, 120),
        url: '/leaves',
        tag: `leave-result-${input.startDate || ''}`,
      }
    case 'swap_request':
      return {
        title: `🔁 ${who} ขอสลับวันหยุด`,
        body: `มาทำ ${thaiShort(input.workedDate)} แล้วหยุด ${thaiShort(input.offDate)}`,
        url: '/leaves/swap/management',
        tag: `swap-request-${input.workedDate || ''}-${who}`,
      }
    case 'swap_approved':
      return {
        title: '✅ สลับวันหยุดได้รับอนุมัติ',
        body: `มาทำ ${thaiShort(input.workedDate)} แล้วหยุด ${thaiShort(input.offDate)} · อนุมัติโดย ${who}`,
        url: '/leaves/swap',
        tag: `swap-result-${input.workedDate || ''}`,
      }
    case 'swap_rejected':
      return {
        title: '❌ สลับวันหยุดไม่ได้รับอนุมัติ',
        body: [`มาทำ ${thaiShort(input.workedDate)} / หยุด ${thaiShort(input.offDate)}`, input.reason ? `เหตุผล: ${input.reason}` : ''].filter(Boolean).join(' · ').slice(0, 120),
        url: '/leaves/swap',
        tag: `swap-result-${input.workedDate || ''}`,
      }
  }
}
