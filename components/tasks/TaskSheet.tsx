'use client'

// หน้ารายละเอียดงานบนมือถือ (เจ้าของ 18 พ.ย. 69) — เปิดมาเป็นหน้าอ่าน ไม่ใช่ฟอร์มแก้
// บน: #เลข · ครบกำหนด · แบรนด์ · คนรับผิดชอบ → ปุ่มสถานะ (กดแล้วบันทึกทันที) → รายละเอียด → รูป
// ล่าง: ความคืบหน้าแบบแชท (เก่า → ใหม่) + ช่องพิมพ์อัปเดต/ถ่ายรูปติดท้ายจอ
// "แก้ไข" = หน้าต่างแก้เดิม (ชื่อ/แบรนด์/วัน/คน · รอเขา/นัดหมาย อยู่ในแท็บความคืบหน้า)

import { useEffect, useRef, useState } from 'react'
import { Camera, Pencil, SendHorizontal, X } from 'lucide-react'
import { Button, IconButton, ImageDropzone, Modal, RichText, StepSelect } from '@/components/aoo'
import { BrandBadge, DueBadge, PersonChip } from '@/components/shared'
import { useToast } from '@/hooks/useToast'
import { toYmd } from '@/lib/push/notify'
import {
  addTaskUpdate,
  getTaskUpdates,
  TASK_COLUMNS,
  type Task,
  type TaskPerson,
  type TaskStatus,
  type TaskUpdate,
} from '@/lib/services/taskService'
import { KIND_EMOJI, thaiDay } from '@/lib/tasks/updates'
import { isRichTextEmpty } from '@/lib/utils/richText'
import TaskImages from './TaskImages'
import { headOf } from './TaskTimeline'
import { STATUS_ICON, STATUS_TONE } from './taskUi'

