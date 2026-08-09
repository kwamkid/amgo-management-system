'use client'

import { Pill, type PillTone } from '@/components/aoo'

/**
 * ป้ายสถานะ — ของเดิมแต่ละหน้า map สีกันเอง ทำให้ "อนุมัติแล้ว" เป็นสีเขียว
 * ในหน้าหนึ่ง แต่เป็นสีฟ้าในอีกหน้า
 *
 * รวมมาไว้ที่เดียว: ชื่อสถานะ → สี + คำแปลไทย
 */

type StatusDef = { label: string; tone: PillTone }

const STATUS: Record<string, StatusDef> = {
  // ── ใบลา ────────────────────────────────────────────────
  pending: { label: 'รออนุมัติ', tone: 'warning' },
  approved: { label: 'อนุมัติแล้ว', tone: 'success' },
  rejected: { label: 'ไม่อนุมัติ', tone: 'danger' },
  cancelled: { label: 'ยกเลิกแล้ว', tone: 'neutral' },

  // ── เช็คอิน ─────────────────────────────────────────────
  'checked-in': { label: 'กำลังทำงาน', tone: 'success' },
  completed: { label: 'เสร็จสิ้น', tone: 'neutral' },

  // ── สถานะพนักงาน ────────────────────────────────────────
  active: { label: 'ทำงานอยู่', tone: 'success' },
  probation: { label: 'ทดลองงาน', tone: 'warning' },
  resigned: { label: 'ลาออก', tone: 'neutral' },
  terminated: { label: 'เลิกจ้าง', tone: 'danger' },
  retired: { label: 'เกษียณ', tone: 'info' },

  // ── ประเภทการจ้าง ───────────────────────────────────────
  monthly: { label: 'รายเดือน', tone: 'info' },
  daily: { label: 'รายวัน', tone: 'neutral' },

  // ── รูปแบบการทำงานรายวัน (จาก attendance_summary) ──────
  worked: { label: 'มาทำงาน', tone: 'success' },
  worked_wfh: { label: 'ทำงานที่บ้าน', tone: 'info' },
  leave: { label: 'ลา', tone: 'warning' },
  absent: { label: 'ขาดงาน', tone: 'danger' },
  holiday: { label: 'วันหยุด', tone: 'neutral' },
  day_off: { label: 'วันหยุดประจำ', tone: 'neutral' },
  not_scheduled: { label: 'ไม่ได้จัดเวร', tone: 'neutral' },
  not_tracked: { label: 'ไม่ต้องเช็คอิน', tone: 'neutral' },

  // ── ประเภทการเช็คอิน ────────────────────────────────────
  onsite: { label: 'ในสถานที่', tone: 'success' },
  offsite: { label: 'นอกสถานที่', tone: 'warning' },
  wfh: { label: 'ที่บ้าน', tone: 'info' },

  // ── คุณภาพชั่วโมงทำงาน ──────────────────────────────────
  original: { label: 'จากระบบ', tone: 'neutral' },
  recomputed: { label: 'คำนวณย้อนหลัง', tone: 'info' },
  needs_review: { label: 'ต้องตรวจสอบ', tone: 'danger' },

  // ── role ────────────────────────────────────────────────
  admin: { label: 'ผู้ดูแลระบบ', tone: 'accent' },
  hr: { label: 'ฝ่ายบุคคล', tone: 'info' },
  manager: { label: 'ผู้จัดการ', tone: 'info' },
  employee: { label: 'พนักงาน', tone: 'neutral' },
  driver: { label: 'พนักงานขับรถ', tone: 'neutral' },
  marketing: { label: 'การตลาด', tone: 'neutral' },
}

export default function StatusBadge({
  status,
  label,
  tone,
}: {
  status: string
  /** ทับคำแปลเริ่มต้น */
  label?: string
  /** ทับสีเริ่มต้น */
  tone?: PillTone
}) {
  const def = STATUS[status]
  return (
    <Pill tone={tone ?? def?.tone ?? 'neutral'}>{label ?? def?.label ?? status}</Pill>
  )
}

/** ใช้ตอนต้องการแค่ข้อความ ไม่เอาป้าย เช่นใน export Excel */
export function statusLabel(status: string): string {
  return STATUS[status]?.label ?? status
}
