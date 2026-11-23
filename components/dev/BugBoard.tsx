'use client'

// บอร์ดบั๊ก (dev tracker) — DevKanban กลาง · ใหม่ · รับเรื่อง · กำลังแก้ · รอเทส · ปิดแล้ว (ไม่แก้อยู่ในปิดแล้ว)
// ผู้จัดการลากได้ทุกช่อง · ผู้เทสลากได้เฉพาะบั๊กที่รอเทส → ปิดแล้ว / กำลังแก้ (DB ตรวจซ้ำใน dev_bug_set_status)

import { CheckCircle2, CircleDot, FlaskConical, Inbox, Wrench } from 'lucide-react'
import { Pill } from '@/components/aoo'
import DevKanban, { type KanbanColumn, type KanbanDrop } from '@/components/dev/DevKanban'
import { BUG_COLUMNS, BUG_STATUS_LABELS, bugCode, bugColumnOf, SEVERITY_LABELS, SEVERITY_TONE, type BugColumnKey, type DevBug } from '@/lib/dev/bugs'
import { uatCode } from '@/lib/dev/uat'

const ICON = { new: CircleDot, accepted: Inbox, fixing: Wrench, testing: FlaskConical, closed: CheckCircle2 } as const
const COLUMNS: KanbanColumn<BugColumnKey>[] = BUG_COLUMNS.map((c) => ({ key: c.key, label: c.label, tone: c.tone, icon: ICON[c.key] }))

export default function BugBoard({
  bugs,
  canManage,
  canTest,
  onReorder,
  onDrop,
  onOpen,
}: {
  bugs: DevBug[]
  canManage: boolean
  canTest: boolean
  onReorder: (id: string, sortOrder: number) => void
  onDrop: (drop: KanbanDrop<BugColumnKey>) => void
  onOpen: (b: DevBug) => void
}) {
  const canDrop = (b: DevBug, to: BugColumnKey) =>
    canManage || (canTest && b.status === 'testing' && BUG_COLUMNS.find((c) => c.key === to)!.testerDrop)
  const locked = canManage ? [] : BUG_COLUMNS.filter((c) => !canTest || !c.testerDrop).map((c) => c.key)
  return (
    <DevKanban
      items={bugs}
      columns={COLUMNS}
      columnOf={(b) => bugColumnOf(b.status)}
      canDrop={canDrop}
      lockedColumns={locked}
      onReorder={onReorder}
      onDrop={onDrop}
      onOpen={onOpen}
      renderCard={(b, s) => <BugCardView b={b} {...s} />}
    />
  )
}

export function BugCardView({ b, dragging, overlay }: { b: DevBug; dragging?: boolean; overlay?: boolean }) {
  const meta = [b.assigneeName && `ผู้แก้ ${b.assigneeName}`, b.reporterName && `แจ้งโดย ${b.reporterName}`, b.shots.length > 0 && `รูป ${b.shots.length}`]
    .filter(Boolean)
    .join(' · ')
  const done = b.status === 'closed' || b.status === 'wont_fix'
  return (
    <article className="aoo-task-card" data-dragging={dragging || undefined} data-overlay={overlay || undefined} data-done={done || undefined}>
      <div className="aoo-task-card__meta" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--fg-3)' }}>{bugCode(b.no)}</span>
        {(b.severity === 'critical' || b.severity === 'high') && <Pill tone={SEVERITY_TONE[b.severity]}>{SEVERITY_LABELS[b.severity]}</Pill>}
        {b.status === 'wont_fix' && <Pill>{BUG_STATUS_LABELS.wont_fix}</Pill>}
        {b.environment === 'staging' && <Pill tone="warning">staging</Pill>}
        {b.uatCaseNo && <Pill tone="sky">{uatCode(b.uatCaseNo)}</Pill>}
      </div>
      <h4 className="aoo-task-card__title">{b.title}</h4>
      {meta && <p className="aoo-task-card__status">{meta}</p>}
    </article>
  )
}
