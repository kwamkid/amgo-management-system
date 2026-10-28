'use client'

// งานของทีม — บอร์ดแบบ TaskSuke · ทุกคนเห็นทุกงาน (เจ้าของสั่ง 28 ต.ค. 69) กรองตามคน/แบรนด์/คำค้นได้
// แก้ได้: แอดมินทุกอย่าง · คนสร้างแก้งานตัวเอง · ผู้รับผิดชอบแก้สถานะ/โน้ต/รูป (กันซ้ำที่ RLS + trigger)
// แบรนด์ = ชื่อโฟลเดอร์ใน AGD (hape · abcthebaby …) พิมพ์แบรนด์ใหม่ได้ในช่องเลือก
// เพิ่มงาน = ปุ่ม → modal เดียวกับหน้าแก้ไข (เจ้าของขอ 28 ต.ค. 69 แทนแถวพิมพ์ด่วน)

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { AlarmClock, AlertTriangle, FileText, History, ListChecks, ListTodo } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import {
  Button,
  DatePicker,
  DateRangePicker,
  Field,
  Input,
  Modal,
  SelectMenu,
  StepSelect,
  TabBar,
  TabItem,
  RichText,
  RichTextEditor,
  type DateRangeValue,
  type SelectOption,
} from '@/components/aoo'
import { BrandLogo, FilterBar, FilterSelect, PageHeader, Segmented, TechLoader, UserAvatar } from '@/components/shared'
import AssigneePicker from '@/components/tasks/AssigneePicker'
import TaskBoard from '@/components/tasks/TaskBoard'
import TaskImages from '@/components/tasks/TaskImages'
import TaskTimeline from '@/components/tasks/TaskTimeline'
import { STATUS_ICON, STATUS_TONE } from '@/components/tasks/taskUi'
import {
  createTask,
  deleteTask,
  getTaskDueStatus,
  getTaskPeople,
  getTasks,
  normalizeBrand,
  setTaskAssignees,
  TASK_COLUMNS,
  updateTask,
  type Task,
  type TaskPerson,
  type TaskStatus,
} from '@/lib/services/taskService'
import { BRANDS, brandLabel } from '@/lib/constants/brands'
import { statusLineText } from '@/lib/tasks/updates'
import { isRichTextEmpty, richTextToPlain, sanitizeRichText } from '@/lib/utils/richText'


/** ปุ่มกรองด่วนตามวันครบกำหนด (งานที่ยังไม่เสร็จ) · "ใกล้" = วันนี้ถึงอีก 3 วัน */
type DueFilter = 'any' | 'soon' | 'overdue'
const SOON_DAYS = 3

function dueIn(t: Task): number | null {
  return t.dueDate && t.status !== 'done' ? differenceInCalendarDays(parseISO(t.dueDate), new Date()) : null
}
const isOverdue = (t: Task) => (dueIn(t) ?? 0) < 0
const isSoon = (t: Task) => {
  const d = dueIn(t)
  return d !== null && d >= 0 && d <= SOON_DAYS
}

