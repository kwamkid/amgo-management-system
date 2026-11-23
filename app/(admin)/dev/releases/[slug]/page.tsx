'use client'

// รอบงาน (releases) ของโปรเจกต์หนึ่ง — การ์ดรอบพร้อมแถบความคืบหน้า · เลือกรอบ → ลากเคส/บั๊กจาก "ยังไม่อยู่ในรอบ" เข้า "ในรอบนี้"
// (ผู้จัดการ) · แตะการ์ด = เปิดเคส/บั๊กในบอร์ดของมัน · ?r=<release id> เปิดรอบนั้น
// เสร็จ = เคส ผ่าน/ปิดแล้ว · บั๊ก ปิดแล้ว/ไม่แก้

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bug, CalendarDays, CheckCircle2, FlaskConical, Inbox, Pencil, Plus, Rocket, Search, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Card, ConfirmDialog, DatePicker, EmptyState, Field, Input, Modal, Pill, Progress, StepSelect, Textarea } from '@/components/aoo'
import { PageHeader, TechLoader } from '@/components/shared'
import DevKanban, { type KanbanColumn } from '@/components/dev/DevKanban'
import { BUG_STATUS_LABELS, BUG_STATUS_TONE, bugCode, type BugStatus } from '@/lib/dev/bugs'
import { STATUS_LABELS, STATUS_TONE, uatCode, type DevProject, type UatStatus } from '@/lib/dev/uat'
import {
  itemDone,
  RELEASE_STATUS_LABELS,
  RELEASE_STATUS_TONE,
  RELEASE_STATUSES,
  releaseProgress,
  type DevRelease,
  type ReleaseItem,
  type ReleaseStatus,
} from '@/lib/dev/releases'
import { getDevProject } from '@/lib/services/devService'
import { createRelease, deleteRelease, getReleaseItems, getReleases, setItemRelease, updateRelease, type ReleaseInput } from '@/lib/services/devReleaseService'

type Col = 'out' | 'in'
const STEP_TONE = { planned: 'sky', active: 'warning', released: 'success' } as const
const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : null)

