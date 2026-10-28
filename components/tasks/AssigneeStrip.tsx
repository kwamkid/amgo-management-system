'use client'

// แถบเลือกคนแบบรูป — กดรูปดูงานของคนนั้น (เจ้าของขอ 28 ต.ค. 69 "เลือกดูงานของแต่ละคนจะไวกว่า")
// แทนแท็บ งานของฉัน/งานทั้งหมด + ช่องเลือกคน · เรียงคนที่มีงานครบกำหนดใกล้สุดก่อน แล้วจำนวนงานมากก่อน
// ตัวเลขบนรูป = งานที่ยังไม่เสร็จ · แดง = มีงานเลยกำหนด · สไตล์ที่ .aoo-people-strip

import { useMemo } from 'react'
import { Users } from 'lucide-react'
import { UserAvatar } from '@/components/shared'
import type { Task, TaskPerson } from '@/lib/services/taskService'

/** 'all' = ทุกงาน · 'mine' = งานของฉัน · อื่น ๆ = user id */
export type AssigneeScope = string

interface Item {
  key: AssigneeScope
  name: string
  open: number
  overdue: boolean
  avatar: React.ReactNode
}

export default function AssigneeStrip({
  tasks,
  people,
  me,
  isMine,
  value,
  onChange,
  today,
}: {
  tasks: Task[]
  people: TaskPerson[]
  me: string
  isMine: (t: Task) => boolean
  value: AssigneeScope
  onChange: (v: AssigneeScope) => void
  /** YYYY-MM-DD เวลาไทย */
  today: string
}) {
  const items = useMemo<Item[]>(() => {
    const open = tasks.filter((t) => t.status !== 'done')
    const late = (t: Task) => !!t.dueDate && t.dueDate < today
    const byPerson = new Map<string, { open: number; nextDue: string | null; overdue: boolean }>()
    for (const t of open)
      for (const a of t.assignees) {
        if (a.userId === me) continue // อยู่ในช่อง "ของฉัน" แล้ว
        const e = byPerson.get(a.userId) ?? { open: 0, nextDue: null, overdue: false }
        e.open++
        if (t.dueDate && (!e.nextDue || t.dueDate < e.nextDue)) e.nextDue = t.dueDate
        e.overdue ||= late(t)
        byPerson.set(a.userId, e)
      }
    const others = people
      .filter((p) => byPerson.has(p.userId))
      .map((p) => ({ p, ...byPerson.get(p.userId)! }))
      .sort(
        (x, y) =>
          // ครบกำหนดใกล้สุดก่อน (ไม่มีวันกำหนดไว้ท้าย) แล้วงานเยอะก่อน
          (x.nextDue ?? '9999').localeCompare(y.nextDue ?? '9999') || y.open - x.open || x.p.name.localeCompare(y.p.name, 'th')
      )
    const mine = open.filter(isMine)
    const meName = people.find((p) => p.userId === me)?.name ?? 'ฉัน'
    return [
      {
        key: 'all',
        name: 'ทุกคน',
        open: open.length,
        overdue: open.some(late),
        avatar: (
          <span className="aoo-people-strip__all">
            <Users size={18} />
          </span>
        ),
      },
      {
        key: 'mine',
        name: 'ของฉัน',
        open: mine.length,
        overdue: mine.some(late),
        avatar: <UserAvatar userId={me} name={meName} size="md" />,
      },
      ...others.map(({ p, open: n, overdue }) => ({
        key: p.userId,
        name: p.name,
        open: n,
        overdue,
        avatar: <UserAvatar userId={p.userId} name={p.name} size="md" />,
      })),
    ]
  }, [tasks, people, me, isMine, today])

  return (
    <div className="aoo-people-strip" role="radiogroup" aria-label="ดูงานของใคร">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="radio"
          aria-checked={value === it.key}
          className="aoo-people-strip__item"
          onClick={() => onChange(it.key)}
          title={`${it.name} — งานที่ยังไม่เสร็จ ${it.open}${it.overdue ? ' · มีงานเลยกำหนด' : ''}`}
        >
          <span className="aoo-people-strip__avatar">
            {it.avatar}
            {it.open > 0 && (
              <span className="aoo-people-strip__count" data-overdue={it.overdue || undefined}>
                {it.open}
              </span>
            )}
          </span>
          <span className="aoo-people-strip__name">{it.name}</span>
        </button>
      ))}
    </div>
  )
}
