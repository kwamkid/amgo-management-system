'use client'

// แถบเลือกคนของหน้างาน — แทนแท็บ งานของฉัน/งานทั้งหมด + ช่องเลือกคน (เจ้าของขอ 28 ต.ค. 69)
// เรียงคนที่มีงานครบกำหนดใกล้สุดก่อน แล้วจำนวนงานมากก่อน · ตัวเลข = งานที่ยังไม่เสร็จ · สีแบรนด์ = มีงานเลยกำหนด

import { useMemo } from 'react'
import { PersonStrip, type PersonStripItem } from '@/components/shared'
import type { Task, TaskPerson } from '@/lib/services/taskService'

/** 'all' = ทุกงาน · 'mine' = งานของฉัน · อื่น ๆ = user id */
export type AssigneeScope = string

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
  const items = useMemo<PersonStripItem[]>(() => {
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
    const hint = (n: number, overdue: boolean) => `งานที่ยังไม่เสร็จ ${n}${overdue ? ' · มีงานเลยกำหนด' : ''}`
    return [
      { key: 'all', name: 'ทุกคน', count: open.length, alert: open.some(late), hint: hint(open.length, open.some(late)) },
      { key: 'mine', name: 'ของฉัน', userId: me, count: mine.length, alert: mine.some(late), hint: hint(mine.length, mine.some(late)) },
      ...others.map(({ p, open: n, overdue }) => ({ key: p.userId, name: p.name, userId: p.userId, count: n, alert: overdue, hint: hint(n, overdue) })),
    ]
  }, [tasks, people, me, isMine, today])

  return <PersonStrip items={items} value={value} onChange={onChange} ariaLabel="ดูงานของใคร" />
}
