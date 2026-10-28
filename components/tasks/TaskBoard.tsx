'use client'

// บอร์ดงานแบบคอลัมน์ ต้องทำ / กำลังทำ / เสร็จแล้ว — ลากข้ามคอลัมน์ + เรียงในคอลัมน์ได้
//
// ใช้ dnd-kit ไม่ใช้ HTML5 drag แบบ tasksuke เพราะ HTML5 drag ใช้นิ้วลากบนมือถือไม่ได้
// มือถือ: กดค้าง ~0.2 วิ แล้วลาก (ปัดเฉย ๆ = เลื่อนจอตามปกติ)

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
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Image as ImageIcon } from 'lucide-react'
import { Pill, type PillTone } from '@/components/aoo'
import { BrandBadge, DueBadge, PersonChip } from '@/components/shared'
import { STATUS_ICON, STATUS_TONE } from '@/components/tasks/taskUi'
import { sortOrderBetween, TASK_COLUMNS, type Task, type TaskStatus } from '@/lib/services/taskService'
import { statusLineText } from '@/lib/tasks/updates'

const COLUMN_TONE: Record<TaskStatus, PillTone> = STATUS_TONE

type Columns = Record<TaskStatus, string[]>

function toColumns(tasks: Task[]): Columns {
  const cols: Columns = { todo: [], doing: [], done: [] }
  for (const t of [...tasks].sort((a, b) => a.sortOrder - b.sortOrder)) cols[t.status].push(t.id)
  return cols
}

function findColumn(cols: Columns, id: string): TaskStatus | undefined {
  if (id in cols) return id as TaskStatus
  return (Object.keys(cols) as TaskStatus[]).find((s) => cols[s].includes(id))
}

export default function TaskBoard({
  tasks,
  onMove,
  onOpen,
}: {
  tasks: Task[]
  /** ลากเสร็จแล้วสถานะหรือลำดับเปลี่ยน */
  onMove: (id: string, status: TaskStatus, sortOrder: number) => void
  onOpen: (task: Task) => void
}) {
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const [cols, setCols] = useState<Columns>(() => toColumns(tasks))
  const [activeId, setActiveId] = useState<string | null>(null)
  const fromColumn = useRef<TaskStatus | null>(null)

  // ข้อมูลจากข้างนอกเปลี่ยน (เพิ่ม/ลบ/แก้) — ไม่ทับระหว่างกำลังลาก
  useEffect(() => {
    if (!activeId) setCols(toColumns(tasks))
  }, [tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    fromColumn.current = findColumn(cols, String(active.id)) ?? null
  }

  // ข้ามคอลัมน์ระหว่างลาก — ย้าย id ไปคอลัมน์ใหม่ทันทีเพื่อให้การ์ดอื่นเลื่อนหลบ
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const id = String(active.id)
    const from = findColumn(cols, id)
    const to = findColumn(cols, String(over.id))
    if (!from || !to || from === to) return
    setCols((prev) => {
      const target = prev[to]
      const overIndex = target.indexOf(String(over.id))
      const at = overIndex < 0 ? target.length : overIndex
      return {
        ...prev,
        [from]: prev[from].filter((x) => x !== id),
        [to]: [...target.slice(0, at), id, ...target.slice(at)],
      }
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id)
    setActiveId(null)
    const col = findColumn(cols, id)
    if (!over || !col) {
      setCols(toColumns(tasks))
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
    const task = byId.get(id)
    const reordered = overIndex >= 0 && overIndex !== curIndex
    if (!task || (task.status === col && fromColumn.current === col && !reordered)) return
    onMove(id, col, sortOrderBetween(above, below))
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
        setCols(toColumns(tasks))
      }}
    >
      <div className="aoo-kanban">
        {TASK_COLUMNS.map(({ status, label }) => (
          <Column key={status} status={status} label={label} ids={cols[status]} byId={byId} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay>{active ? <TaskCardView task={active} overlay /> : null}</DragOverlay>
    </DndContext>
  )
}

function Column({
  status,
  label,
  ids,
  byId,
  onOpen,
}: {
  status: TaskStatus
  label: string
  ids: string[]
  byId: Map<string, Task>
  onOpen: (task: Task) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const Icon = STATUS_ICON[status]
  return (
    <section className="aoo-kanban__col" data-tone={COLUMN_TONE[status]} data-over={isOver || undefined}>
      <header className="aoo-kanban__head">
        <Icon size={16} />
        {label}
        <span className="aoo-kanban__count">{ids.length}</span>
      </header>
      <SortableContext id={status} items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="aoo-kanban__list">
          {ids.map((id) => {
            const t = byId.get(id)
            return t ? <SortableCard key={id} task={t} onOpen={onOpen} /> : null
          })}
          {ids.length === 0 && <p className="aoo-kanban__empty">ลากการ์ดมาวางที่นี่</p>}
        </div>
      </SortableContext>
    </section>
  )
}

function SortableCard({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      // transform เปลี่ยนทุกเฟรมระหว่างลาก — ค่าไดนามิกจริง ใส่ใน class ไม่ได้
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
    >
      <TaskCardView task={task} dragging={isDragging} />
    </div>
  )
}

function TaskCardView({ task, dragging, overlay }: { task: Task; dragging?: boolean; overlay?: boolean }) {
  // เสร็จแล้วแต่ไม่รู้วันเสร็จ (ข้อมูลเก่า) — ไม่ต้องโชว์ป้ายวัน
  const due = task.dueDate && !(task.status === 'done' && !task.doneAt) ? task.dueDate : null
  return (
    <article
      className="aoo-task-card"
      data-dragging={dragging || undefined}
      data-overlay={overlay || undefined}
      data-done={task.status === 'done' || undefined}
    >
      {task.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL จาก Supabase
        <img className="aoo-task-card__cover" src={task.coverUrl} alt="" loading="lazy" draggable={false} />
      )}
      <h4 className="aoo-task-card__title">{task.title}</h4>
      {task.statusLine && task.status !== 'done' && (
        <p className="aoo-task-card__status">{statusLineText(task.statusLine)}</p>
      )}
      {(due || task.brand || task.imageCount > 0 || task.assignees.length > 0) && (
        <div className="aoo-task-card__meta">
          {due && <DueBadge dueDate={due} doneAt={task.status === 'done' ? task.doneAt : null} />}
          {task.brand && <BrandBadge brand={task.brand} />}
          {task.imageCount > 0 && (
            <Pill>
              <ImageIcon size={12} /> {task.imageCount}
            </Pill>
          )}
          {task.assignees.length > 0 && (
            <span className="aoo-task-card__people">
              {task.assignees.map((a) => (
                <PersonChip key={a.userId} userId={a.userId} name={a.name} />
              ))}
            </span>
          )}
        </div>
      )}
    </article>
  )
}
