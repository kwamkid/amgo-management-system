'use client'
// รายการงานแบบมือถือ (เจ้าของเลือก 18 พ.ย. 69 — บอร์ดบนมือถือเห็นแค่คอลัมน์เดียว ลากยาก)
// แบ่งกลุ่มตามความด่วน · แตะวงกลม = เสร็จ (แถวค้างไว้ให้กด "ยกเลิก" ได้) · แตะแถว = เปิดงาน
// คอมยังใช้ TaskBoard
import { useMemo, useState } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { Check } from 'lucide-react'
import { BrandBadge, DueBadge, PersonChip } from '@/components/shared'
import type { Task, TaskStatus } from '@/lib/services/taskService'
import { statusLineText } from '@/lib/tasks/updates'

type GroupKey = 'overdue' | 'today' | 'week' | 'later' | 'none' | 'done'
const GROUPS: { key: GroupKey; label: string }[] = [
  { key: 'overdue', label: 'เลยกำหนด' },
  { key: 'today', label: 'วันนี้' },
  { key: 'week', label: '7 วันข้างหน้า' },
  { key: 'later', label: 'หลังจากนั้น' },
  { key: 'none', label: 'ไม่มีกำหนด' },
  { key: 'done', label: 'เสร็จแล้ว' },
]
/** งานเสร็จโชว์แค่ล่าสุดกี่ใบ — ที่เหลือดูบนคอม/ค้นหา */
const DONE_LIMIT = 10

function groupOf(t: Task, today: Date): GroupKey {
  if (t.status === 'done') return 'done'
  if (!t.dueDate) return 'none'
  const d = differenceInCalendarDays(parseISO(t.dueDate), today)
  return d < 0 ? 'overdue' : d === 0 ? 'today' : d <= 7 ? 'week' : 'later'
}

export default function TaskList({
  tasks,
  me,
  canEdit,
  onOpen,
  onSetStatus,
}: {
  tasks: Task[]
  me: string
  canEdit: (t: Task) => boolean
  onOpen: (t: Task) => void
  onSetStatus: (t: Task, status: TaskStatus) => void
}) {
  // งานที่เพิ่งติ๊กเสร็จ ค้างอยู่กลุ่มเดิมจนกว่าจะออกจากหน้า — กด "ยกเลิก" ได้ ไม่กระโดดหายทันที
  const [justDone, setJustDone] = useState<Map<string, TaskStatus>>(new Map())

  const groups = useMemo(() => {
    const today = new Date()
    const by = new Map<GroupKey, Task[]>(GROUPS.map((g) => [g.key, []]))
    for (const t of tasks) {
      const prev = justDone.get(t.id)
      by.get(prev ? groupOf({ ...t, status: prev }, today) : groupOf(t, today))!.push(t)
    }
    const due = (t: Task) => t.dueDate ?? '9999'
    for (const [k, list] of by) {
      if (k === 'done') list.sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
      else if (k === 'none') list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      else list.sort((a, b) => due(a).localeCompare(due(b)))
    }
    by.set('done', by.get('done')!.slice(0, DONE_LIMIT))
    return GROUPS.map((g) => ({ ...g, items: by.get(g.key)! })).filter((g) => g.items.length)
  }, [tasks, justDone])

  const toggle = (t: Task) => {
    if (t.status === 'done') {
      const back = justDone.get(t.id) ?? 'doing'
      setJustDone((m) => {
        const n = new Map(m)
        n.delete(t.id)
        return n
      })
      onSetStatus(t, back)
    } else {
      setJustDone((m) => new Map(m).set(t.id, t.status))
      onSetStatus(t, 'done')
    }
  }

  if (!groups.length) return <p className="aoo-task-list__empty">ไม่มีงานในมุมมองนี้</p>

  return (
    <div className="aoo-task-list">
      {groups.map((g) => (
        <section key={g.key} className="aoo-task-list__group" data-group={g.key}>
          <h3 className="aoo-task-list__head">
            {g.label} <span>{g.items.length}</span>
          </h3>
          {g.items.map((t) => {
            const done = t.status === 'done'
            const others = t.assignees.filter((a) => a.userId !== me)
            return (
              <div key={t.id} className="aoo-task-row" data-done={done || undefined}>
                <button
                  type="button"
                  className="aoo-task-row__check"
                  aria-pressed={done}
                  aria-label={done ? 'ยกเลิกเสร็จ' : 'ทำเสร็จแล้ว'}
                  disabled={!canEdit(t)}
                  onClick={() => toggle(t)}
                >
                  {done && <Check size={16} strokeWidth={3} />}
                </button>
                <button type="button" className="aoo-task-row__body" onClick={() => onOpen(t)}>
                  <span className="aoo-task-row__title">
                    <span className="aoo-task-row__no">#{t.no}</span> {t.title}
                  </span>
                  {t.statusLine && !done && <span className="aoo-task-row__status">{statusLineText(t.statusLine)}</span>}
                  {(t.dueDate || t.brand || others.length > 0) && (
                    <span className="aoo-task-row__meta">
                      {t.dueDate && <DueBadge dueDate={t.dueDate} doneAt={done ? t.doneAt : null} />}
                      {t.brand && <BrandBadge brand={t.brand} />}
                      {others.map((a) => (
                        <PersonChip key={a.userId} userId={a.userId} name={a.name} />
                      ))}
                    </span>
                  )}
                </button>
                {justDone.has(t.id) && done && (
                  <button type="button" className="aoo-task-row__undo" onClick={() => toggle(t)}>
                    ยกเลิก
                  </button>
                )}
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
