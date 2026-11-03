'use client'

// ป้ายสถานะใบเบิก — ขั้นตอนมี 2 ขั้นอนุมัติ StatusBadge กลางบอกได้แค่ "รออนุมัติ"
// ไม่พอให้คนยื่นรู้ว่าติดอยู่ที่ใคร
// ใบโอนที่อนุมัติแล้วแยก 2 ขั้น (3 พ.ย. 69): รอส่งไฟล์ธนาคาร → ส่งไฟล์แล้ว รอโอน

import { Pill, type PillTone } from '@/components/aoo'
import { STATUS_LABEL, type ExpensePayout, type ExpenseStatus } from '@/lib/services/expenseRules'

const TONE: Record<ExpenseStatus, PillTone> = {
  pending_manager: 'warning',
  pending_finance: 'warning',
  approved: 'info',
  paid: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
}

export default function ExpenseStatusPill({
  status,
  payout,
  exportedAt,
}: {
  status: ExpenseStatus
  payout?: ExpensePayout
  exportedAt?: string | null
}) {
  if (status === 'approved' && payout === 'transfer') {
    return exportedAt ? <Pill tone="accent">ส่งไฟล์แล้ว รอโอน</Pill> : <Pill tone="info">รอส่งไฟล์ธนาคาร</Pill>
  }
  if (status === 'approved' && payout === 'payroll') return <Pill tone="info">รอจ่ายกับเงินเดือน</Pill>
  return <Pill tone={TONE[status]}>{STATUS_LABEL[status]}</Pill>
}
