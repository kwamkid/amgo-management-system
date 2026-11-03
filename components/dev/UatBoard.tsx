'use client'

// บอร์ด UAT (dev tracker) — kanban แบบเดียวกับ components/tasks/TaskBoard.tsx (dnd-kit · มือถือกดค้าง ~0.2 วิแล้วลาก)
// คอลัมน์ = สิ่งที่คนเทสต้องทำก่อน: รอเทส · ไม่ผ่าน · ติดขัด · ผ่าน · ปิดแล้ว
//   วางบน ไม่ผ่าน/ติดขัด/ผ่าน → เปิดฟอร์มบันทึกผลโดยเลือกผลนั้นไว้ให้ (ยกเลิก = การ์ดเด้งกลับ)
//   วางบน รอเทส (ส่งกลับ: ถามว่าแก้อะไร รอบ+1) หรือ ปิดแล้ว → เฉพาะผู้จัดการ/แอดมิน
//   ลากเรียงในคอลัมน์เดิม = บันทึก sort_order (ผู้เทสทำได้)

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Ban, CheckCircle2, CircleDashed, Lock, XCircle } from 'lucide-react'
import { Pill } from '@/components/aoo'
import { sortOrderBetween } from '@/lib/services/taskService'
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

type Columns = Record<ColumnKey, string[]>

function toColumns(cases: UatCase[]): Columns {
  const cols: Columns = { todo: [], failed: [], blocked: [], passed: [], closed: [] }
  for (const c of [...cases].sort((a, b) => a.sortOrder - b.sortOrder)) cols[columnOf(c.status)].push(c.id)
  return cols
}

function findColumn(cols: Columns, id: string): ColumnKey | undefined {
  if (id in cols) return id as ColumnKey
  return (Object.keys(cols) as ColumnKey[]).find((k) => cols[k].includes(id))
}

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
  /** ลากเรียงในคอลัมน์เดิม */
  onReorder: (id: string, sortOrder: number) => void
  /** ลากข้ามคอลัมน์ — หน้าแม่เปิดฟอร์ม/ถามต่อ แล้วเรียก revert ถ้ายกเลิก */
  onDrop: (drop: UatDrop) => void
  onOpen: (c: UatCase) => void
}) {
  const byId = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases])
  const [cols, setCols] = useState<Columns>(() => toColumns(cases))
  const [activeId, setActiveId] = useState<string | null>(null)
  const fromColumn = useRef<ColumnKey | null>(null)
  // เปิดมาต้องเห็นคอลัมน์รอเทสก่อนเสมอ — บางเบราว์เซอร์จำ/เลื่อนตำแหน่งไปสุดขวาเอง (ไกด์เจอ 3 พ.ย. 69)
  const boardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (boardRef.current) boardRef.current.scrollLeft = 0
  }, [])

  // ข้อมูลจากข้างนอกเปลี่ยน — ไม่ทับระหว่างกำลังลาก
  useEffect(() => {
    if (!activeId) setCols(toColumns(cases))
  }, [cases]) // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const canDropOn = (to: ColumnKey) => canManage || !COLUMNS.find((c) => c.key === to)!.managerOnly

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    fromColumn.current = findColumn(cols, String(active.id)) ?? null
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const id = String(active.id)
    const from = findColumn(cols, id)
    const to = findColumn(cols, String(over.id))
    if (!from || !to || from === to || !canDropOn(to)) return
    setCols((prev) => {
      const target = prev[to]
      const overIndex = target.indexOf(String(over.id))
      const at = overIndex < 0 ? target.length : overIndex
      return { ...prev, [from]: prev[from].filter((x) => x !== id), [to]: [...target.slice(0, at), id, ...target.slice(at)] }
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id)
    setActiveId(null)
    const col = findColumn(cols, id)
    const c = byId.get(id)
    if (!over || !col || !c) {
      setCols(toColumns(cases))
      return
    }
    let list = cols[col]
    const overIndex = list.indexOf(String(over.id))
    const curIndex = list.indexOf(id)
    if (overIndex >= 0 && overIndex !== curIndex) list = arrayMove(list, curIndex, overIndex)
    setCols((prev) => ({ ...prev, [col]: list }))

    const i = list.indexOf(id)
    const above = list[i - 1] ? byId.get(list[i - 1])?.sortOrder : undefined
    const below = list[i + 1] ? byId.get(list[i + 1])?.sortOrder : undefined
    const sortOrder = sortOrderBetween(above, below)

    if (fromColumn.current === col) {
      if (overIndex >= 0 && overIndex !== curIndex) onReorder(id, sortOrder)
      return
    }
    if (!canDropOn(col)) {
      setCols(toColumns(cases))
      return
    }
    onDrop({ caseId: id, column: col, result: COLUMN_RESULT[col], sortOrder })
  }

  const active = activeId ? byId.get(activeId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setCols(toColumns(cases))
      }}
    >
      <div ref={boardRef} className="aoo-kanban aoo-kanban--5">
        {COLUMNS.map((col) => (
          <Column key={col.key} col={col} locked={col.managerOnly && !canManage} ids={cols[col.key]} byId={byId} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay>{active ? <UatCardView c={active} overlay /> : null}</DragOverlay>
    </DndContext>
  )
}

function Column({
  col,
  locked,
  ids,
  byId,
  onOpen,
}: {
  col: (typeof COLUMNS)[number]
  locked: boolean
  ids: string[]
  byId: Map<string, UatCase>
  onOpen: (c: UatCase) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })
  const Icon = COLUMN_ICON[col.key]
  return (
    <section className="aoo-kanban__col" data-tone={col.tone} data-over={isOver || undefined}>
      <header className="aoo-kanban__head">
        <Icon size={16} />
        {col.label}
        <span className="aoo-kanban__count">{ids.length}</span>
      </header>
      <SortableContext id={col.key} items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="aoo-kanban__list">
          {ids.map((id) => {
            const c = byId.get(id)
            return c ? <SortableCard key={id} c={c} onOpen={onOpen} /> : null
          })}
          {ids.length === 0 && <p className="aoo-kanban__empty">{locked ? 'ผู้จัดการเป็นคนย้ายมาช่องนี้' : 'ลากการ์ดมาวางที่นี่'}</p>}
        </div>
      </SortableContext>
    </section>
  )
}

function SortableCard({ c, onOpen }: { c: UatCase; onOpen: (c: UatCase) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id })
  return (
    <div
      ref={setNodeRef}
      // transform เปลี่ยนทุกเฟรมระหว่างลาก — ค่าไดนามิกจริง ใส่ใน class ไม่ได้
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(c)}
    >
      <UatCardView c={c} dragging={isDragging} />
    </div>
  )
}

export function UatCardView({ c, dragging, overlay }: { c: UatCase; dragging?: boolean; overlay?: boolean }) {
  const meta = [c.module, DEVICE_LABELS[c.device], c.resultCount > 0 && `บันทึกผล ${c.resultCount} ครั้ง`].filter(Boolean).join(' · ')
  return (
    <article className="aoo-task-card" data-dragging={dragging || undefined} data-overlay={overlay || undefined} data-done={c.status === 'closed' || undefined}>
      <div className="aoo-task-card__meta" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-3)' }}>{uatCode(c.no)}</span>
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
