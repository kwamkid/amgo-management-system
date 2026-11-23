'use client'

// บั๊กหนึ่งใบ — รายละเอียด (ทำยังไงถึงเจอ · ควรเป็น · เป็นจริง · รูป) · ประวัติ · สถานะ
// ผู้จัดการ: ย้ายสถานะ/มอบหมาย/แก้/ลบ · ผู้เทส: บั๊กรอเทส → "หายแล้ว" (ปิด) หรือ "ยังไม่หาย" (กลับไปกำลังแก้ ต้องบอกว่าเจออะไร)
// คนแจ้งแก้รายละเอียดได้ตอนบั๊กยังเป็น "ใหม่" · กติกาซ้ำใน DB (dev_bug_guard / dev_bug_set_status)
// UI ตาม .claude/rules/domains/ui-design-system.md: ชื่อเป็นหัว modal · แท็บ = Segmented · สถานะ = StepSelect · ไม่มีกล่องซ้อน

import { useEffect, useState } from 'react'
import { Ban, CheckCircle2, ExternalLink, RotateCcw, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { Button, ConfirmDialog, Field, ImageDropzone, Input, Modal, Pill, SelectMenu, StepSelect, Textarea } from '@/components/aoo'
import { Segmented } from '@/components/shared'
import ShotGallery from '@/components/dev/ShotGallery'
import { DEVICE_LABELS, ENV_LABELS, pageLink, uatCode, type DevProject, type UatDevice, type UatEnvironment } from '@/lib/dev/uat'
import {
  BUG_MAX_SHOTS,
  BUG_SEVERITIES,
  BUG_STATUS_LABELS,
  BUG_STATUS_TONE,
  bugCode,
  SEVERITY_HINTS,
  SEVERITY_LABELS,
  SEVERITY_TONE,
  type BugEvent,
  type BugSeverity,
  type BugStatus,
  type DevBug,
} from '@/lib/dev/bugs'
import {
  findUatCaseId,
  assignBug,
  deleteBug,
  getBugEvents,
  setBugStatus,
  signBugShots,
  updateBug,
  type BugInput,
} from '@/lib/services/devBugService'

type Tab = 'bug' | 'status' | 'history' | 'edit'

const FLOW: { value: BugStatus; tone: 'danger' | 'warning' | 'grape' | 'sky' | 'success' }[] = [
  { value: 'new', tone: 'danger' },
  { value: 'accepted', tone: 'warning' },
  { value: 'fixing', tone: 'grape' },
  { value: 'testing', tone: 'sky' },
  { value: 'closed', tone: 'success' },
]

export default function BugModal({
  bug,
  project,
  userId,
  /** ลากการ์ดมาวางคอลัมน์ใหม่ — เปิดแท็บสถานะพร้อมเลือกปลายทางไว้ */
  presetStatus,
  sortOrder,
  onOpenCase,
  onClose,
  onChanged,
}: {
  bug: DevBug
  project: DevProject
  userId: string
  presetStatus?: BugStatus
  sortOrder?: number
  onOpenCase?: (caseId: string) => void
  onClose: (saved: boolean) => void
  onChanged: () => void
}) {
  const canManage = project.myRole === 'manager'
  const canTest = canManage || project.myRole === 'tester'
  const testerVerify = !canManage && canTest && bug.status === 'testing'
  const canEdit = canManage || (bug.reportedBy === userId && bug.status === 'new')

  const [tab, setTab] = useState<Tab>(presetStatus ? 'status' : 'bug')
  const [events, setEvents] = useState<BugEvent[] | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getBugEvents(bug.id).then(setEvents).catch(() => setEvents([]))
  }, [bug.id, bug.updatedAt])

  const tabs = (() => {
    const t: { value: Tab; label: string }[] = [{ value: 'bug', label: 'บั๊ก' }]
    if (canManage || testerVerify) t.push({ value: 'status', label: testerVerify ? 'ผลเทส' : 'สถานะ' })
    t.push({ value: 'history', label: `ประวัติ${events?.length ? ` (${events.length})` : ''}` })
    if (canEdit) t.push({ value: 'edit', label: 'แก้' })
    return t
  })()

  const done = (close = false) => {
    setSaved(true)
    onChanged()
    if (close) onClose(true)
  }

  return (
    <Modal
      open
      onClose={() => onClose(saved)}
      maxWidth={640}
      title={
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--fg-3)' }}>{bugCode(bug.no)}</span>
            <Pill tone={BUG_STATUS_TONE[bug.status]}>{BUG_STATUS_LABELS[bug.status]}</Pill>
            <Pill tone={SEVERITY_TONE[bug.severity]}>{SEVERITY_LABELS[bug.severity]}</Pill>
          </div>
          <div style={{ fontSize: 'var(--fs-h4)', fontWeight: 700, lineHeight: 1.3 }}>{bug.title}</div>
        </div>
      }
    >
      <Segmented className="aoo-task-modal__tabs" value={tab} options={tabs} onChange={(v) => setTab(v as Tab)} />

      {tab === 'bug' && <BugDetail bug={bug} project={project} onOpenCase={onOpenCase} />}

      {tab === 'status' && testerVerify && <TesterVerify bug={bug} sortOrder={sortOrder} preset={presetStatus} onDone={() => done(true)} />}
      {tab === 'status' && canManage && (
        <ManagerStatus bug={bug} project={project} preset={presetStatus} sortOrder={sortOrder} onChanged={() => done()} onGone={() => done(true)} />
      )}

      {tab === 'history' && <History events={events} />}

      {tab === 'edit' && canEdit && (
        <BugForm
          initial={bug}
          onCancel={() => setTab('bug')}
          onSave={async (input, files, keep) => {
            await updateBug(bug, input, keep, files)
            done()
            setTab('bug')
          }}
        />
      )}
    </Modal>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <>
      <dt style={{ color: 'var(--fg-3)' }}>{label}</dt>
      <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{value}</dd>
    </>
  )
}

