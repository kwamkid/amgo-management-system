'use client'

// เพิ่มงานเร็วบนมือถือ (เจ้าของ 18 พ.ย. 69) — ชื่องาน + กดวันครบกำหนด (วันนี้ / พรุ่งนี้ / ศุกร์ / เลือกวัน) + คนรับ
// รายละเอียด/แบรนด์/รูป → "เพิ่มรายละเอียด" เปิดฟอร์มเต็มพร้อมค่าที่กรอกไว้

import { useState } from 'react'
import { Button, DatePicker, Field, Input, Modal } from '@/components/aoo'
import { useToast } from '@/hooks/useToast'
import { toYmd } from '@/lib/push/notify'
import { createTask, type TaskPerson } from '@/lib/services/taskService'
import { addDaysYmd, thaiDay } from '@/lib/tasks/updates'
import AssigneePicker from './AssigneePicker'

export interface TaskDraft {
  title: string
  dueDate: string | null
  assigneeIds: string[]
}

/** ศุกร์ที่จะถึง — วันนี้ศุกร์ = ศุกร์หน้า (วันนี้มีชิปของมันแล้ว) */
function nextFriday(today: string): { ymd: string; label: string } {
  const [y, m, d] = today.split('-').map(Number)
  const n = (5 - new Date(y, m - 1, d).getDay() + 7) % 7 || 7
  return { ymd: addDaysYmd(today, n), label: n === 7 ? 'ศุกร์หน้า' : 'ศุกร์นี้' }
}

export default function TaskQuickAdd({
  userId,
  people,
  brand,
  sortOrder,
  onMore,
  onClose,
}: {
  userId: string
  people: TaskPerson[]
  /** แบรนด์ที่กำลังกรองอยู่ — ติดไปกับงานใหม่ */
  brand: string | null
  sortOrder: number
  /** เปิดฟอร์มเต็มพร้อมค่าที่กรอกไว้ */
  onMore: (draft: TaskDraft) => void
  onClose: (created: boolean) => void
}) {
  const { showToast } = useToast()
  const today = toYmd(new Date())
  const fri = nextFriday(today)
  const chips = [
    { ymd: today, label: 'วันนี้' },
    { ymd: addDaysYmd(today, 1), label: 'พรุ่งนี้' },
    fri,
  ]
  const [title, setTitle] = useState('')
  const [due, setDue] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [assignees, setAssignees] = useState<string[]>([userId])
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      await createTask({ title: title.trim(), notes: '', dueDate: due, brand, sortOrder, assigneeIds: assignees }, userId)
      showToast('เพิ่มงานแล้ว', 'success')
      onClose(true)
    } catch (e) {
      showToast((e as Error).message, 'error')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => onClose(false)}
      title="เพิ่มงาน"
      maxWidth={480}
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto"
            disabled={busy}
            onClick={() => onMore({ title: title.trim(), dueDate: due, assigneeIds: assignees })}
          >
            เพิ่มรายละเอียด
          </Button>
          <Button onClick={save} loading={busy} disabled={!title.trim()}>
            เพิ่มงาน
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="ทำอะไร" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && save()}
            autoFocus
            placeholder="เช่น ส่งรูปโปร GB ให้ร้าน"
            enterKeyHint="done"
          />
        </Field>
        <Field label="เสร็จภายใน" help={due ? thaiDay(due) : 'ไม่มีกำหนด'} asDiv>
          <div className="aoo-chips">
            {chips.map((c) => (
              <button
                key={c.label}
                type="button"
                className="aoo-chip"
                aria-pressed={!picking && due === c.ymd}
                onClick={() => {
                  setPicking(false)
                  setDue(due === c.ymd && !picking ? null : c.ymd)
                }}
              >
                {c.label}
              </button>
            ))}
            <button type="button" className="aoo-chip" aria-pressed={picking} onClick={() => setPicking((p) => !p)}>
              เลือกวัน…
            </button>
          </div>
          {picking && (
            <DatePicker className="mt-2" value={due ?? ''} onChange={(v) => setDue(v || null)} min={today} placeholder="เลือกวัน" />
          )}
        </Field>
        <Field label="ใครทำ" asDiv>
          <AssigneePicker people={people} value={assignees} onChange={setAssignees} editable />
        </Field>
      </div>
    </Modal>
  )
}