export default function TasksPage() {
  const { userData } = useAuth()
  const { showToast } = useToast()
  const me = userData?.id
  const isAdmin = userData?.role === 'admin'

  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [people, setPeople] = useState<TaskPerson[]>([])
  const [q, setQ] = useState('')
  // แท็บ "งานของฉัน" = งานที่ตัวเองรับผิดชอบ (รวมงานที่สร้างเองแต่ยังไม่มีคนรับ) · จำแท็บล่าสุดไว้ในเครื่อง
  const [tab, setTab] = useState<'mine' | 'all'>(() => {
    try {
      return localStorage.getItem('tasks.tab') === 'all' ? 'all' : 'mine'
    } catch {
      return 'mine'
    }
  })
  const [person, setPerson] = useState<string | null>(null)
  const [brand, setBrand] = useState<string | null>(null)
  const [range, setRange] = useState<DateRangeValue>(null)
  const [dueFilter, setDueFilter] = useState<DueFilter>('any')
  /** null = ปิด · 'new' = สร้างงาน · Task = แก้งาน */
  const [modal, setModal] = useState<Task | 'new' | null>(null)
  const [extraBrands, setExtraBrands] = useState<string[]>([])

  const load = useCallback(async () => {
    try {
      const ppl = await getTaskPeople()
      setPeople(ppl)
      setTasks(await getTasks(ppl))
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (me) load()
  }, [me, load])

  // ลิงก์จากแจ้งเตือน /tasks?task=<id> → เปิดงานนั้นเลย (ครั้งเดียวตอนโหลดเสร็จ)
  const [deepLinked, setDeepLinked] = useState(false)
  useEffect(() => {
    if (!tasks || deepLinked) return
    setDeepLinked(true)
    const id = new URLSearchParams(window.location.search).get('task')
    const hit = id && tasks.find((t) => t.id === id)
    if (hit) setModal(hit)
  }, [tasks, deepLinked])

  const brandOptions: SelectOption[] = useMemo(() => {
    const used = (tasks ?? []).map((t) => t.brand).filter((b): b is string => !!b)
    // แบรนด์บริษัทก่อน (เลือกได้แม้ยังไม่มีงาน) แล้วต่อด้วยแบรนด์ที่พิมพ์เพิ่มเอง
    const extra = [...new Set([...extraBrands, ...used])].filter((b) => !BRANDS.some((x) => x.slug === b)).sort()
    return [...BRANDS.map((b) => b.slug), ...extra].map((b) => ({
      value: b,
      label: brandLabel(b),
      icon: <BrandLogo brand={b} />,
    }))
  }, [tasks, extraBrands])

  const personOptions: SelectOption[] = useMemo(() => {
    const mine = people.find((p) => p.userId === me)
    const ordered = mine ? [{ ...mine, name: `ฉัน (${mine.name})` }, ...people.filter((p) => p !== mine)] : people
    return ordered.map((p) => ({
      value: p.userId,
      label: p.name,
      icon: <UserAvatar userId={p.userId} name={p.name} size="xs" />,
    }))
  }, [people, me])

  const isMine = useCallback(
    (t: Task) => (t.assignees.length ? t.assignees.some((a) => a.userId === me) : t.createdBy === me),
    [me]
  )

  const switchTab = (t: 'mine' | 'all') => {
    setTab(t)
    try {
      localStorage.setItem('tasks.tab', t)
    } catch {}
  }

  // ขอบเขต (แท็บ + คน + แบรนด์ + คำค้น + ช่วงวัน) — ปุ่มใกล้/เลยกำหนดนับจากชุดนี้
  const scoped = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (tasks ?? []).filter(
      (t) =>
        (tab === 'all' || isMine(t)) &&
        (!range || (!!t.dueDate && t.dueDate >= range.since && t.dueDate <= range.until)) &&
        (tab === 'mine' || !person || t.assignees.some((a) => a.userId === person)) &&
        (!brand || t.brand === brand) &&
        (!needle || `${t.title} ${richTextToPlain(t.notes)} ${t.sourceRef ?? ''}`.toLowerCase().includes(needle))
    )
  }, [tasks, tab, isMine, person, brand, q, range])

  const visible = useMemo(
    () => (dueFilter === 'soon' ? scoped.filter(isSoon) : dueFilter === 'overdue' ? scoped.filter(isOverdue) : scoped),
    [scoped, dueFilter]
  )

  const canEdit = (t: Task) => isAdmin || t.createdBy === me || t.assignees.some((a) => a.userId === me)

  const createBrand = (label: string) => {
    const b = normalizeBrand(label)
    if (b) setExtraBrands((prev) => [...prev, b])
    return b
  }

  const move = (id: string, status: TaskStatus, sortOrder: number) => {
    const task = tasks?.find((t) => t.id === id)
    // RLS ไม่ error ตอนแก้แถวที่ไม่มีสิทธิ์ (แค่ได้ 0 แถว) — ต้องเช็คเอง ไม่งั้นการ์ดย้ายหลอก ๆ
    if (!task || !canEdit(task)) {
      showToast('ย้ายได้เฉพาะงานที่ตัวเองสร้างหรือรับผิดชอบ', 'error')
      setTasks((prev) => (prev ? [...prev] : prev))
      return
    }
    setTasks((prev) =>
      prev?.map((t) =>
        t.id === id
          ? { ...t, status, sortOrder, doneAt: status === 'done' ? t.doneAt ?? new Date().toISOString() : null }
          : t
      ) ?? prev
    )
    updateTask(id, { status, sortOrder }).catch((e) => {
      showToast(e.message, 'error')
      load()
    })
  }

  if (!userData || !tasks || !me) return <TechLoader />

  const openCount = (list: Task[]) => list.filter((t) => t.status !== 'done').length
  const topOfTodo = Math.min(0, ...tasks.filter((x) => x.status === 'todo').map((x) => x.sortOrder)) - 1

  return (
    <div className="space-y-4">
      <PageHeader
        title="งานของทีม"
        description="กดค้างที่การ์ดแล้วลากเพื่อย้ายสถานะหรือเรียงลำดับ · แตะการ์ดเพื่อดูรายละเอียด"
        icon={ListChecks}
        actions={
          <Button icon="Plus" onClick={() => setModal('new')}>
            เพิ่มงาน
          </Button>
        }
      />

      <TabBar ariaLabel="ขอบเขตงาน">
        <TabItem
          active={tab === 'mine'}
          onClick={() => switchTab('mine')}
          label={`งานของฉัน (${openCount(tasks.filter(isMine))})`}
        />
        <TabItem active={tab === 'all'} onClick={() => switchTab('all')} label={`งานทั้งหมด (${openCount(tasks)})`} />
      </TabBar>

      <FilterBar
        search={q}
        onSearch={setQ}
        placeholder="ค้นหางาน"
        sticky={false}
        activeCount={[tab === 'all' && person, brand, range, dueFilter !== 'any'].filter(Boolean).length}
      >
        {tab === 'all' && (
          <FilterSelect label="คน" value={person} options={personOptions} onChange={setPerson} width={180} />
        )}
        <FilterSelect label="แบรนด์" value={brand} options={brandOptions} onChange={setBrand} />
        <DateRangePicker value={range} onChange={setRange} placeholder="ครบกำหนดช่วงไหน" clearable aria-label="ช่วงวันครบกำหนด" />
        <Segmented
          value={dueFilter}
          onChange={(v) => setDueFilter(v as DueFilter)}
          options={[
            { value: 'any', label: 'ทั้งหมด', icon: ListTodo },
            { value: 'soon', label: `ใกล้ครบกำหนด (${scoped.filter(isSoon).length})`, icon: AlarmClock },
            { value: 'overdue', label: `เลยกำหนด (${scoped.filter(isOverdue).length})`, icon: AlertTriangle },
          ]}
        />
      </FilterBar>

      <TaskBoard tasks={visible} onMove={move} onOpen={setModal} />

      {modal && (
        <TaskModal
          // สร้างใหม่: ติดแบรนด์ที่กำลังกรองอยู่มาให้ (น่าจะหมายถึงแบรนด์นั้น)
          task={modal === 'new' ? null : modal}
          defaultBrand={brand}
          sortOrder={topOfTodo}
          userId={me}
          people={people}
          brandOptions={brandOptions}
          onCreateBrand={createBrand}
          isAdmin={isAdmin}
          canEditDetails={modal === 'new' || isAdmin || modal.createdBy === me}
          canEdit={modal === 'new' || canEdit(modal)}
          onClose={(changed) => {
            setModal(null)
            if (changed) load()
          }}
        />
      )}
    </div>
  )
}

