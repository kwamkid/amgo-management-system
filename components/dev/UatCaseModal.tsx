'use client'

// เคส UAT หนึ่งใบ — เทสที่ไหน · ขั้นตอน (ควรเห็น) · ฟอร์มบันทึกผล (รูป ≥ 1) · ผู้จัดการ: แก้เคส / ส่งเทสซ้ำ / ปิด · ประวัติผล + รูป (lightbox)
// กติกา UI ตาม .claude/rules/domains/ui-design-system.md: ชื่อเคสเป็นหัว modal · แท็บใน modal = Segmented · ไม่มีกล่องซ้อนกล่อง

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Image as ImageIcon, Pencil, RotateCcw, Lock, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { Button, ConfirmDialog, Field, ImageDropzone, Input, Modal, Pill, Select, StepSelect, Textarea } from '@/components/aoo'
import { Segmented } from '@/components/shared'
import {
  DEVICE_LABELS,
  ENV_LABELS,
  pageLink,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_TONE,
  UAT_MAX_SHOTS,
  UAT_RESULTS,
  uatCode,
  type DevProject,
  type UatCase,
  type UatResult,
  type UatResultValue,
  type UatStep,
} from '@/lib/dev/uat'
import {
  addUatResult,
  closeUatCase,
  deleteUatCase,
  getUatResults,
  retestUatCase,
  updateUatCase,
  type UatCaseInput,
} from '@/lib/services/devService'

const RESULT_TONE = { passed: 'success', failed: 'danger', blocked: 'warning' } as const

type Tab = 'case' | 'result' | 'history' | 'edit'

export default function UatCaseModal({
  c,
  project,
  canManage,
  userId,
  /** วางการ์ดบนคอลัมน์ผลมา — เปิดแท็บบันทึกผลพร้อมเลือกผลไว้ */
  presetResult,
  /** วางการ์ดบน "รอเทส" (ส่งกลับ) — เปิดแท็บผู้จัดการพร้อมถามว่าแก้อะไร */
  presetRetest,
  sortOrder,
  onClose,
  onChanged,
}: {
  c: UatCase
  project: DevProject
  canManage: boolean
  userId: string
  presetResult?: UatResultValue
  presetRetest?: boolean
  sortOrder?: number
  onClose: (saved: boolean) => void
  onChanged: () => void
}) {
  const { showToast } = useToast()
  const [tab, setTab] = useState<Tab>(presetResult ? 'result' : presetRetest ? 'edit' : 'case')
  const [results, setResults] = useState<UatResult[] | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getUatResults(c.id).then(setResults).catch((e) => showToast((e as Error).message, 'error'))
  }, [c.id, c.resultCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const link = pageLink(c, project)
  const closed = c.status === 'closed'
  const tabs = useMemo(() => {
    const t: { value: Tab; label: string }[] = [{ value: 'case', label: 'เคส' }]
    if (!closed) t.push({ value: 'result', label: 'บันทึกผล' })
    t.push({ value: 'history', label: `ประวัติ${results?.length ? ` (${results.length})` : ''}` })
    if (canManage) t.push({ value: 'edit', label: 'จัดการ' })
    return t
  }, [closed, canManage, results?.length])

  const done = () => {
    setSaved(true)
    onChanged()
  }

  return (
    <Modal
      open
      onClose={() => onClose(saved)}
      maxWidth={640}
      title={
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-3)' }}>{uatCode(c.no)}</span>
            <Pill tone={STATUS_TONE[c.status]}>{STATUS_LABELS[c.status]}</Pill>
            {c.priority === 1 && <Pill tone="danger">{PRIORITY_LABELS[1]}</Pill>}
            {c.round > 1 && <Pill>รอบที่ {c.round}</Pill>}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{c.title}</div>
        </div>
      }
    >
      <Segmented className="aoo-task-modal__tabs" value={tab} options={tabs} onChange={(v) => setTab(v as Tab)} />

      {tab === 'case' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {c.status === 'retest' && c.fixNote && (
            <div style={{ padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--grape-100)', color: 'var(--grape-700)' }}>
              <strong>แก้แล้ว รบกวนเทสซ้ำ</strong>
              <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{c.fixNote}</p>
            </div>
          )}
          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 12px', margin: 0, fontSize: 14 }}>
            <Info label="ระบบ" value={ENV_LABELS[c.environment]} />
            <Info label="ร้าน" value={c.shop} />
            <Info label="ล็อกอินเป็น" value={c.loginAs} />
            <Info label="เมนู" value={c.menuPath} />
            <Info label="อุปกรณ์" value={DEVICE_LABELS[c.device]} />
            <Info label="เตรียมก่อนเทส" value={c.preparation} />
            <Info label="โมดูล" value={c.module} />
          </dl>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" icon={ExternalLink} style={{ width: '100%' }}>
                เปิดหน้าที่ต้องเทส
              </Button>
            </a>
          )}
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>ขั้นตอน</h4>
            <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 10 }}>
              {c.steps.map((s, i) => (
                <li key={i}>
                  <div style={{ fontWeight: 600 }}>{s.action}</div>
                  {s.expected && <div style={{ color: 'var(--fg-2)', fontSize: 14 }}>ควรเห็น: {s.expected}</div>}
                </li>
              ))}
            </ol>
          </div>
          {c.source && <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-3)' }}>ที่มา: {c.source}</p>}
        </div>
      )}

      {tab === 'result' && !closed && (
        <ResultForm
          key={`${c.id}-${presetResult ?? ''}`}
          c={c}
          userId={userId}
          preset={presetResult}
          sortOrder={sortOrder}
          onSaved={() => {
            done()
            onClose(true)
          }}
        />
      )}

      {tab === 'history' && <History results={results} />}

      {tab === 'edit' && canManage && (
        <ManagerPanel c={c} presetRetest={presetRetest} sortOrder={sortOrder} onChanged={done} onGone={() => onClose(true)} />
      )}
    </Modal>
  )
}

