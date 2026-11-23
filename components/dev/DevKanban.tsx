'use client'

// Dev tracker kanban (UAT board + bug board) — same behaviour as components/tasks/TaskBoard.tsx
// (dnd-kit · phones: press ~0.2 s then drag). Dragging within a column saves sort_order; dropping on
// another column calls onDrop and the parent decides (open a form, call the API, or refuse) — the card
// snaps back by itself when the parent's data doesn't change.

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
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
import { sortOrderBetween } from '@/lib/services/taskService'

export interface KanbanColumn<K extends string> {
  key: K
  label: string
  tone: string
  icon: ComponentType<{ size?: number }>
  /** shown in an empty column the viewer may not drop on */
  lockedText?: string
}

export interface KanbanDrop<K extends string> {
  id: string
  from: K
  column: K
  sortOrder: number
}

export default function DevKanban<T extends { id: string; sortOrder: number }, K extends string>({
  items,
  columns,
  columnOf,
  canDrop,
  onReorder,
  onDrop,
  onOpen,
  renderCard,
  lockedColumns = [],
}: {
  items: T[]
  columns: KanbanColumn<K>[]
  columnOf: (item: T) => K
  /** may this item go to that column? (false = card snaps back) */
  canDrop: (item: T, to: K) => boolean
  onReorder: (id: string, sortOrder: number) => void
  onDrop: (drop: KanbanDrop<K>) => void
  onOpen: (item: T) => void
  renderCard: (item: T, state: { dragging?: boolean; overlay?: boolean }) => ReactNode
  /** columns this viewer can never drop on (empty-column hint) */
  lockedColumns?: K[]
}) {
  type Cols = Record<K, string[]>
  const byId = useMemo(() => new Map(items.map((c) => [c.id, c])), [items])
  const toColumns = (list: T[]): Cols => {
    const cols = Object.fromEntries(columns.map((c) => [c.key, [] as string[]])) as Cols
    for (const c of [...list].sort((a, b) => a.sortOrder - b.sortOrder)) cols[columnOf(c)]?.push(c.id)
    return cols
  }
  const findColumn = (cols: Cols, id: string): K | undefined => {
    if (id in cols) return id as K
    return (Object.keys(cols) as K[]).find((k) => cols[k].includes(id))
  }

  const [cols, setCols] = useState<Cols>(() => toColumns(items))
  const [activeId, setActiveId] = useState<string | null>(null)
  const fromColumn = useRef<K | null>(null)
  // always open on the first column — some browsers restore the scroll to the far right (ไกด์ 3 Nov)
  const boardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (boardRef.current) boardRef.current.scrollLeft = 0
  }, [])

  // outside data changed — never overwrite mid-drag
  useEffect(() => {
    if (!activeId) setCols(toColumns(items))
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const allowed = (id: string, to: K) => {
    const item = byId.get(id)
    return !!item && (fromColumn.current === to || canDrop(item, to))
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    fromColumn.current = findColumn(cols, String(active.id)) ?? null
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const id = String(active.id)
    const from = findColumn(cols, id)
    const to = findColumn(cols, String(over.id))
    if (!from || !to || from === to || !allowed(id, to)) return
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
    if (!over || !col || !byId.get(id)) {
      setCols(toColumns(items))
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
    const from = fromColumn.current

    if (from === col) {
      if (overIndex >= 0 && overIndex !== curIndex) onReorder(id, sortOrder)
      return
    }
    if (!from || !allowed(id, col)) {
      setCols(toColumns(items))
      return
    }
    onDrop({ id, from, column: col, sortOrder })
  }

  const active = activeId ? byId.get(activeId) : undefined
  const locked = (key: K) => lockedColumns.includes(key)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setCols(toColumns(items))
      }}
    >
      <div ref={boardRef} className={`aoo-kanban${columns.length === 5 || columns.length === 2 ? ` aoo-kanban--${columns.length}` : ''}`}>
        {columns.map((col) => (
          <Column key={col.key} col={col} locked={locked(col.key)} ids={cols[col.key] ?? []} byId={byId} onOpen={onOpen} renderCard={renderCard} />
        ))}
      </div>
      <DragOverlay>{active ? renderCard(active, { overlay: true }) : null}</DragOverlay>
    </DndContext>
  )
}

function Column<T extends { id: string }, K extends string>({
  col,
  locked,
  ids,
  byId,
  onOpen,
  renderCard,
}: {
  col: KanbanColumn<K>
  locked: boolean
  ids: string[]
  byId: Map<string, T>
  onOpen: (item: T) => void
  renderCard: (item: T, state: { dragging?: boolean; overlay?: boolean }) => ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })
  const Icon = col.icon
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
            const item = byId.get(id)
            return item ? <SortableCard key={id} item={item} onOpen={onOpen} renderCard={renderCard} /> : null
          })}
          {ids.length === 0 && <p className="aoo-kanban__empty">{locked ? (col.lockedText ?? 'ผู้จัดการเป็นคนย้ายมาช่องนี้') : 'ลากการ์ดมาวางที่นี่'}</p>}
        </div>
      </SortableContext>
    </section>
  )
}

function SortableCard<T extends { id: string }>({
  item,
  onOpen,
  renderCard,
}: {
  item: T
  onOpen: (item: T) => void
  renderCard: (item: T, state: { dragging?: boolean; overlay?: boolean }) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <div
      ref={setNodeRef}
      // transform changes every frame while dragging — a real dynamic value, can't be a class
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(item)}
    >
      {renderCard(item, { dragging: isDragging })}
    </div>
  )
}