export default function TaskSheet({
  task,
  userId,
  people,
  canEdit,
  onSetStatus,
  onEdit,
  onClose,
}: {
  task: Task
  userId: string
  people: TaskPerson[]
  /** สถานะ/อัปเดต/รูป — แอดมิน · คนสร้าง · ผู้รับผิดชอบ */
  canEdit: boolean
  /** เปลี่ยนสถานะ — หน้าแม่อัปเดตรายการทันทีแล้วค่อยบันทึก */
  onSetStatus: (t: Task, status: TaskStatus) => void
  onEdit: () => void
  /** changed = มีอัปเดต/รูปใหม่ — ให้หน้าแม่โหลดบรรทัดสถานะใหม่ */
  onClose: (changed: boolean) => void
}) {
  const { showToast } = useToast()
  const [status, setStatus] = useState(task.status)
  const [items, setItems] = useState<TaskUpdate[] | null>(null)
  const [text, setText] = useState('')
  const [files, setFiles] = useState<{ id: string; file: File; url: string }[]>([])
  const [sending, setSending] = useState(false)
  const [changed, setChanged] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const load = () =>
    getTaskUpdates(task.id)
      .then(setItems)
      .catch((e) => showToast((e as Error).message, 'error'))

  useEffect(() => {
    load()
  }, [task.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ช่องพิมพ์ยืดตามข้อความ (สูงสุด ~5 บรรทัด แล้วเลื่อนในช่อง)
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + 2, 120)}px` // +2 = ขอบบนล่าง (border-box) ไม่งั้นมีแถบเลื่อน
    el.style.overflowY = el.scrollHeight + 2 > 120 ? 'auto' : 'hidden'
  }, [text])

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const pickStatus = (v: string) => {
    const s = v as TaskStatus
    if (s === status) return
    setStatus(s)
    onSetStatus({ ...task, status }, s)
    showToast(`เปลี่ยนเป็น "${TASK_COLUMNS.find((c) => c.status === s)?.label}" แล้ว`, 'success')
  }

  const send = async () => {
    if (sending || (!text.trim() && !files.length)) return
    setSending(true)
    try {
      const failed = await addTaskUpdate(
        task.id,
        { kind: 'note', body: text, eventDate: null },
        userId,
        files.map((f) => f.file)
      )
      if (failed) showToast(`อัปโหลดรูปไม่สำเร็จ ${failed} รูป`, 'error')
      files.forEach((f) => URL.revokeObjectURL(f.url))
      setFiles([])
      setText('')
      setChanged(true)
      // อัปเดตงานที่ยังไม่เริ่ม = เริ่มทำแล้ว (trigger ใน DB ย้ายเป็นกำลังทำให้)
      if (status === 'todo') setStatus('doing')
      await load()
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }))
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSending(false)
    }
  }

  const name = (id: string | null) => people.find((p) => p.userId === id)?.name ?? 'ระบบ'
  const feed = items ? [...items].reverse() : null
  const done = status === 'done'

  return (
    <Modal
      open
      onClose={() => onClose(changed)}
      maxWidth={560}
      title={
        <span className="aoo-task-sheet__title">
          <span className="aoo-task-sheet__no">#{task.no}</span> {task.title}
        </span>
      }
      footer={
        canEdit ? (
          <div className="aoo-task-sheet__composer">
            {files.length > 0 && (
              <div className="aoo-task-sheet__picked">
                {files.map((f) => (
                  <span key={f.id} className="aoo-task-sheet__thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt="" />
                    <button
                      type="button"
                      aria-label="เอารูปออก"
                      onClick={() => {
                        URL.revokeObjectURL(f.url)
                        setFiles((cur) => cur.filter((x) => x.id !== f.id))
                      }}
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="aoo-task-sheet__input-row">
              <IconButton icon={Camera} size={40} tone="sunken" aria-label="ถ่ายรูป / เลือกรูป" onClick={() => fileRef.current?.click()} />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? [])
                  setFiles((cur) => [
                    ...cur,
                    ...list.map((file, i) => ({ id: `f-${Date.now()}-${i}`, file, url: URL.createObjectURL(file) })),
                  ])
                  e.target.value = ''
                }}
              />
              <textarea
                ref={textRef}
                className="aoo-task-sheet__input"
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="อัปเดตความคืบหน้า…"
                aria-label="อัปเดตความคืบหน้า"
              />
              <Button
                icon={SendHorizontal}
                aria-label="ส่ง"
                onClick={send}
                loading={sending}
                disabled={!text.trim() && !files.length}
              />
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="aoo-task-sheet">
        <div className="aoo-task-sheet__meta">
          {task.dueDate ? <DueBadge dueDate={task.dueDate} doneAt={done ? task.doneAt : null} /> : <span className="aoo-task-sheet__muted">ไม่มีกำหนด</span>}
          {task.brand && <BrandBadge brand={task.brand} />}
          {task.assignees.map((a) => (
            <PersonChip key={a.userId} userId={a.userId} name={a.name} />
          ))}
          <Button variant="ghost" size="sm" icon={Pencil} className="ml-auto" onClick={onEdit}>
            แก้ไข
          </Button>
        </div>

        <StepSelect
          aria-label="สถานะ"
          value={status}
          onChange={pickStatus}
          disabled={!canEdit}
          options={TASK_COLUMNS.map((c) => ({
            value: c.status,
            label: c.label,
            icon: STATUS_ICON[c.status],
            tone: STATUS_TONE[c.status],
          }))}
        />

        {!isRichTextEmpty(task.notes) && <RichText html={task.notes} className="aoo-task-sheet__notes" />}

        {task.imageCount > 0 && <TaskImages taskId={task.id} userId={userId} readOnly hideWhenEmpty onChanged={() => {}} />}

        <section className="aoo-task-sheet__feed" aria-label="ความคืบหน้า">
          <h4 className="aoo-task-sheet__feed-title">ความคืบหน้า</h4>
          {feed?.length === 0 && (
            <p className="aoo-task-sheet__muted">
              {canEdit ? 'ยังไม่มี — พิมพ์ด้านล่างได้เลย ถ่ายรูปแนบได้' : 'ยังไม่มีความคืบหน้า'}
            </p>
          )}
          {feed?.map((u) => {
            const own = u.createdBy === userId && u.kind !== 'chase'
            const head = u.kind === 'note' && !u.eventDate ? null : headOf(u)
            return (
              <div key={u.id} className="aoo-chat" data-own={own || undefined}>
                {!own && <span className="aoo-chat__who">{u.kind === 'chase' ? 'Edith' : name(u.createdBy)}</span>}
                <div className="aoo-chat__bubble" data-kind={u.kind}>
                  {head && (
                    <span className="aoo-chat__head">
                      {KIND_EMOJI[u.kind]} {head}
                    </span>
                  )}
                  {u.body && <span className="aoo-chat__body">{u.body}</span>}
                  {u.images.length > 0 && (
                    <ImageDropzone size="sm" readOnly items={u.images.map((i) => ({ id: i.id, url: i.url }))} />
                  )}
                </div>
                <span className="aoo-chat__time">
                  {thaiDay(toYmd(new Date(u.createdAt)))} {new Date(u.createdAt).toTimeString().slice(0, 5)}
                </span>
              </div>
            )
          })}
          <div ref={endRef} />
        </section>
      </div>
    </Modal>
  )
}
