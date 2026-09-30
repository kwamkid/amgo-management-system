'use client'

// ป้ายสถานะใบเบิก — ขั้นตอนมี 2 ขั้นอนุมัติ StatusBadge กลางบอกได้แค่ "รออนุมัติ"
// ไม่พอให้คนยื่นรู้ว่าติดอยู่ที่ใคร

import { Pill, type PillTone } from '@/components/aoo'
import { STATUS_LABEL, type ExpenseStatus } from '@/lib/services/expenseRules'

const TONE: Record<ExpenseStatus, PillTone> = {
  pending_manager: 'warning',
  pending_finance: 'warning',
  approved: 'info',
  paid: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
}

export default function ExpenseStatusPill({ status }: { status: ExpenseStatus }) {
  return <Pill tone={TONE[status]}>{STATUS_LABEL[status]}</Pill>
}
