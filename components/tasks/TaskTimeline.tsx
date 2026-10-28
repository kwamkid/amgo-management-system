'use client'

// ไทม์ไลน์ความคืบหน้าของงาน (เจ้าของ 28 ต.ค. 69)
// ⏳ รอเขา (บังคับวันตาม) · 🔁 ตามแล้ว ยังรออยู่ · 📅 นัดหมาย · 📝 อัปเดต + รูป
// วันในรายการ → วันครบกำหนดของงาน (trigger) — ฟอร์มบอกก่อนกดว่าวันจะเปลี่ยนจากไหนเป็นไหน
// แก้/ลบของตัวเองได้ 24 ชม. · แก้วันได้เฉพาะรายการล่าสุด · ลบรายการล่าสุด = วันกลับเป็นวันเดิม
// ติ๊กผิดประเภท → ลบแล้วเพิ่มใหม่ (วันครบกำหนดกลับให้เองตอนลบ)

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { Button, DatePicker, Field, ImageDropzone, Input, Textarea, TimePicker, useConfirm } from '@/components/aoo'
import { useToast } from '@/hooks/useToast'
import { toYmd } from '@/lib/push/notify'
import {
  addTaskUpdate,
  deleteTaskUpdate,
  editTaskUpdate,
  editTaskUpdateBody,
  deleteTaskImage,
  getTaskUpdates,
  reorderTaskImages,
  type TaskPerson,
  type TaskUpdate,
} from '@/lib/services/taskService'
import {
  addDaysYmd,
  DATE_REQUIRED,
  FOLLOW_UP_DAYS,
  KIND_EMOJI,
  KIND_LABEL,
  shortTime,
  thaiDay,
  waitingText,
  WAITING_PRESETS,
  type ManualUpdateKind,
} from '@/lib/tasks/updates'

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000

interface Draft {
  kind: ManualUpdateKind
  waitingFor: string
  /** กด "อื่น ๆ" แล้วพิมพ์เอง */
  customWaiting: boolean
  waitingOn: string
  body: string
  eventDate: string
  eventTime: string
}

const emptyDraft = (kind: ManualUpdateKind, prev?: TaskUpdate): Draft => ({
  kind,
  waitingFor: kind === 'waiting' ? WAITING_PRESETS[0] : '',
  customWaiting: false,
  // รอเรื่องใหม่จากคนเดิมบ่อย — เติมชื่อคนที่รอครั้งก่อนให้
  waitingOn: kind === 'waiting' ? prev?.waitingOn ?? '' : '',
  body: '',
  eventDate: '',
  eventTime: '',
})

const draftFrom = (u: TaskUpdate): Draft => ({
  kind: u.kind as ManualUpdateKind,
  waitingFor: u.waitingFor ?? '',
  customWaiting: !!u.waitingFor && !(WAITING_PRESETS as readonly string[]).includes(u.waitingFor),
  waitingOn: u.waitingOn ?? '',
  body: u.body,
  eventDate: u.eventDate ?? '',
  eventTime: shortTime(u.eventTime),
})

