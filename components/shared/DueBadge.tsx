'use client'

import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { Pill, type PillTone } from '@/components/aoo'

/**
 * ป้ายวันครบกำหนด — สีบอกความเร่ง (กติกาเดียวทั้งระบบ)
 *   ยังไม่เสร็จ: เลย N วัน = แดง · วันนี้/พรุ่งนี้/อีก 2 วัน = เหลือง · ไกลกว่านั้น = เทา
 *   เสร็จแล้ว (ส่ง doneAt): ช้า N วัน = แดง · ทันกำหนด = เขียว
 */
export function dueBadge(dueDate: string, doneAt?: string | null): { label: string; tone: PillTone } {
  const due = parseISO(dueDate)
  if (doneAt) {
    const late = differenceInCalendarDays(new Date(doneAt), due)
    return late > 0 ? { label: `ช้า ${late} วัน`, tone: 'danger' } : { label: 'ทันกำหนด', tone: 'success' }
  }
  const days = differenceInCalendarDays(due, new Date())
  if (days < 0) return { label: `เลย ${-days} วัน`, tone: 'danger' }
  if (days === 0) return { label: 'วันนี้', tone: 'warning' }
  if (days === 1) return { label: 'พรุ่งนี้', tone: 'warning' }
  return { label: format(due, 'd MMM', { locale: th }), tone: days === 2 ? 'warning' : 'neutral' }
}

export default function DueBadge({ dueDate, doneAt }: { dueDate: string; doneAt?: string | null }) {
  const { label, tone } = dueBadge(dueDate, doneAt)
  return <Pill tone={tone}>{label}</Pill>
}