function TaskModal({
  task,
  defaultBrand,
  sortOrder,
  userId,
  people,
  brandOptions,
  onCreateBrand,
  isAdmin,
  canEditDetails,
  canEdit,
  onClose,
}: {
  /** null = สร้างงานใหม่ */
  task: Task | null
  defaultBrand: string | null
  /** ลำดับของงานใหม่ — บนสุดของคอลัมน์ต้องทำ */
  sortOrder: number
  userId: string
  people: TaskPerson[]
  brandOptions: SelectOption[]
  onCreateBrand: (label: string) => string | null
  isAdmin: boolean
  /** ชื่อ/แบรนด์/วันที่ — แอดมินกับคนสร้าง */
  canEditDetails: boolean
  /** สถานะ/โน้ต/รูป — รวมผู้รับผิดชอบ */
  canEdit: boolean
  onClose: (changed: boolean) => void
}) {
  const { showToast } = useToast()
  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [brand, setBrand] = useState<string | null>(task ? task.brand : defaultBrand)
  const [due, setDue] = useState(task?.dueDate ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo')
  const [dueReason, setDueReason] = useState('')
  // วันครบกำหนดใน DB ตอนนี้ — ไทม์ไลน์เปลี่ยนได้ระหว่างเปิดหน้าต่างนี้
  const [savedDue, setSavedDue] = useState(task?.dueDate ?? null)
  const dueMoved = !!task && (due || null) !== savedDue
  const [assignees, setAssignees] = useState<string[]>(task ? task.assignees.map((a) => a.userId) : [userId])
  const [busy, setBusy] = useState(false)
  const [changed, setChanged] = useState(false)
  // เปิดงานส่วนใหญ่เพื่อดูว่าต้องทำอะไร → แท็บรายละเอียดก่อน · ไทม์ไลน์แยกแท็บ หน้าต่างไม่ยาวเกิน
  const [tab, setTab] = useState<'detail' | 'progress'>('detail')
  // ฟอร์มในแท็บความคืบหน้าส่งปุ่มบันทึกมาไว้ท้ายหน้าต่าง (portal) — ปุ่มอยู่ที่เดียวกันทั้งสองแท็บ
  const [composing, setComposing] = useState(false)
  const [footerSlot, setFooterSlot] = useState<HTMLDivElement | null>(null)
  // หัวหน้าต่างยืดตามชื่องานยาว ๆ — field-sizing ยังไม่ครบทุกเบราว์เซอร์ (Safari เก่า) จึงตั้งความสูงเอง
  const titleRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [title])

  const syncFromTimeline = async () => {
    setChanged(true)
    if (!task) return
    try {
      const fresh = await getTaskDueStatus(task.id)
      setSavedDue(fresh.dueDate)
      setDue(fresh.dueDate ?? '')
      setStatus(fresh.status)
    } catch {}
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      onClose(true)
    } catch (e) {
      showToast((e as Error).message, 'error')
      setBusy(false)
    }
  }

  const cleanNotes = isRichTextEmpty(notes) ? '' : sanitizeRichText(notes)

  const save = () =>
    run(async () => {
      if (!task) {
        await createTask(
          // พนักงานมอบได้แค่ตัวเอง — ช่องคนล็อกไว้ที่ตัวเองอยู่แล้ว
          { title: title.trim(), notes: cleanNotes, dueDate: due || null, brand, sortOrder, assigneeIds: isAdmin ? assignees : [userId] },
          userId
        )
        return
      }
      await updateTask(task.id, {
        notes: cleanNotes,
        status,
        // ผู้รับผิดชอบเลื่อนวันได้ (มีประวัติ) · ชื่อ/แบรนด์ เฉพาะแอดมินกับคนสร้าง
        ...(dueMoved && { dueDate: due || null, dueReason }),
        ...(canEditDetails && { title: title.trim() || task.title, brand }),
      })
      if (isAdmin) await setTaskAssignees(task.id, task.assignees.map((a) => a.userId), assignees)
    })

  return (
    <Modal
      open
      onClose={() => onClose(changed)}
      // งานที่มีอยู่: ชื่องานเป็นหัวหน้าต่าง แก้ได้ตรงนั้นเลย (เจ้าของ 28 ต.ค. 69)
      title={
        task ? (
          <textarea
            ref={titleRef}
            className="aoo-title-input"
            rows={1}
            value={title}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
            disabled={!canEditDetails}
            aria-label="ชื่องาน"
            placeholder="ชื่องาน"
          />
        ) : (
          'เพิ่มงาน'
        )
      }
      description={task?.sourceRef ?? undefined}
      maxWidth={560}
      footer={
        tab === 'progress' ? (
          composing ? <div ref={setFooterSlot} className="contents" /> : undefined
        ) : canEdit ? (
          <>
            {task && canEditDetails && (
              <Button
                variant="danger"
                icon="Trash2"
                className="mr-auto"
                disabled={busy}
                onClick={() => run(() => deleteTask(task.id))}
              >
                ลบ
              </Button>
            )}
            <Button onClick={save} loading={busy} disabled={!title.trim()}>
              {task ? 'บันทึก' : 'เพิ่มงาน'}
            </Button>
          </>
        ) : undefined
      }
    >
      {task && (
        <Segmented
          className="aoo-task-modal__tabs"
          value={tab}
          onChange={(v) => setTab(v as 'detail' | 'progress')}
          options={[
            { value: 'detail', label: 'รายละเอียด', icon: FileText },
            { value: 'progress', label: 'ความคืบหน้า', icon: History },
          ]}
        />
      )}

      {tab === 'progress' && task ? (
        <TaskTimeline
          taskId={task.id}
          userId={userId}
          isAdmin={isAdmin}
          canEdit={canEdit}
          people={people}
          dueDate={savedDue}
          onChanged={syncFromTimeline}
          footerSlot={footerSlot}
          onComposingChange={setComposing}
        />
      ) : (
        <div className="space-y-3">
          {!task && (
            <Field label="ชื่องาน" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="ทำอะไร" />
            </Field>
          )}
          <Field label="รายละเอียดงาน" asDiv>
            {canEdit ? (
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                minHeight={72}
                placeholder="ต้องทำอะไร · ข้อมูลที่ต้องรู้ — ความคืบหน้าบันทึกในแท็บความคืบหน้า"
              />
            ) : isRichTextEmpty(notes) ? (
              <p className="text-sm text-gray-500">ไม่มีรายละเอียด</p>
            ) : (
              <RichText html={notes} />
            )}
          </Field>
          {task && (
            <Field label="สถานะ" asDiv>
              <StepSelect
                aria-label="สถานะ"
                value={status}
                onChange={(v) => setStatus(v as TaskStatus)}
                disabled={!canEdit}
                options={TASK_COLUMNS.map((c) => ({
                  value: c.status,
                  label: c.label,
                  icon: STATUS_ICON[c.status],
                  tone: STATUS_TONE[c.status],
                }))}
              />
            </Field>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="แบรนด์" asDiv>
              <SelectMenu
                size="md"
                value={brand}
                options={brandOptions}
                onChange={setBrand}
                onCreate={(label) => setBrand(onCreateBrand(label))}
                placeholder="ไม่ระบุ"
                clearable="ไม่ระบุแบรนด์"
                disabled={!canEditDetails}
              />
            </Field>
            <Field label="ครบกำหนด" asDiv>
              <DatePicker value={due} onChange={setDue} disabled={!canEdit} placeholder="ไม่มีกำหนด" />
            </Field>
          </div>
          {dueMoved && task?.dueDate && (
            <Field label="เหตุผลที่เลื่อน" help="เก็บเป็นประวัติในแท็บความคืบหน้า ทุกคนเห็น">
              <Input
                value={dueReason}
                onChange={(e) => setDueReason(e.target.value)}
                placeholder="เช่น ติดต่อแล้ว รอเขานัดวันเข้าไปคุย"
              />
            </Field>
          )}
          <Field label="ผู้รับผิดชอบ" asDiv>
            <AssigneePicker people={people} value={assignees} onChange={setAssignees} editable={isAdmin} />
          </Field>
          {task && (
            <Field label="รูป" asDiv>
              <TaskImages taskId={task.id} userId={userId} readOnly={!canEdit} onChanged={() => setChanged(true)} />
            </Field>
          )}
        </div>
      )}
    </Modal>
  )
}
