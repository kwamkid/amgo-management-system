'use client'

import { Pill, type PillTone } from '@/components/aoo'

/**
 * ป้ายสถานะ — ของเดิมแต่ละหน้า map สีกันเอง ทำให้ "อนุมัติแล้ว" เป็นสีเขียว
 * ในหน้าหนึ่ง แต่เป็นสีฟ้าในอีกหน้า
 *
 * รวมมาไว้ที่เดียว: ชื่อสถานะ → สี + คำแปลไทย
 */

type StatusDef = { label: string; tone: PillTone }

/*
 * สีมาตรฐานทั้งระบบ (เจ้าของเลือก 30 ก.ย. 69):
 *   รอ = เหลือง · สำเร็จ/ใช้งาน = เขียว · ไม่ผ่าน/หมดอายุ/สาย = แดง · ยกเลิก = เทา
 *   กำลังทำ = ฟ้า · WFH = ชมพู · นอกสถานที่ = ม่วง
 *   แอดมิน = ส้ม · HR = ม่วง · ผู้จัดการ = ฟ้า · พนักงาน = เทา
 */
const STATUS: Record<string, StatusDef> = {
  // ── ใบลา ────────────────────────────────────────────────
  pending: { label: 'รออนุมัติ', tone: 'warning' },
  approved: { label: 'อนุมัติแล้ว', tone: 'success' },
  rejected: { label: 'ไม่อนุมัติ', tone: 'danger' },
  cancelled: { label: 'ยกเลิกแล้ว', tone: 'neutral' },

  // ── เช็คอิน ─────────────────────────────────────────────
  'checked-in': { label: 'กำลังทำงาน', tone: 'sky' },
  completed: { label: 'เสร็จสิ้น', tone: 'success' },
  'in-progress': { label: 'กำลังดำเนินการ', tone: 'sky' },
  late: { label: 'มาสาย', tone: 'danger' },
  on_time: { label: 'ตรงเวลา', tone: 'success' },

  // ── สถานะพนักงาน ────────────────────────────────────────
  active: { label: 'ทำงานอยู่', tone: 'success' },
  probation: { label: 'ทดลองงาน', tone: 'warning' },
  resigned: { label: 'ลาออก', tone: 'neutral' },
  terminated: { label: 'เลิกจ้าง', tone: 'danger' },
  retired: { label: 'เกษียณ', tone: 'grape' },
  inactive: { label: 'ระงับใช้งาน', tone: 'neutral' },

  // ── ประเภทการจ้าง ───────────────────────────────────────
  monthly: { label: 'รายเดือน', tone: 'grape' },
  daily: { label: 'รายวัน', tone: 'sky' },

  // ── รูปแบบการทำงานรายวัน (จาก attendance_summary) ──────
  worked: { label: 'มาทำงาน', tone: 'success' },
  worked_wfh: { label: 'ทำงานที่บ้าน', tone: 'pink' },
  leave: { label: 'ลา', tone: 'warning' },
  absent: { label: 'ขาดงาน', tone: 'danger' },
  holiday: { label: 'วันหยุด', tone: 'neutral' },
  day_off: { label: 'วันหยุดประจำ', tone: 'neutral' },
  not_scheduled: { label: 'ไม่ได้จัดเวร', tone: 'neutral' },
  not_tracked: { label: 'ไม่ต้องเช็คอิน', tone: 'neutral' },

  // ── ประเภทการเช็คอิน ────────────────────────────────────
  onsite: { label: 'ในสถานที่', tone: 'success' },
  offsite: { label: 'นอกสถานที่', tone: 'grape' },
  wfh: { label: 'ที่บ้าน', tone: 'pink' },

  // ── คุณภาพชั่วโมงทำงาน ──────────────────────────────────
  original: { label: 'จากระบบ', tone: 'neutral' },
  recomputed: { label: 'คำนวณย้อนหลัง', tone: 'grape' },
  needs_review: { label: 'ต้องตรวจสอบ', tone: 'danger' },

  // ── role ────────────────────────────────────────────────
  admin: { label: 'ผู้ดูแลระบบ', tone: 'accent' },
  hr: { label: 'ฝ่ายบุคคล', tone: 'grape' },
  manager: { label: 'ผู้จัดการ', tone: 'sky' },
  employee: { label: 'พนักงาน', tone: 'neutral' },
  driver: { label: 'พนักงานขับรถ', tone: 'neutral' },
  marketing: { label: 'การตลาด', tone: 'pink' },
}