function Section({ title, text }: { title: string; text: string | null }) {
  if (!text) return null
  return (
    <div>
      <h4 style={{ margin: '0 0 4px', fontSize: 'var(--fs-caption)', fontWeight: 700 }}>{title}</h4>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{text}</p>
    </div>
  )
}

function BugDetail({ bug, project, onOpenCase }: { bug: DevBug; project: DevProject; onOpenCase?: (caseId: string) => void }) {
  const [urls, setUrls] = useState<string[]>([])
  const key = bug.shots.join('|')
  useEffect(() => {
    if (!key) return
    signBugShots(bug.shots).then((m) => setUrls(bug.shots.map((p) => m[p]).filter(Boolean))).catch(() => setUrls([]))
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const link = pageLink(bug, project)
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {bug.status === 'testing' && bug.fixNote && (
        <div style={{ padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--sky-100)', color: 'var(--sky-700)' }}>
          <strong>แก้แล้ว รบกวนเทสอีกครั้ง</strong>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{bug.fixNote}</p>
        </div>
      )}
      {bug.status === 'wont_fix' && bug.closeReason && (
        <div style={{ padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--bg-sunken)' }}>
          <strong>ไม่แก้ เพราะ</strong>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{bug.closeReason}</p>
        </div>
      )}
      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 12px', margin: 0, fontSize: 'var(--fs-caption)' }}>
        <Info label="ระบบ" value={ENV_LABELS[bug.environment]} />
        <Info label="อุปกรณ์" value={DEVICE_LABELS[bug.device]} />
        <Info label="ผู้แจ้ง" value={bug.reporterName} />
        <Info label="ผู้รับผิดชอบ" value={bug.assigneeName} />
        <Info
          label="จากเคส"
          value={
            bug.uatCaseNo && bug.uatCaseId ? (
              onOpenCase ? (
                <button type="button" onClick={() => onOpenCase(bug.uatCaseId!)} style={{ padding: 0, border: 0, background: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}>
                  {uatCode(bug.uatCaseNo)}
                </button>
              ) : (
                uatCode(bug.uatCaseNo)
              )
            ) : null
          }
        />
        <Info label="แจ้งเมื่อ" value={new Date(bug.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} />
      </dl>
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" icon={ExternalLink} style={{ width: '100%' }}>
            เปิดหน้าที่เจอบั๊ก
          </Button>
        </a>
      )}
      <Section title="ทำยังไงถึงเจอ" text={bug.steps} />
      <Section title="ควรเป็น" text={bug.expected} />
      <Section title="ที่เป็นจริง" text={bug.actual} />
      {urls.length > 0 && <ShotGallery urls={urls} />}
      {bug.source && <p style={{ margin: 0, fontSize: 'var(--fs-caption)', color: 'var(--fg-3)' }}>ที่มา: {bug.source}</p>}
    </div>
  )
}

// ── ผู้เทส: บั๊กรอเทส → หายแล้ว / ยังไม่หาย ───────────────────────────────────
function TesterVerify({ bug, preset, sortOrder, onDone }: { bug: DevBug; preset?: BugStatus; sortOrder?: number; onDone: () => void }) {
  const { showToast } = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (to: BugStatus) => {
    setBusy(true)
    try {
      await setBugStatus(bug.id, to, note, sortOrder)
      showToast(to === 'closed' ? `ปิด ${bugCode(bug.no)} แล้ว` : 'ส่งกลับไปแก้แล้ว')
      onDone()
    } catch (e) {
      showToast((e as Error).message, 'error')
      setBusy(false)
    }
  }
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <p style={{ margin: 0 }}>ลองทำตามขั้นตอนในแท็บ บั๊ก อีกครั้ง แล้วบอกว่ายังเจออยู่ไหม</p>
      <Field label="ยังเจออะไรอยู่ (ถ้ายังไม่หาย ต้องใส่)">
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus={preset === 'fixing'} />
      </Field>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button icon={CheckCircle2} disabled={busy} onClick={() => run('closed')}>หายแล้ว ปิดได้</Button>
        <Button variant="secondary" icon={RotateCcw} disabled={busy || !note.trim()} onClick={() => run('fixing')}>ยังไม่หาย</Button>
      </div>
    </div>
  )
}

// ── ผู้จัดการ: สถานะ · มอบหมาย · ลบ ───────────────────────────────────────────
function ManagerStatus({
  bug,
  project,
  preset,
  sortOrder,
  onChanged,
  onGone,
}: {
  bug: DevBug
  project: DevProject
  preset?: BugStatus
  sortOrder?: number
  onChanged: () => void
  onGone: () => void
}) {
  const { showToast } = useToast()
  const [to, setTo] = useState<BugStatus>(preset ?? bug.status)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const noteLabel =
    to === 'testing' ? 'แก้อะไรไปบ้าง (โชว์ให้คนเทสเห็น)'
      : to === 'wont_fix' ? 'ทำไมไม่แก้'
        : to === 'fixing' && bug.status === 'testing' ? 'ยังเจออะไรอยู่'
          : 'หมายเหตุ (ถ้ามี)'
  const noteRequired = to === 'wont_fix' || (to === 'fixing' && bug.status === 'testing')
  const changed = to !== bug.status || !!note.trim()

  const run = async (fn: () => Promise<void>, ok: string, after?: () => void) => {
    setBusy(true)
    try {
      await fn()
      showToast(ok)
      setNote('')
      ;(after ?? onChanged)()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Field label="สถานะ" asDiv>
        <StepSelect
          value={to === 'wont_fix' ? '' : to}
          onChange={(v) => setTo(v as BugStatus)}
          options={FLOW.map((f) => ({ value: f.value, label: BUG_STATUS_LABELS[f.value], tone: f.tone }))}
        />
      </Field>
      <div>
        <button
          type="button"
          className="aoo-chip"
          aria-pressed={to === 'wont_fix'}
          onClick={() => setTo(to === 'wont_fix' ? bug.status : 'wont_fix')}
        >
          <Ban size={14} /> ไม่แก้
        </button>
      </div>
      <Field label={noteLabel} required={noteRequired}>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} autoFocus={!!preset} />
      </Field>
      <Button
        disabled={busy || !changed || (noteRequired && !note.trim())}
        loading={busy}
        onClick={() => run(() => setBugStatus(bug.id, to, note, sortOrder), `${bugCode(bug.no)} → ${BUG_STATUS_LABELS[to]}`)}
        style={{ width: '100%' }}
      >
        บันทึกสถานะ
      </Button>

      <hr style={{ border: 0, borderTop: '1px solid var(--border-1)', margin: 0 }} />

      <CaseLink bug={bug} onChanged={onChanged} />
      <Field label="ผู้รับผิดชอบ" asDiv>
        <SelectMenu
          value={bug.assigneeId ?? ''}
          options={[{ value: '', label: 'ยังไม่มี' }, ...project.members.filter((m) => m.role !== 'viewer').map((m) => ({ value: m.userId, label: m.name }))]}
          onChange={(v) => run(() => assignBug(bug.id, v || null), 'มอบหมายแล้ว')}
          disabled={busy}
        />
      </Field>
      <div>
        <Button variant="danger" icon={Trash2} disabled={busy} onClick={() => setConfirmDelete(true)}>ลบบั๊ก</Button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title={`ลบ ${bugCode(bug.no)}?`}
        description="รูปและประวัติของบั๊กนี้จะหายไปด้วย เลขบั๊กจะไม่ถูกใช้ซ้ำ"
        confirmLabel="ลบบั๊ก"
        tone="danger"
        onConfirm={() => run(() => deleteBug(bug), 'ลบบั๊กแล้ว', onGone)}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}

/** ผูก/เลิกผูกบั๊กกับเคส UAT ของโปรเจกต์เดียวกัน (พิมพ์เลขเคส) */
function CaseLink({ bug, onChanged }: { bug: DevBug; onChanged: () => void }) {
  const { showToast } = useToast()
  const [no, setNo] = useState(bug.uatCaseNo ? String(bug.uatCaseNo) : '')
  const [busy, setBusy] = useState(false)
  const parsed = no.trim() ? Number(no.trim().replace(/^uat-?/i, '')) : null
  const same = (parsed ?? null) === (bug.uatCaseNo ?? null)
  const save = async () => {
    setBusy(true)
    try {
      const id = parsed ? await findUatCaseId(bug.projectId, parsed) : null
      await updateBug(bug, { uatCaseId: id })
      showToast(id ? `ผูกกับ ${uatCode(parsed!)} แล้ว` : 'เลิกผูกเคสแล้ว')
      onChanged()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Field label="เคส UAT ที่เกี่ยว (เลขเคส · เว้นว่าง = ไม่ผูก)" asDiv>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input value={no} onChange={(e) => setNo(e.target.value)} placeholder="เช่น 89" inputMode="numeric" style={{ flex: 1 }} />
        <Button variant="secondary" disabled={busy || same || (parsed !== null && (!Number.isInteger(parsed) || parsed < 1))} loading={busy} onClick={save}>
          บันทึก
        </Button>
      </div>
    </Field>
  )
}

// ── ประวัติ ───────────────────────────────────────────────────────────────────
function History({ events }: { events: BugEvent[] | null }) {
  if (!events) return <p style={{ color: 'var(--fg-3)' }}>กำลังโหลด…</p>
  if (events.length === 0) return <p style={{ color: 'var(--fg-3)' }}>ยังไม่มีประวัติ</p>
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {events.map((e) => (
        <div key={e.id} style={{ paddingBottom: 10, borderBottom: '1px solid var(--border-1)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {e.kind === 'created' && <Pill tone="danger">แจ้งบั๊ก</Pill>}
            {e.kind === 'assign' && <Pill>มอบหมาย → {e.note || 'ไม่มี'}</Pill>}
            {e.kind === 'status' && e.toStatus && (
              <Pill tone={BUG_STATUS_TONE[e.toStatus]}>
                {e.fromStatus && e.fromStatus !== e.toStatus ? `${BUG_STATUS_LABELS[e.fromStatus]} → ` : ''}
                {BUG_STATUS_LABELS[e.toStatus]}
              </Pill>
            )}
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--fg-3)' }}>
              {e.actorName || 'ระบบ'} · {new Date(e.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>
          {e.kind === 'status' && e.note && <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{e.note}</p>}
        </div>
      ))}
    </div>
  )
}

// ── ฟอร์มแจ้ง/แก้บั๊ก — ผู้เทสใช้จากมือถือ · Claude แจ้งผ่าน bot API ─────────────
export function BugForm({
  initial,
  prefill,
  onCancel,
  onSave,
}: {
  initial?: DevBug
  /** แจ้งจากผลเทส UAT ที่ไม่ผ่าน */
  prefill?: Partial<BugInput> & { caseLabel?: string; shots?: string[] }
  onCancel: () => void
  /** keep = รูปเดิมที่ยังเก็บไว้ (ของบั๊กเอง หรือรูปผลเทสที่ prefill มา) */
  onSave: (input: BugInput, files: File[], keep: string[]) => Promise<void>
}) {
  const { showToast } = useToast()
  const src = { ...prefill, ...(initial ?? {}) }
  const [title, setTitle] = useState(src.title ?? '')
  const [severity, setSeverity] = useState<BugSeverity>(initial?.severity ?? prefill?.severity ?? 'normal')
  const [environment, setEnvironment] = useState<UatEnvironment>(src.environment ?? 'production')
  const [device, setDevice] = useState<UatDevice>(src.device ?? 'any')
  const [pageUrl, setPageUrl] = useState(src.pageUrl ?? '')
  const [steps, setSteps] = useState(src.steps ?? '')
  const [expected, setExpected] = useState(src.expected ?? '')
  const [actual, setActual] = useState(src.actual ?? '')
  const startShots = initial?.shots ?? prefill?.shots ?? []
  const [keep, setKeep] = useState<string[]>(startShots)
  const [keepUrls, setKeepUrls] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<{ id: string; file: File; url: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (startShots.length) signBugShots(startShots).then(setKeepUrls).catch(() => {})
  }, [initial?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const total = keep.length + files.length
  const save = async () => {
    setSaving(true)
    try {
      await onSave(
        { title, severity, environment, device, pageUrl, steps, expected, actual, ...(prefill?.uatCaseId ? { uatCaseId: prefill.uatCaseId } : {}) },
        files.map((f) => f.file),
        keep
      )
    } catch (e) {
      showToast((e as Error).message, 'error')
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {prefill?.caseLabel && <p style={{ margin: 0, fontSize: 'var(--fs-caption)', color: 'var(--fg-3)' }}>แจ้งจากเคส {prefill.caseLabel}</p>}
      <Field label="บั๊กอะไร" required>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!initial} placeholder="สั้น ๆ เช่น กดบันทึกแล้วราคาหาย" />
      </Field>
      <Field label="ความรุนแรง" asDiv help={SEVERITY_HINTS[severity]}>
        <SelectMenu
          value={severity}
          options={BUG_SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABELS[s] }))}
          onChange={(v) => v && setSeverity(v as BugSeverity)}
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <Field label="ระบบ" asDiv>
          <SelectMenu
            value={environment}
            options={(Object.keys(ENV_LABELS) as UatEnvironment[]).map((k) => ({ value: k, label: ENV_LABELS[k] }))}
            onChange={(v) => v && setEnvironment(v as UatEnvironment)}
          />
        </Field>
        <Field label="อุปกรณ์" asDiv>
          <SelectMenu
            value={device}
            options={(Object.keys(DEVICE_LABELS) as UatDevice[]).map((k) => ({ value: k, label: DEVICE_LABELS[k] }))}
            onChange={(v) => v && setDevice(v as UatDevice)}
          />
        </Field>
      </div>
      <Field label="หน้าที่เจอ (/path หรือ URL เต็ม)"><Input value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="/products/new" /></Field>
      <Field label="ทำยังไงถึงเจอ"><Textarea rows={3} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={'1. เข้าเมนู…\n2. กด…'} /></Field>
      <Field label="ควรเป็น"><Textarea rows={2} value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
      <Field label="ที่เป็นจริง"><Textarea rows={2} value={actual} onChange={(e) => setActual(e.target.value)} /></Field>
      <Field label={`รูป (ไม่เกิน ${BUG_MAX_SHOTS})`} asDiv>
        <ImageDropzone
          items={[
            ...keep.map((p) => ({ id: p, url: keepUrls[p] ?? '' })),
            ...files.map((f) => ({ id: f.id, url: f.url })),
          ]}
          maxItems={BUG_MAX_SHOTS}
          onFilesPicked={(picked) =>
            setFiles((prev) => [
              ...prev,
              ...picked.slice(0, BUG_MAX_SHOTS - total).map((file) => ({ id: `${Date.now()}-${Math.random()}`, file, url: URL.createObjectURL(file) })),
            ])
          }
          onRemove={(id) => {
            setKeep((prev) => prev.filter((p) => p !== id))
            setFiles((prev) => prev.filter((f) => f.id !== id))
          }}
          label="เพิ่มรูป"
        />
      </Field>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>ยกเลิก</Button>
        <Button onClick={save} loading={saving} disabled={!title.trim()}>{initial ? 'บันทึก' : 'แจ้งบั๊ก'}</Button>
      </div>
    </div>
  )
}
