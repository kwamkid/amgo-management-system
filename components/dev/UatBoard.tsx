'use client'

// บอร์ด UAT (dev tracker) — ใช้ DevKanban กลาง (ลากแบบเดียวกับ TaskBoard)
// คอลัมน์ = สิ่งที่คนเทสต้องทำก่อน: รอเทส · ไม่ผ่าน · ติดขัด · ผ่าน · ปิดแล้ว
//   วางบน ไม่ผ่าน/ติดขัด/ผ่าน → เปิดฟอร์มบันทึกผลโดยเลือกผลนั้นไว้ให้ (ยกเลิก = การ์ดเด้งกลับ)
//   วางบน รอเทส (ส่งกลับ: ถามว่าแก้อะไร รอบ+1) หรือ ปิดแล้ว → เฉพาะผู้จัดการ/แอดมิน
//   ลากเรียงในคอลัมน์เดิม = บันทึก sort_order (ผู้เทสทำได้)

import { Ban, CheckCircle2, CircleDashed, Lock, XCircle } from 'lucide-react'
import { Pill } from '@/components/aoo'
import DevKanban, { type KanbanColumn } from '@/components/dev/DevKanban'
import {
  COLUMN_RESULT,
  COLUMNS,
  columnOf,
  DEVICE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_TONE,
  uatCode,
  type ColumnKey,
  type UatCase,
  type UatResultValue,
} from '@/lib/dev/uat'

const COLUMN_ICON = { todo: CircleDashed, failed: XCircle, blocked: Ban, passed: CheckCircle2, closed: Lock } as const
const KANBAN_COLUMNS: KanbanColumn<ColumnKey>[] = COLUMNS.map((c) => ({ key: c.key, label: c.label, tone: c.tone, icon: COLUMN_ICON[c.key] }))

export interface UatDrop {
  caseId: string
  column: ColumnKey
  /** วางบนคอลัมน์ผล = ผลที่เลือกไว้ให้ */
  result?: UatResultValue
  sortOrder: number
}

export default function UatBoard({
  cases,
  canManage,
  onReorder,
  onDrop,
  onOpen,
}: {
  cases: UatCase[]
  canManage: boolean
  onReorder: (id: string, sortOrder: number) => void
  /** ลากข้ามคอลัมน์ — หน้าแม่เปิดฟอร์ม/ถามต่อ */
  onDrop: (drop: UatDrop) => void
  onOpen: (c: UatCase) => void
}) {
  const locked = COLUMNS.filter((c) => c.managerOnly && !canManage).map((c) => c.key)
  return (
    <DevKanban
      items={cases}
      columns={KANBAN_COLUMNS}
      columnOf={(c) => columnOf(c.status)}
      canDrop={(_, to) => !locked.includes(to)}
      lockedColumns={locked}
      onReorder={onReorder}
      onDrop={(d) => onDrop({ caseId: d.id, column: d.column, result: COLUMN_RESULT[d.column], sortOrder: d.sortOrder })}
      onOpen={onOpen}
      renderCard={(c, s) => <UatCardView c={c} {...s} />}
    />
  )
}

export function UatCardView({ c, dragging, overlay }: { c: UatCase; dragging?: boolean; overlay?: boolean }) {
  const meta = [c.module, DEVICE_LABELS[c.device], c.resultCount > 0 && `บันทึกผล ${c.resultCount} ครั้ง`].filter(Boolean).join(' · ')
  return (
    <article className="aoo-task-card" data-dragging={dragging || undefined} data-overlay={overlay || undefined} data-done={c.status === 'closed' || undefined}>
      <div className="aoo-task-card__meta" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--fg-3)' }}>{uatCode(c.no)}</span>
        {c.priority === 1 && <Pill tone="danger">{PRIORITY_LABELS[1]}</Pill>}
        {c.status === 'retest' && <Pill tone={STATUS_TONE.retest}>{STATUS_LABELS.retest}</Pill>}
        {c.round > 1 && <Pill>รอบ {c.round}</Pill>}
        {c.environment === 'staging' && <Pill tone="warning">staging</Pill>}
      </div>
      <h4 className="aoo-task-card__title">{c.title}</h4>
      {meta && <p className="aoo-task-card__status">{meta}</p>}
    </article>
  )
}
