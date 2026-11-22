'use client'

// Action plan tab — the plan's tasks grouped by phase. Same rows as /tasks (plan_id + phase):
// tick here = done there, Edith/Discord reminders keep working. Full editing (notes, images,
// timeline) opens the task on /tasks.

import { useState } from 'react'
import Link from 'next/link'
import { Check, ExternalLink, Plus } from 'lucide-react'
import { Button, DatePicker, Input, Progress, SelectMenu } from '@/components/aoo'
import { DueBadge, PersonChip, SectionCard } from '@/components/shared'
import AssigneePicker from '@/components/tasks/AssigneePicker'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { createTask, updateTask, type TaskPerson } from '@/lib/services/taskService'
import { setTaskPlan, type Plan, type PlanTask } from '@/lib/services/marketingService'

export default function ActionPlanTab({
  plan,
  tasks,
  people,
  me,
  onChanged,
}: {
  plan: Plan
  tasks: PlanTask[]
  people: TaskPerson[]
  me: string
  onChanged: () => void
}) {
  const { userData } = useAuth()
  const { showToast } = useToast()
  const isAdmin = userData?.role === 'admin'
  const names = new Map(people.map((p) => [p.userId, p.name]))
  const [adding, setAdding] = useState<string | null>(null)

  const canEdit = (t: PlanTask) => isAdmin || t.createdBy === me || t.assigneeIds.includes(me)

  const toggle = async (t: PlanTask) => {
    if (!canEdit(t)) return showToast('ติ๊กได้เฉพาะงานที่ตัวเองสร้างหรือรับผิดชอบ', 'error')
    try {
      await updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' })
      onChanged()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const move = async (t: PlanTask, phase: string | null) => {
    try {
      await setTaskPlan(t.id, plan.id, phase)
      onChanged()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const known = new Set(plan.phases.map((p) => p.key))
  const groups = [
    ...plan.phases.map((p) => ({ key: p.key, label: `${p.key} · ${p.label}`, items: tasks.filter((t) => t.phase === p.key) })),
    { key: '', label: 'ยังไม่ระบุช่วง', items: tasks.filter((t) => !t.phase || !known.has(t.phase)) },
  ].filter((g) => g.key || g.items.length)

  const phaseOptions = plan.phases.map((p) => ({ value: p.key, label: `${p.key} · ${p.label}` }))

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const done = g.items.filter((t) => t.status === 'done').length
        return (
          <SectionCard
            key={g.key || 'none'}
            title={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{g.label}</span>
                <span className="text-xs font-normal text-gray-500">
                  เสร็จ {done}/{g.items.length}
                </span>
              </div>
            }
          >
            {g.items.length > 0 && <Progress value={Math.round((done / g.items.length) * 100)} tone="success" className="mb-2" />}
            <div className="aoo-task-list">
              {g.items.map((t) => {
                const isDone = t.status === 'done'
                return (
                  <div key={t.id} className="aoo-task-row" data-done={isDone || undefined}>
                    <button
                      type="button"
                      className="aoo-task-row__check"
                      aria-pressed={isDone}
                      aria-label={isDone ? 'ยกเลิกเสร็จ' : 'ทำเสร็จแล้ว'}
                      disabled={!canEdit(t)}
                      onClick={() => toggle(t)}
                    >
                      {isDone && <Check size={16} strokeWidth={3} />}
                    </button>
                    <Link href={`/tasks?task=${t.id}`} className="aoo-task-row__body">
                      <span className="aoo-task-row__title">
                        <span className="aoo-task-row__no">#{t.no}</span> {t.title}
                        {t.status === 'doing' && <span className="ml-1 text-xs text-gray-500">(กำลังทำ)</span>}
                      </span>
                      {(t.dueDate || t.assigneeIds.length > 0) && (
                        <span className="aoo-task-row__meta">
                          {t.dueDate && <DueBadge dueDate={t.dueDate} doneAt={isDone ? t.doneAt : null} />}
                          {t.assigneeIds.map((id) => (
                            <PersonChip key={id} userId={id} name={names.get(id) ?? '?'} />
                          ))}
                        </span>
                      )}
                    </Link>
                    {!g.key && canEdit(t) && (
                      <div className="w-40 shrink-0">
                        <SelectMenu size="sm" value={null} options={phaseOptions} onChange={(v) => move(t, v)} placeholder="ย้ายไปช่วง…" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {g.key &&
              (adding === g.key ? (
                <AddRow plan={plan} phase={g.key} people={people} me={me} onDone={() => { setAdding(null); onChanged() }} />
              ) : (
                <Button variant="ghost" icon={Plus} className="mt-2" onClick={() => setAdding(g.key)}>
                  เพิ่มงานในช่วงนี้
                </Button>
              ))}
          </SectionCard>
        )
      })}
      <p className="flex items-center gap-1 text-xs text-gray-400">
        <ExternalLink size={14} /> กดชื่องานเพื่อเปิดในหน้างานของทีม (โน้ต รูป อัปเดต เลื่อนวัน)
      </p>
    </div>
  )
}

function AddRow({ plan, phase, people, me, onDone }: { plan: Plan; phase: string; people: TaskPerson[]; me: string; onDone: () => void }) {
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [who, setWho] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await createTask(
        { title: title.trim(), notes: '', dueDate: due || null, brand: plan.brand, sortOrder: 0, assigneeIds: who, planId: plan.id, phase },
        me
      )
      onDone()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px]">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="ต้องทำอะไร" />
        <DatePicker value={due} onChange={setDue} placeholder="ส่งภายใน" clearable="ไม่กำหนด" />
      </div>
      <AssigneePicker people={people} value={who} onChange={setWho} editable />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          ยกเลิก
        </Button>
        <Button onClick={save} disabled={!title.trim()} loading={saving}>
          เพิ่มงาน
        </Button>
      </div>
    </div>
  )
}