export default function DevReleasesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const { userData, loading } = useAuth()
  const { showToast } = useToast()
  const me = userData?.id
  const isAdmin = userData?.role === 'admin'

  const [project, setProject] = useState<DevProject | null | undefined>(undefined)
  const [releases, setReleases] = useState<DevRelease[] | null>(null)
  const [items, setItems] = useState<ReleaseItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<DevRelease | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    if (!me) return
    try {
      const p = await getDevProject(slug, me, !!isAdmin)
      setProject(p)
      if (!p) return
      const [r, it] = await Promise.all([getReleases(p.id), getReleaseItems(p.id)])
      setReleases(r)
      setItems(it)
      setSelected((cur) => (cur && r.some((x) => x.id === cur) ? cur : new URLSearchParams(window.location.search).get('r') ?? r[0]?.id ?? null))
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }, [me, isAdmin, slug]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  const canManage = project?.myRole === 'manager'
  const release = releases?.find((r) => r.id === selected) ?? null

  // board: this release's items + the open backlog (items of other releases are hidden)
  const boardItems = useMemo(() => {
    if (!release) return []
    const s = q.trim().toLowerCase()
    return items.filter(
      (i) =>
        (i.releaseId === release.id || (i.releaseId === null && !itemDone(i))) &&
        (!s || i.title.toLowerCase().includes(s) || (i.kind === 'case' ? uatCode(i.no) : bugCode(i.no)).toLowerCase().includes(s))
    )
  }, [items, release, q])

  const columns: KanbanColumn<Col>[] = [
    { key: 'out', label: 'ยังไม่อยู่ในรอบไหน', tone: 'neutral', icon: Inbox, lockedText: 'ไม่มีเคส/บั๊กที่ค้างอยู่' },
    { key: 'in', label: release ? `ในรอบ ${release.name}` : 'ในรอบนี้', tone: 'grape', icon: Rocket, lockedText: 'ผู้จัดการเป็นคนจัดเข้ารอบ' },
  ]

  const move = async (id: string, to: Col) => {
    const it = items.find((x) => x.id === id)
    if (!it || !release) return
    const releaseId = to === 'in' ? release.id : null
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, releaseId } : x)))
    try {
      await setItemRelease(it, releaseId)
    } catch (e) {
      showToast((e as Error).message, 'error')
      load()
    }
  }

  const openItem = (i: ReleaseItem) =>
    router.push(i.kind === 'case' ? `/dev/uat/${slug}?case=${i.id}` : `/dev/bugs/${slug}?bug=${i.id}`)

  if (loading || !userData || project === undefined) return <TechLoader />
  if (!project) return <EmptyState icon={<Rocket />} title="ไม่พบโปรเจกต์" body="หรือคุณยังไม่ได้อยู่ในโปรเจกต์นี้" />

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader
        title={project.name}
        description={`Releases · ${releases?.length ?? 0} รอบ`}
        icon={Rocket}
        backHref="/dev/releases"
        actions={canManage ? <Button icon={Plus} onClick={() => setEditing('new')}>สร้างรอบ</Button> : undefined}
      />

      {releases === null ? (
        <TechLoader />
      ) : releases.length === 0 ? (
        <EmptyState icon={<Rocket />} title="ยังไม่มีรอบ" body={canManage ? 'กด สร้างรอบ เช่น "v1.2 ปลาย พ.ย." แล้วลากเคส/บั๊กเข้ามา' : 'ผู้จัดการยังไม่ได้สร้างรอบ'} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {releases.map((r) => {
              const pr = releaseProgress(items, r.id)
              const on = r.id === selected
              return (
                <Card
                  key={r.id}
                  padding={12}
                  hoverable
                  onClick={() => setSelected(r.id)}
                  style={on ? { borderColor: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent)' } : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <strong style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</strong>
                    <Pill tone={RELEASE_STATUS_TONE[r.status]}>{RELEASE_STATUS_LABELS[r.status]}</Pill>
                  </div>
                  <Progress value={pr.done} max={Math.max(pr.total, 1)} tone={r.status === 'released' ? 'success' : 'accent'} />
                  <div style={{ marginTop: 6, fontSize: 'var(--fs-caption)', color: 'var(--fg-3)' }}>
                    เสร็จ {pr.done}/{pr.total}
                    {r.targetDate && ` · เป้า ${fmtDate(r.targetDate)}`}
                  </div>
                </Card>
              )
            })}
          </div>

          {release && (
            <ReleaseHead
              release={release}
              items={items}
              canManage={!!canManage}
              onStatus={async (status) => {
                try {
                  await updateRelease(release.id, { status })
                  load()
                } catch (e) {
                  showToast((e as Error).message, 'error')
                }
              }}
              onEdit={() => setEditing(release)}
              onDelete={() => setConfirmDelete(true)}
              search={<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="เลข / ชื่อ" prefix={<Search size={16} />} />}
            />
          )}

          {release && (
            <div className="min-h-0 flex-1" style={{ minHeight: 320 }}>
              <DevKanban
                items={boardItems}
                columns={columns}
                columnOf={(i) => (i.releaseId === release.id ? 'in' : 'out')}
                canDrop={() => !!canManage}
                lockedColumns={canManage ? [] : ['out', 'in']}
                onReorder={() => {}}
                onDrop={(d) => move(d.id, d.column)}
                onOpen={openItem}
                renderCard={(i, s) => <ItemCard i={i} {...s} />}
              />
            </div>
          )}
        </>
      )}

      {editing && (
        <ReleaseModal
          release={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            if (editing === 'new') {
              const id = await createRelease(project.id, input)
              setSelected(id)
            } else await updateRelease(editing.id, input)
            setEditing(null)
            load()
          }}
        />
      )}
      <ConfirmDialog
        open={confirmDelete && !!release}
        title={`ลบรอบ ${release?.name ?? ''}?`}
        description="เคสและบั๊กในรอบนี้ไม่หาย แค่กลับไปอยู่ ยังไม่อยู่ในรอบไหน"
        confirmLabel="ลบรอบ"
        tone="danger"
        onConfirm={async () => {
          if (!release) return
          try {
            await deleteRelease(release.id)
            setSelected(null)
            load()
          } catch (e) {
            showToast((e as Error).message, 'error')
          }
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function ReleaseHead({
  release,
  items,
  canManage,
  onStatus,
  onEdit,
  onDelete,
  search,
}: {
  release: DevRelease
  items: ReleaseItem[]
  canManage: boolean
  onStatus: (s: ReleaseStatus) => void
  onEdit: () => void
  onDelete: () => void
  search: React.ReactNode
}) {
  const pr = releaseProgress(items, release.id)
  const dates = [fmtDate(release.startDate), fmtDate(release.targetDate)].filter(Boolean).join(' – ')
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--fs-h4)', fontWeight: 700 }}>{release.name}</span>
        {dates && (
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: 'var(--fg-3)', fontSize: 'var(--fs-caption)' }}>
            <CalendarDays size={14} /> {dates}
          </span>
        )}
        {release.releasedAt && <Pill tone="success">ปล่อย {new Date(release.releasedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</Pill>}
        <span style={{ flex: 1 }} />
        {canManage && (
          <>
            <Button variant="ghost" size="sm" icon={Pencil} onClick={onEdit}>แก้รอบ</Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={onDelete}>ลบ</Button>
          </>
        )}
      </div>
      {release.goal && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{release.goal}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Pill tone="sky"><FlaskConical size={12} /> เคส {pr.casesDone}/{pr.cases}</Pill>
        <Pill tone="danger"><Bug size={12} /> บั๊ก {pr.bugsDone}/{pr.bugs}</Pill>
        <Pill tone={pr.total > 0 && pr.done === pr.total ? 'success' : 'neutral'}>
          <CheckCircle2 size={12} /> {pr.total ? Math.round((pr.done / pr.total) * 100) : 0}%
        </Pill>
      </div>
      {canManage && (
        <StepSelect
          value={release.status}
          onChange={(v) => onStatus(v as ReleaseStatus)}
          options={RELEASE_STATUSES.map((s) => ({ value: s, label: RELEASE_STATUS_LABELS[s], tone: STEP_TONE[s] }))}
        />
      )}
      <div>{search}</div>
    </div>
  )
}

function ItemCard({ i, dragging, overlay }: { i: ReleaseItem; dragging?: boolean; overlay?: boolean }) {
  const label = i.kind === 'case' ? STATUS_LABELS[i.status as UatStatus] : BUG_STATUS_LABELS[i.status as BugStatus]
  const tone = i.kind === 'case' ? STATUS_TONE[i.status as UatStatus] : BUG_STATUS_TONE[i.status as BugStatus]
  return (
    <article className="aoo-task-card" data-dragging={dragging || undefined} data-overlay={overlay || undefined} data-done={itemDone(i) || undefined}>
      <div className="aoo-task-card__meta" style={{ marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--fg-3)' }}>
          {i.kind === 'case' ? <FlaskConical size={12} /> : <Bug size={12} />}
          {i.kind === 'case' ? uatCode(i.no) : bugCode(i.no)}
        </span>
        <Pill tone={tone}>{label}</Pill>
        {i.urgent && <Pill tone="danger">ด่วน</Pill>}
      </div>
      <h4 className="aoo-task-card__title">{i.title}</h4>
    </article>
  )
}

function ReleaseModal({ release, onClose, onSave }: { release?: DevRelease; onClose: () => void; onSave: (i: ReleaseInput) => Promise<void> }) {
  const { showToast } = useToast()
  const [name, setName] = useState(release?.name ?? '')
  const [goal, setGoal] = useState(release?.goal ?? '')
  const [startDate, setStartDate] = useState(release?.startDate ?? '')
  const [targetDate, setTargetDate] = useState(release?.targetDate ?? '')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      await onSave({ name, goal, startDate, targetDate })
    } catch (e) {
      showToast((e as Error).message, 'error')
      setSaving(false)
    }
  }
  return (
    <Modal open onClose={onClose} title={release ? 'แก้รอบ' : 'สร้างรอบ'} maxWidth={520}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Field label="ชื่อรอบ" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="เช่น v1.2 หรือ รอบปลาย พ.ย." />
        </Field>
        <Field label="เป้าหมายของรอบ">
          <Textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="รอบนี้ต้องจบอะไรบ้าง" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <Field label="เริ่ม" asDiv>
            <DatePicker value={startDate} onChange={setStartDate} clearable="ไม่กำหนด" />
          </Field>
          <Field label="เป้าวันเสร็จ" asDiv>
            <DatePicker value={targetDate} onChange={setTargetDate} min={startDate || undefined} clearable="ไม่กำหนด" />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={save} loading={saving} disabled={!name.trim()}>บันทึก</Button>
        </div>
      </div>
    </Modal>
  )
}