export default function TaskTimeline({
  taskId,
  userId,
  isAdmin,
  canEdit,
  people,
  dueDate,
  onChanged,
  footerSlot,
  onComposingChange,
}: {
  taskId: string
  userId: string
  isAdmin: boolean
  /** เพิ่มรายการได้ — แอดมิน · คนสร้าง · ผู้รับผิดชอบ */
  canEdit: boolean
  people: TaskPerson[]
  /** วันครบกำหนดตอนนี้ — โชว์ว่าจะเปลี่ยนเป็นวันไหน */
  dueDate: string | null
  /** มีรายการเปลี่ยน — วันครบกำหนด/สถานะของงานอาจเปลี่ยนตาม */
  onChanged: () => void
  /** ท้ายหน้าต่าง — ปุ่มยกเลิก/บันทึกของฟอร์มไปอยู่ตรงนั้น ตำแหน่งเดียวกับแท็บรายละเอียด */
  footerSlot?: HTMLElement | null
  /** เปิด/ปิดฟอร์ม — แม่ใช้ตัดสินว่าจะโชว์ท้ายหน้าต่างไหม */
  onComposingChange?: (composing: boolean) => void
}) {
  const { showToast } = useToast()
  const { confirm, dialog } = useConfirm()
  const [items, setItems] = useState<TaskUpdate[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  /** แก้รายการไหนอยู่ (null = เพิ่มใหม่) */
  const [editing, setEditing] = useState<TaskUpdate | null>(null)
  /** รูปที่เลือกไว้ในฟอร์ม (ยังไม่อัป) — url เป็น blob: ไว้โชว์ตัวอย่าง */
  const [files, setFiles] = useState<{ id: string; file: File; url: string }[]>([])
  const [busy, setBusy] = useState(false)
  /** แก้เหตุผลของรายการเลื่อนวัน (แก้ในบรรทัด) */
  const [reason, setReason] = useState<{ id: string; body: string } | null>(null)

  const load = () =>
    getTaskUpdates(taskId)
      .then(setItems)
      .catch((e) => showToast(e.message, 'error'))

  useEffect(() => {
    load()
  }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  const composing = !!draft
  useEffect(() => {
    onComposingChange?.(composing)
  }, [composing]) // eslint-disable-line react-hooks/exhaustive-deps

  const latest = items?.[0]
  const waitingNow = latest && (latest.kind === 'waiting' || latest.kind === 'follow_up') ? latest : null
  const lastWaiting = items?.find((u) => u.kind === 'waiting')
  const name = (id: string | null) => people.find((p) => p.userId === id)?.name ?? 'ระบบ'
  const mine = (u: TaskUpdate) =>
    isAdmin || (u.createdBy === userId && Date.now() - new Date(u.createdAt).getTime() < EDIT_WINDOW_MS)

  // ฟอร์มเปิดค้างไว้ตลอด (เจ้าของ 28 ต.ค. 69: กดปุ่มแล้วหน้าต่างยืด/หดไปมาจนงง)
  // เริ่มที่ "ตามแล้ว ยังรออยู่" ถ้างานกำลังรอเขาอยู่ · ไม่งั้นเริ่มที่ "รอเขา"
  const defaultKind: ManualUpdateKind = waitingNow ? 'follow_up' : 'waiting'
  useEffect(() => {
    if (canEdit && items && !draft) setDraft(emptyDraft(defaultKind, lastWaiting))
  }, [canEdit, items, draft]) // eslint-disable-line react-hooks/exhaustive-deps

  /** เปลี่ยนประเภท — ข้อความกับรูปที่พิมพ์/เลือกไว้แล้วไม่หาย */
  const switchKind = (kind: ManualUpdateKind) =>
    setDraft((d) => ({ ...emptyDraft(kind, lastWaiting), body: d?.body ?? '' }))

  const close = () => {
    setDraft(null) // effect ด้านบนตั้งฟอร์มว่างให้ใหม่ ตามสถานะล่าสุด
    setEditing(null)
    files.forEach((f) => URL.revokeObjectURL(f.url))
    setFiles([])
  }
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  // แก้รายการเก่า (ไม่ใช่ล่าสุด) เปลี่ยนวันไม่ได้ — กันที่ trigger ด้วย
  const dateLocked = !!editing && editing.id !== latest?.id
  const today = toYmd(new Date())
  const dueFrom = editing ? editing.oldDue : dueDate
  const dueWillChange = !!draft?.eventDate && !dateLocked && draft.eventDate !== (editing ? editing.eventDate : dueDate)

  const valid =
    !!draft &&
    (!DATE_REQUIRED[draft.kind] || !!draft.eventDate) &&
    (draft.kind !== 'waiting' || !!draft.waitingFor.trim()) &&
    (draft.kind !== 'note' || !!draft.body.trim() || files.length > 0)

  const save = async () => {
    if (!draft || !valid) return
    setBusy(true)
    try {
      const input = {
        kind: draft.kind,
        waitingFor: draft.waitingFor,
        waitingOn: draft.waitingOn,
        body: draft.body,
        eventDate: draft.eventDate || null,
        eventTime: draft.eventTime || null,
      }
      if (editing) {
        await editTaskUpdate(editing.id, input)
      } else {
        const failed = await addTaskUpdate(taskId, input, userId, files.map((f) => f.file))
        if (failed) showToast(`อัปโหลดรูปไม่สำเร็จ ${failed} รูป`, 'error')
      }
      close()
      await load()
      onChanged()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (u: TaskUpdate) => {
    const revertsDue = u.id === latest?.id && !!u.newDue && u.kind !== 'due_change'
    const ok = await confirm({
      title: 'ลบรายการนี้?',
      description: revertsDue
        ? `วันครบกำหนดจะกลับเป็น ${u.oldDue ? thaiDay(u.oldDue) : 'ไม่มีกำหนด'} เหมือนก่อนบันทึก`
        : u.images.length
          ? `รูป ${u.images.length} รูปในรายการนี้จะถูกลบด้วย`
          : undefined,
      confirmLabel: 'ลบ',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteTaskUpdate(u)
      if (editing?.id === u.id) close()
      await load()
      onChanged()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const saveReason = async () => {
    if (!reason) return
    setBusy(true)
    try {
      await editTaskUpdateBody(reason.id, reason.body)
      setReason(null)
      await load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const dateChips = (
    <div className="aoo-chips">
      {FOLLOW_UP_DAYS.map((n) => {
        const d = addDaysYmd(today, n)
        return (
          <button
            key={n}
            type="button"
            className="aoo-chip"
            aria-pressed={draft?.eventDate === d}
            disabled={dateLocked}
            onClick={() => set({ eventDate: d })}
          >
            {n === 1 ? 'พรุ่งนี้' : n === 7 ? '1 สัปดาห์' : `${n} วัน`}
          </button>
        )
      })}
    </div>
  )

  return (
    <div>
      {draft && (
        <div className="aoo-timeline__composer">
          {editing ? (
            <h3 className="aoo-timeline__composer-title">
              {KIND_EMOJI[draft.kind]} แก้: {KIND_LABEL[draft.kind]}
            </h3>
          ) : (
            <Field label="บันทึกอะไร" asDiv>
              <div className="aoo-chips">
                {(['follow_up', 'waiting', 'appointment', 'note'] as const)
                  .filter((k) => k !== 'follow_up' || waitingNow)
                  .map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="aoo-chip"
                      aria-pressed={draft.kind === k}
                      onClick={() => switchKind(k)}
                    >
                      {KIND_EMOJI[k]} {KIND_LABEL[k]}
                    </button>
                  ))}
              </div>
              {draft.kind === 'follow_up' && waitingNow && (
                <p className="aoo-timeline__kind-note">กำลังรอ: {waitingText(waitingNow)}</p>
              )}
            </Field>
          )}

          {draft.kind === 'waiting' && (
            <>
              <Field label="รออะไร" required asDiv>
                <div className="aoo-chips">
                  {WAITING_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="aoo-chip"
                      aria-pressed={!draft.customWaiting && draft.waitingFor === p}
                      onClick={() => set({ waitingFor: p, customWaiting: false })}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="aoo-chip"
                    aria-pressed={draft.customWaiting}
                    onClick={() => set({ waitingFor: '', customWaiting: true })}
                  >
                    อื่น ๆ…
                  </button>
                </div>
                {draft.customWaiting && (
                  <Input
                    className="mt-2"
                    value={draft.waitingFor}
                    onChange={(e) => set({ waitingFor: e.target.value })}
                    placeholder="เช่น รอเขาโอนมัดจำ"
                    autoFocus
                  />
                )}
              </Field>
              <Field label="รอใคร">
                <Input
                  value={draft.waitingOn}
                  onChange={(e) => set({ waitingOn: e.target.value })}
                  placeholder="เช่น ผู้รับเหมา · พี่ตุ้ม · ฝ่ายบัญชี Hape"
                />
              </Field>
            </>
          )}

          {(draft.kind === 'waiting' || draft.kind === 'follow_up') && (
            <Field label="ตามอีกทีวันที่" required asDiv>
              {dateChips}
              <DatePicker
                className="mt-2"
                value={draft.eventDate}
                onChange={(v) => set({ eventDate: v })}
                min={today}
                disabled={dateLocked}
                placeholder="หรือเลือกวัน"
              />
            </Field>
          )}

          {draft.kind === 'appointment' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="วันนัด" required asDiv>
                <DatePicker value={draft.eventDate} onChange={(v) => set({ eventDate: v })} disabled={dateLocked} />
              </Field>
              <Field label="เวลา" asDiv>
                <TimePicker value={draft.eventTime || null} onChange={(v) => set({ eventTime: v })} placeholder="ไม่ระบุ" />
              </Field>
            </div>
          )}

          {draft.kind === 'note' && (
            <Field label="วันทำขั้นถัดไป" help="ใส่ถ้ามี — จะเป็นวันครบกำหนดใหม่" asDiv>
              <DatePicker
                value={draft.eventDate}
                onChange={(v) => set({ eventDate: v })}
                disabled={dateLocked}
                placeholder="ไม่มี"
              />
            </Field>
          )}

          <Field
            label={
              draft.kind === 'appointment' ? 'นัดกับใคร / ที่ไหน' : draft.kind === 'note' ? 'เกิดอะไรขึ้น' : 'รายละเอียด'
            }
            required={draft.kind === 'note' && files.length === 0}
          >
            <Textarea
              value={draft.body}
              onChange={(e) => set({ body: e.target.value })}
              rows={2}
              placeholder={
                draft.kind === 'note'
                  ? 'เช่น ได้ใบเสนอราคาแล้ว 45,000 · เจอแล้ว ตกลงเริ่ม 10 พ.ย.'
                  : draft.kind === 'follow_up'
                    ? 'เช่น โทรไปแล้ว เขาบอกขอเช็คอีกที'
                    : 'ไม่บังคับ'
              }
            />
          </Field>

          {!editing && (
            <ImageDropzone
              size="sm"
              label="แนบรูป — ลากมาวาง หรือกดเลือก"
              items={files.map((f) => ({ id: f.id, url: f.url }))}
              onFilesPicked={(list) =>
                setFiles((cur) => [
                  ...cur,
                  ...list.map((file, i) => ({ id: `f-${Date.now()}-${i}`, file, url: URL.createObjectURL(file) })),
                ])
              }
              onRemove={(id) => setFiles((cur) => cur.filter((f) => f.id !== id))}
              onReorder={(ids) => setFiles((cur) => ids.map((id) => cur.find((f) => f.id === id)!))}
            />
          )}

          {dueWillChange && (
            <p className="aoo-timeline__due-note">
              ⚠ วันครบกำหนดจะเปลี่ยน {dueFrom ? thaiDay(dueFrom) : 'ไม่มีกำหนด'} → {thaiDay(draft.eventDate)}
            </p>
          )}
          {dateLocked && <p className="text-sm text-gray-500">รายการเก่าแก้ได้แค่ข้อความ — วันที่แก้ได้เฉพาะรายการล่าสุด</p>}

          {footerSlot &&
            createPortal(
              <>
                {editing && (
                  <Button variant="ghost" onClick={close} disabled={busy}>
                    ยกเลิกแก้ไข
                  </Button>
                )}
                <Button onClick={save} loading={busy} disabled={!valid}>
                  {editing ? 'บันทึกการแก้ไข' : 'บันทึก'}
                </Button>
              </>,
              footerSlot
            )}
        </div>
      )}

      {items && items.length > 0 && (
        <section className={canEdit || draft ? 'aoo-timeline__history' : undefined}>
        <h4 className="aoo-timeline__history-title">ประวัติ ({items.length})</h4>
        <ul className="aoo-timeline">
          {items.map((u) => (
            <li key={u.id} className="aoo-timeline__item">
              <span className="aoo-timeline__emoji">{KIND_EMOJI[u.kind]}</span>
              <div className="aoo-timeline__main">
                <span className="aoo-timeline__head">{headOf(u)}</span>
                {reason?.id === u.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={reason.body}
                      onChange={(e) => setReason({ id: u.id, body: e.target.value })}
                      placeholder="เหตุผลที่เลื่อน"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={() => setReason(null)} disabled={busy}>
                      ยกเลิก
                    </Button>
                    <Button size="sm" onClick={saveReason} loading={busy}>
                      บันทึก
                    </Button>
                  </div>
                ) : (
                  u.body && <span className="aoo-timeline__body">{u.body}</span>
                )}
                {u.images.length > 0 && (
                  <TimelineImages u={u} editable={mine(u)} onChanged={load} />
                )}
                <span className="aoo-timeline__meta">
                  <span>
                    {name(u.createdBy)} · {thaiDay(toYmd(new Date(u.createdAt)))}{' '}
                    {new Date(u.createdAt).toTimeString().slice(0, 5)}
                  </span>
                  {mine(u) && !editing && !reason && (
                    <>
                      <button
                        type="button"
                        className="aoo-timeline__link"
                        onClick={() => {
                          if (u.kind === 'due_change') return setReason({ id: u.id, body: u.body })
                          setEditing(u)
                          setFiles([])
                          setDraft(draftFrom(u))
                        }}
                      >
                        แก้
                      </button>
                      <button type="button" className="aoo-timeline__link" onClick={() => remove(u)}>
                        ลบ
                      </button>
                    </>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
        </section>
      )}
      {items?.length === 0 && !canEdit && (
        <p className="mt-3 text-sm text-gray-500">
          {canEdit ? 'ยังไม่มีความคืบหน้า — ติดรอใครอยู่กด "รอเขา" แล้วใส่วันตามอีกที ระบบจะเตือนให้' : 'ยังไม่มีความคืบหน้า'}
        </p>
      )}
      {dialog}
    </div>
  )
}

/** หัวรายการ — ส่วนที่บอกว่า "เกิดอะไร/รออะไร/วันไหน" */
function headOf(u: TaskUpdate) {
  switch (u.kind) {
    case 'waiting':
      return `${waitingText(u)} · ตาม ${thaiDay(u.eventDate!)}`
    case 'follow_up':
      return `ตามแล้ว ยังรออยู่ · ตามอีกที ${thaiDay(u.eventDate!)}`
    case 'appointment':
      return `นัด ${thaiDay(u.eventDate!)}${u.eventTime ? ` ${shortTime(u.eventTime)}` : ''}`
    case 'note':
      return u.eventDate ? `อัปเดต · ขั้นถัดไป ${thaiDay(u.eventDate)}` : 'อัปเดต'
    case 'due_change':
      return (
        <span className="aoo-timeline__dates">
          เลื่อนวัน {u.oldDue ? thaiDay(u.oldDue) : 'ไม่มีกำหนด'} <ArrowRight size={12} />{' '}
          {u.newDue ? thaiDay(u.newDue) : 'ไม่มีกำหนด'}
        </span>
      )
  }
}

/** รูปในรายการ — เจ้าของรายการ (24 ชม.) ลากเรียง/ลบได้ · คนอื่นดูอย่างเดียว */
function TimelineImages({ u, editable, onChanged }: { u: TaskUpdate; editable: boolean; onChanged: () => void }) {
  const { showToast } = useToast()
  const act = (fn: () => Promise<void>) => fn().then(onChanged, (e) => showToast((e as Error).message, 'error'))
  return (
    <ImageDropzone
      size="sm"
      items={u.images.map((i) => ({ id: i.id, url: i.url }))}
      readOnly={!editable}
      onReorder={(ids) => act(() => reorderTaskImages(ids))}
      onRemove={(id) => act(() => deleteTaskImage(u.images.find((i) => i.id === id)!))}
    />
  )
}
