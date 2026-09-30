'use client'

import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from '@/components/aoo'

/**
 * ปุ่ม ‹ ป้าย › เลื่อนวัน/เดือน — เดิมเขียนเองใน payroll, stock-photos,
 * delivery/map, checkin/map
 */
export default function DateStepper({
  label,
  children,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  prevLabel = 'ก่อนหน้า',
  nextLabel = 'ถัดไป',
}: {
  /** ข้อความตรงกลาง */
  label?: ReactNode
  /** หรือวางตัวควบคุมเอง เช่น <DatePicker> แทน label */
  children?: ReactNode
  onPrev: () => void
  onNext: () => void
  prevDisabled?: boolean
  nextDisabled?: boolean
  prevLabel?: string
  nextLabel?: string
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <IconButton icon={ChevronLeft} onClick={onPrev} disabled={prevDisabled} title={prevLabel} tone="sunken" />
      {children ?? <span className="min-w-[8rem] px-2 text-center font-semibold tabular-nums">{label}</span>}
      <IconButton icon={ChevronRight} onClick={onNext} disabled={nextDisabled} title={nextLabel} tone="sunken" />
    </div>
  )
}