function Info({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <>
      <dt style={{ color: 'var(--fg-3)' }}>{label}</dt>
      <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{value}</dd>
    </>
  )
}

// ── บันทึกผล ─────────────────────────────────────────────────────────────────
function ResultForm({
  c,
  userId,
  preset,
  sortOrder,
  onSaved,
}: {
  c: UatCase
  userId: string
  preset?: UatResultValue
  sortOrder?: number
  onSaved: () => void
}) {
  const { showToast } = useToast()
  const [result, setResult] = useState<UatResultValue | ''>(preset ?? '')
  const [failedStep, setFailedStep] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [files, setFiles] = useState<{ id: string; file: File; url: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const needsNote = result !== '' && result !== 'passed'
  const canSave = result !== '' && files.length > 0 && (!needsNote || note.trim()) && !saving

  const save = async () => {
    if (!result) return
    setSaving(true)
    try {
      await addUatResult(c, { result, failedStep, note, files: files.map((f) => f.file), sortOrder }, userId)
      if (result !== 'passed') notifyManagers(c, result, note)
      showToast('บันทึกผลแล้ว')
      onSaved()
    } catch (e) {
      showToast((e as Error).message, 'error')
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Field label="ผลการเทส" asDiv>
        <StepSelect
          value={result}
          onChange={(v) => setResult(v as UatResultValue)}
          options={UAT_RESULTS.map((r) => ({ value: r, label: STATUS_LABELS[r], tone: RESULT_TONE[r] }))}
        />
      </Field>
      {needsNote && c.steps.length > 0 && (
        <Field label="เกิดที่ขั้นตอนไหน" asDiv>
          <div className="aoo-chips">
            {c.steps.map((_, i) => (
              <button
                key={i}
                type="button"
                className="aoo-chip"
                aria-pressed={failedStep === i + 1}
                onClick={() => setFailedStep(failedStep === i + 1 ? null : i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label={needsNote ? 'เจออะไร' : 'หมายเหตุ'} required={needsNote}>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={needsNote ? 'เห็นอะไร ต่างจากที่ควรเห็นยังไง' : 'ถ้ามี'} />
      </Field>
      <Field label={`รูปผลการเทส (อย่างน้อย 1 รูป · ไม่เกิน ${UAT_MAX_SHOTS})`} asDiv>
        <ImageDropzone
          items={files.map((f) => ({ id: f.id, url: f.url }))}
          maxItems={UAT_MAX_SHOTS}
          onFilesPicked={(picked) =>
            setFiles((prev) => [
              ...prev,
              ...picked.slice(0, UAT_MAX_SHOTS - prev.length).map((file) => ({ id: `${Date.now()}-${Math.random()}`, file, url: URL.createObjectURL(file) })),
            ])
          }
          onRemove={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
          label="เพิ่มรูป"
        />
      </Field>
      <Button onClick={save} disabled={!canSave} loading={saving} style={{ width: '100%' }}>
        บันทึกผล
      </Button>
    </div>
  )
}

/** แจ้งผู้จัดการโปรเจกต์ (push) เมื่อไม่ผ่าน/ติดขัด — ยิงแล้วไม่รอ (เจ้าของ 3 พ.ย. 69: แจ้งเตือนส่งหาผม) */
function notifyManagers(c: UatCase, result: UatResultValue, note: string) {
  fetch('/api/dev/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId: c.id, result, note: note.slice(0, 200) }),
    keepalive: true,
  }).catch(() => {})
}

// ── ประวัติ ───────────────────────────────────────────────────────────────────
function History({ results }: { results: UatResult[] | null }) {
  const [open, setOpen] = useState<{ urls: string[]; index: number } | null>(null)
  if (!results) return <p style={{ color: 'var(--fg-3)' }}>กำลังโหลด…</p>
  if (results.length === 0) return <p style={{ color: 'var(--fg-3)' }}>ยังไม่มีผลที่บันทึก</p>
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {results.map((r) => {
        const urls = r.shots.map((s) => s.url).filter((u): u is string => !!u)
        return (
          <div key={r.id} style={{ paddingBottom: 14, borderBottom: '1px solid var(--border-1)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Pill tone={STATUS_TONE[r.result]}>{STATUS_LABELS[r.result]}</Pill>
              <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>
                รอบที่ {r.round} · {r.testerName || 'ไม่ระบุชื่อ'} ·{' '}
                {new Date(r.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            {r.failedStep && <p style={{ margin: '6px 0 0', fontSize: 14 }}>เกิดที่ขั้นตอน {r.failedStep}</p>}
            {r.note && <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{r.note}</p>}
            {urls.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {urls.map((u, i) => (
                  <button key={u} type="button" aria-label={`เปิดรูปที่ ${i + 1}`} onClick={() => setOpen({ urls, index: i })} style={{ padding: 0, border: 0, background: 'none' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
                    <img src={u} alt="" loading="lazy" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '1px solid var(--border-1)' }} />
                  </button>
                ))}
              </div>
            )}
            {urls.length === 0 && r.shots.length > 0 && (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--fg-3)', display: 'flex', gap: 4, alignItems: 'center' }}>
                <ImageIcon size={14} /> รูป {r.shots.length} รูป (ไฟล์ไม่อยู่แล้ว)
              </p>
            )}
          </div>
        )
      })}
      {open && <Lightbox urls={open.urls} index={open.index} onClose={() => setOpen(null)} />}
    </div>
  )
}

function Lightbox({ urls, index, onClose }: { urls: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((v) => Math.min(urls.length - 1, v + 1))
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [urls.length, onClose])
  const nav = (dir: -1 | 1) => (e: React.MouseEvent) => {
    e.stopPropagation()
    setI((v) => Math.max(0, Math.min(urls.length - 1, v + dir)))
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urls[i]} alt="" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90dvh', maxWidth: '95vw', objectFit: 'contain' }} />
      {urls.length > 1 && (
        <>
          <p style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', color: '#fff', margin: 0 }}>
            {i + 1} / {urls.length}
          </p>
          {i > 0 && (
            <button type="button" aria-label="รูปก่อนหน้า" onClick={nav(-1)} style={lbBtn('left')}>
              ‹
            </button>
          )}
          {i < urls.length - 1 && (
            <button type="button" aria-label="รูปถัดไป" onClick={nav(1)} style={lbBtn('right')}>
              ›
            </button>
          )}
        </>
      )}
    </div>
  )
}
const lbBtn = (side: 'left' | 'right'): React.CSSProperties => ({
  position: 'absolute',
  [side]: 8,
  width: 48,
  height: 48,
  borderRadius: 999,
  border: 0,
  background: 'rgba(255,255,255,.2)',
  color: '#fff',
  fontSize: 28,
})

// ── ผู้จัดการ: ส่งเทสซ้ำ / ปิด / แก้เคส / ลบ ───────────────────────────────
function ManagerPanel({
  c,
  presetRetest,
  sortOrder,
  onChanged,
  onGone,
}: {
  c: UatCase
  presetRetest?: boolean
  sortOrder?: number
  onChanged: () => void
  onGone: () => void
}) {
  const { showToast } = useToast()
  const [fixNote, setFixNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      showToast(ok)
      onChanged()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (editing) return <CaseForm initial={c} onCancel={() => setEditing(false)} onSave={async (input) => { await updateUatCase(c.id, input); setEditing(false); onChanged() }} />

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {presetRetest && <p style={{ margin: 0, color: 'var(--grape-700)' }}>ส่งกลับไปเทสซ้ำ — บอกคนเทสหน่อยว่าแก้อะไรไปบ้าง</p>}
      <Field label="แก้อะไรไปบ้าง (โชว์ให้คนเทสเห็นตอนเทสซ้ำ)">
        <Textarea rows={2} value={fixNote} onChange={(e) => setFixNote(e.target.value)} autoFocus={presetRetest} />
      </Field>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button variant="secondary" icon={RotateCcw} disabled={busy} onClick={() => run(() => retestUatCase(c, fixNote, sortOrder), 'ส่งเทสซ้ำแล้ว')}>
          ส่งเทสซ้ำ (รอบ {c.round + 1})
        </Button>
        {c.status !== 'closed' && (
          <Button variant="secondary" icon={Lock} disabled={busy} onClick={() => run(() => closeUatCase(c.id, sortOrder), 'ปิดเคสแล้ว')}>
            ปิดเคส
          </Button>
        )}
        <Button variant="ghost" icon={Pencil} disabled={busy} onClick={() => setEditing(true)}>
          แก้เคส
        </Button>
        <Button variant="danger" icon={Trash2} disabled={busy} onClick={() => setConfirmDelete(true)}>
          ลบ
        </Button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title={`ลบ ${uatCode(c.no)}?`}
        description="ผลเทสและรูปของเคสนี้จะหายไปด้วย เลขเคสจะไม่ถูกใช้ซ้ำ"
        confirmLabel="ลบเคส"
        tone="danger"
        onConfirm={() => run(async () => { await deleteUatCase(c.id); onGone() }, 'ลบเคสแล้ว')}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}

// ── ฟอร์มเคส (สร้าง/แก้) — ผู้จัดการ · Claude เพิ่มผ่าน bot API เป็นหลัก ────────
export function CaseForm({
  initial,
  onCancel,
  onSave,
}: {
  initial?: UatCase
  onCancel: () => void
  onSave: (input: UatCaseInput) => Promise<void>
}) {
  const { showToast } = useToast()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [module, setModule] = useState(initial?.module ?? '')
  const [priority, setPriority] = useState<1 | 2 | 3>(initial?.priority ?? 2)
  const [environment, setEnvironment] = useState<UatCase['environment']>(initial?.environment ?? 'production')
  const [device, setDevice] = useState<UatCase['device']>(initial?.device ?? 'any')
  const [shop, setShop] = useState(initial?.shop ?? '')
  const [loginAs, setLoginAs] = useState(initial?.loginAs ?? '')
  const [menuPath, setMenuPath] = useState(initial?.menuPath ?? '')
  const [pageUrl, setPageUrl] = useState(initial?.pageUrl ?? '')
  const [preparation, setPreparation] = useState(initial?.preparation ?? '')
  const [steps, setSteps] = useState<UatStep[]>(initial?.steps.length ? initial.steps : [{ action: '', expected: '' }])
  const [saving, setSaving] = useState(false)

  const setStep = (i: number, patch: Partial<UatStep>) => setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  const save = async () => {
    setSaving(true)
    try {
      await onSave({ title, module, priority, environment, device, shop, loginAs, menuPath, pageUrl, preparation, steps })
      showToast('บันทึกเคสแล้ว')
    } catch (e) {
      showToast((e as Error).message, 'error')
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Field label="ชื่อเคส" required>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="ทำอะไร แล้วควรเกิดอะไร" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Field label="ความสำคัญ">
          <Select value={priority} onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3)}>
            {[1, 2, 3].map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </Select>
        </Field>
        <Field label="ระบบ">
          <Select value={environment} onChange={(e) => setEnvironment(e.target.value as UatCase['environment'])}>
            {(Object.keys(ENV_LABELS) as UatCase['environment'][]).map((k) => (
              <option key={k} value={k}>{ENV_LABELS[k]}</option>
            ))}
          </Select>
        </Field>
        <Field label="อุปกรณ์">
          <Select value={device} onChange={(e) => setDevice(e.target.value as UatCase['device'])}>
            {(Object.keys(DEVICE_LABELS) as UatCase['device'][]).map((k) => (
              <option key={k} value={k}>{DEVICE_LABELS[k]}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <Field label="โมดูล"><Input value={module} onChange={(e) => setModule(e.target.value)} /></Field>
        <Field label="ร้าน"><Input value={shop} onChange={(e) => setShop(e.target.value)} /></Field>
        <Field label="ล็อกอินเป็น"><Input value={loginAs} onChange={(e) => setLoginAs(e.target.value)} /></Field>
        <Field label="เมนู"><Input value={menuPath} onChange={(e) => setMenuPath(e.target.value)} placeholder="สินค้า › เพิ่มสินค้า" /></Field>
      </div>
      <Field label="หน้าที่ต้องเทส (/path หรือ URL เต็ม)"><Input value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="/products/new" /></Field>
      <Field label="เตรียมก่อนเทส"><Textarea rows={2} value={preparation} onChange={(e) => setPreparation(e.target.value)} /></Field>
      <Field label="ขั้นตอน" asDiv required>
        <div style={{ display: 'grid', gap: 8 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 6, alignItems: 'start' }}>
              <span style={{ paddingTop: 8, fontWeight: 600, color: 'var(--fg-3)' }}>{i + 1}.</span>
              <div style={{ display: 'grid', gap: 4 }}>
                <Input value={s.action} onChange={(e) => setStep(i, { action: e.target.value })} placeholder="ทำอะไร" />
                <Input value={s.expected ?? ''} onChange={(e) => setStep(i, { expected: e.target.value })} placeholder="ควรเห็น…" />
              </div>
              <Button variant="ghost" size="sm" icon={Trash2} aria-label="ลบขั้นตอน" disabled={steps.length === 1} onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))} />
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setSteps((prev) => [...prev, { action: '', expected: '' }])} style={{ justifySelf: 'start' }}>
            + เพิ่มขั้นตอน
          </Button>
        </div>
      </Field>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>ยกเลิก</Button>
        <Button onClick={save} loading={saving} disabled={!title.trim()}>บันทึก</Button>
      </div>
    </div>
  )
}