/** สถานะที่ชื่อซ้ำกับชุดหลักแต่ความหมายต่าง — เลือกด้วย kind */
const KINDS = {
  campaign: {
    pending: { label: 'รอดำเนินการ', tone: 'neutral' },
    active: { label: 'กำลังดำเนินการ', tone: 'sky' },
    reviewing: { label: 'รอตรวจสอบ', tone: 'warning' },
    revising: { label: 'รอแก้ไข', tone: 'accent' },
    completed: { label: 'เสร็จสิ้น', tone: 'success' },
    cancelled: { label: 'ยกเลิก', tone: 'neutral' },
  },
  submission: {
    pending: { label: 'ยังไม่ส่งงาน', tone: 'neutral' },
    submitted: { label: 'รอตรวจสอบ', tone: 'warning' },
    revision: { label: 'รอแก้ไข', tone: 'accent' },
    resubmitted: { label: 'ส่งแก้ไขแล้ว', tone: 'warning' },
    approved: { label: 'เสร็จสิ้น', tone: 'success' },
    cancelled: { label: 'ยกเลิก', tone: 'neutral' },
  },
  invite: {
    active: { label: 'ใช้งานได้', tone: 'success' },
    expired: { label: 'หมดอายุ', tone: 'danger' },
    used_up: { label: 'ใช้ครบแล้ว', tone: 'grape' },
    disabled: { label: 'ปิดใช้งาน', tone: 'neutral' },
  },
  tier: {
    nano: { label: 'Nano', tone: 'neutral' },
    micro: { label: 'Micro', tone: 'sky' },
    macro: { label: 'Macro', tone: 'pink' },
    mega: { label: 'Mega', tone: 'grape' },
  },
  leaveType: {
    sick: { label: 'ลาป่วย', tone: 'pink' },
    personal: { label: 'ลากิจ', tone: 'sky' },
    vacation: { label: 'ลาพักร้อน', tone: 'success' },
  },
} satisfies Record<string, Record<string, StatusDef>>

export type StatusKind = keyof typeof KINDS

function lookup(status: string, kind?: StatusKind): StatusDef | undefined {
  const scoped = kind ? (KINDS[kind] as Record<string, StatusDef>)[status] : undefined
  return scoped ?? STATUS[status]
}

export default function StatusBadge({
  status,
  kind,
  label,
  tone,
}: {
  status: string
  /** ชุดสถานะ เช่น campaign / submission / invite / tier / leaveType (ไม่ใส่ = ชุดหลัก) */
  kind?: StatusKind
  /** ทับคำแปลเริ่มต้น */
  label?: string
  /** ทับสีเริ่มต้น */
  tone?: PillTone
}) {
  const def = lookup(status, kind)
  return (
    <Pill tone={tone ?? def?.tone ?? 'neutral'}>{label ?? def?.label ?? status}</Pill>
  )
}

/** ใช้ตอนต้องการแค่ข้อความ ไม่เอาป้าย เช่นใน export Excel */
export function statusLabel(status: string, kind?: StatusKind): string {
  return lookup(status, kind)?.label ?? status
}

/** สีของสถานะ — ใช้กับ StatCard/อื่น ๆ ให้ตรงกับป้าย */
export function statusTone(status: string, kind?: StatusKind): PillTone {
  return lookup(status, kind)?.tone ?? 'neutral'
}
