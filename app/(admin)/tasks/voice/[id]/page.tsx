'use client'

// ตรวจเสียงประชุม 1 ไฟล์ (แอดมินเท่านั้น · plan: project/jobs/plans/voice-tasks.md)
// ถอดเสียง → ร่างงาน วิ่งในคิวกลาง (lib/voice/pipeline.ts) ปิดหน้าได้ · หน้านี้แค่โหลดสถานะใหม่ทุก 30 วิ
// ระหว่างที่ยังไม่ถึง "รอตรวจ" และโชว์ความคืบหน้าด้วย <QueueFloat>
// ผู้พูด → คน (เลือกเองได้ เดาไว้ให้จากบริบท) · ร่างงานแก้ได้ทุกช่องก่อนกดรับ → ลงบอร์ด /tasks

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { AudioLines, Check, RotateCcw, Trash2, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import {
  Button,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  Field,
  Input,
  MultiSelectMenu,
  SelectMenu,
  Spinner,
  Textarea,
  type SelectOption,
} from '@/components/aoo'
import { PageHeader, QueueFloat, SectionCard, StatusBadge, UserAvatar } from '@/components/shared'
import { BRANDS, brandLabel } from '@/lib/constants/brands'
import { SOURCE_LABEL, clock, durationText, speakerLabel, voiceFetch } from '@/lib/voice/format'
import SpeakerRow, { SpeakerAvatar, pickSamples } from '@/components/voice/SpeakerRow'

/** a speaker sample plays this many seconds at most, then pauses */
const SAMPLE_SEC = 10

type Segment = { speaker: string; start: number; end: number; text: string }
type Person = { user_id: string; nickname: string | null; full_name: string; company: string | null }
type Guess = { user_id: string | null; reason: string }
interface Draft {
  id: string
  title: string
  notes: string
  assignee_ids: string[]
  assignee_raw: string | null
  due_date: string | null
  brand: string | null
  evidence_quote: string | null
  evidence_start_sec: number | null
  confidence: number | null
  status: 'pending' | 'accepted' | 'rejected'
  task_id: string | null
}
/** งานที่แจกออกจากประชุมนี้แล้ว (tasks.source_recording_id) */
interface HandedOut {
  id: string
  no: number
  title: string
  status: 'todo' | 'doing' | 'done'
  due_date: string | null
  assignee_ids: string[]
}
interface Detail {
  recording: {
    id: string
    title: string
    summary: string | null
    recorded_at: string | null
    duration_sec: number | null
    source: string
    status: string
    error: string | null
    created_at: string
    audio_deleted_at: string | null
  }
  transcript: {
    language: string | null
    segments: Segment[]
    speaker_map: Record<string, string>
    speaker_guesses: Record<string, Guess>
  } | null
  drafts: Draft[]
  tasks: HandedOut[]
  people: Person[]
  audioUrl: string | null
  queue: { total: number; done: number; failed: number; active: boolean; running: string[]; waiting: string[] }
}
type Edit = Pick<Draft, 'title' | 'notes' | 'assignee_ids' | 'due_date' | 'brand'>

const FINAL = new Set(['review', 'done', 'failed'])
const POLL_MS = 30_000 // กติกาโปรเจกต์ (queue.md): ถามซ้ำฝั่ง client ไม่ถี่กว่า 30 วิ
const STEPS = [
  { key: 'uploaded', label: 'เตรียมไฟล์เสียง' },
  { key: 'transcribing', label: 'ถอดเสียง (ไฟล์ 1 ชม. ใช้ราว 2–5 นาที)' },
  { key: 'extracting', label: 'ให้ AI ร่างงานจากบทสนทนา (ส่งแบบชุด ปกติไม่เกิน 1 ชม.)' },
]
const personName = (p: Person) => p.nickname || p.full_name
const toEdit = (d: Draft): Edit => ({ title: d.title, notes: d.notes, assignee_ids: d.assignee_ids, due_date: d.due_date, brand: d.brand })

export default function VoiceRecordingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { userData, realRole } = useAuth()
  const { showToast } = useToast()
  const isAdmin = (realRole ?? userData?.role) === 'admin'

  const [data, setData] = useState<Detail | null>(null)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [queueOpen, setQueueOpen] = useState(true)
  const [speakerMap, setSpeakerMap] = useState<Record<string, string | null>>({})
  const [mapDirty, setMapDirty] = useState(false)
  const [edits, setEdits] = useState<Record<string, Edit>>({})
  const [busyDraft, setBusyDraft] = useState<string | null>(null)
  const [busyAll, setBusyAll] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [summary, setSummary] = useState('')
  const [summaryDirty, setSummaryDirty] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const dirty = useRef({ map: false, summary: false })
  useEffect(() => {
    dirty.current = { map: mapDirty, summary: summaryDirty }
  }, [mapDirty, summaryDirty])

  const load = useCallback(async () => {
    const res = await fetch(`/api/voice/recordings/${id}`, { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setLoadError(json.error || 'โหลดไม่สำเร็จ')
      return null
    }
    const d = json as Detail
    // keep the first signed audio URL — a new one every 30 s poll reloads the player and stops playback
    setData((prev) => (prev?.audioUrl && d.audioUrl ? { ...d, audioUrl: prev.audioUrl } : d))
    setStatus(d.recording.status)
    // the poll must not wipe names / summary the admin is typing but has not saved yet
    if (!dirty.current.map) setSpeakerMap(d.transcript?.speaker_map ?? {})
    setEdits(Object.fromEntries(d.drafts.map((x) => [x.id, toEdit(x)])))
    if (!dirty.current.summary) setSummary(d.recording.summary ?? '')
    return d
  }, [id])

  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin, load])

  // งานยังวิ่งในคิว → โหลดใหม่ทุก 30 วิ จนถึง รอตรวจ / ไม่สำเร็จ (แก้ร่างงานอยู่ไม่โดนทับ เพราะตอนนั้นจบแล้ว)
  useEffect(() => {
    if (!status || FINAL.has(status)) return
    const t = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(t)
  }, [status, load])

  const retry = async () => {
    setRetrying(true)
    try {
      await voiceFetch(`/api/voice/recordings/${id}/retry`, 'POST')
      setQueueOpen(true)
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ลองใหม่ไม่สำเร็จ', 'error')
    } finally {
      setRetrying(false)
    }
  }

  const people = useMemo(() => data?.people ?? [], [data])
  const byId = useMemo(() => new Map(people.map((p) => [p.user_id, p])), [people])
  const personOptions: SelectOption[] = useMemo(
    () =>
      people.map((p) => ({
        value: p.user_id,
        label: personName(p),
        hint: [p.full_name, p.company].filter(Boolean).join(' · '),
        // รูปจาก /api/avatar (สำเนาที่เราเก็บไว้ + เบราว์เซอร์จำ 1 วัน) — ไม่ดึงจาก LINE ซ้ำ
        icon: <UserAvatar userId={p.user_id} name={personName(p)} size="xs" />,
      })),
    [people],
  )
  const speakers = useMemo(() => {
    const count = new Map<string, number>()
    for (const s of data?.transcript?.segments ?? []) count.set(s.speaker, (count.get(s.speaker) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }))
  }, [data])
  const speakerName = (sp: string) => {
    const uid = speakerMap[sp]
    const p = uid ? byId.get(uid) : undefined
    return p ? personName(p) : speakerLabel(sp)
  }

  const seek = (sec: number | null) => {
    const a = audioRef.current
    if (!a || sec == null) return
    stopAt.current = null
    setSample(null)
    a.currentTime = Math.max(0, sec - 1)
    void a.play().catch(() => {})
  }

  // ท่อนตัวอย่างของผู้พูด — เล่นในเครื่องเล่นหลัก แล้วหยุดเองหลังจบท่อน (ไม่เกิน SAMPLE_SEC)
  const [sample, setSample] = useState<number | null>(null)
  const stopAt = useRef<number | null>(null)
  const playSample = (s: { start: number; end: number }) => {
    const a = audioRef.current
    if (!a) return
    if (sample === s.start && !a.paused) {
      a.pause()
      return
    }
    stopAt.current = Math.min(s.end, s.start + SAMPLE_SEC)
    setSample(s.start)
    a.currentTime = Math.max(0, s.start - 0.3)
    void a.play().catch(() => setSample(null))
  }
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const tick = () => {
      if (stopAt.current != null && a.currentTime >= stopAt.current) a.pause()
    }
    const stop = () => {
      stopAt.current = null
      setSample(null)
    }
    a.addEventListener('timeupdate', tick)
    a.addEventListener('pause', stop)
    a.addEventListener('ended', stop)
    return () => {
      a.removeEventListener('timeupdate', tick)
      a.removeEventListener('pause', stop)
      a.removeEventListener('ended', stop)
    }
  }, [data?.audioUrl])

  const saveSpeakers = async () => {
    try {
      await voiceFetch(`/api/voice/recordings/${id}`, 'PATCH', { speaker_map: speakerMap })
      setMapDirty(false)
      showToast('บันทึกชื่อผู้พูดแล้ว')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', 'error')
    }
  }

  const saveSummary = async () => {
    try {
      await voiceFetch(`/api/voice/recordings/${id}`, 'PATCH', { summary })
      setSummaryDirty(false)
      showToast('บันทึกสรุปประชุมแล้ว')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', 'error')
    }
  }

  // งานที่แจกแล้ว แยกตามคน (งานหลายคนอยู่ทุกคน) · ไม่มีคนรับไว้ท้ายสุด
  const handedOut = useMemo(() => {
    const groups = new Map<string, HandedOut[]>()
    for (const t of data?.tasks ?? []) {
      for (const uid of t.assignee_ids.length ? t.assignee_ids : ['']) groups.set(uid, [...(groups.get(uid) ?? []), t])
    }
    return [...groups.entries()]
      .map(([uid, list]) => ({ uid, name: uid ? (byId.get(uid) ? personName(byId.get(uid)!) : '?') : 'ยังไม่มีคนรับ', list }))
      .sort((a, b) => (a.uid ? 0 : 1) - (b.uid ? 0 : 1) || b.list.length - a.list.length)
  }, [data, byId])

  const patchEdit = (draftId: string, patch: Partial<Edit>) =>
    setEdits((m) => ({ ...m, [draftId]: { ...m[draftId], ...patch } }))

  const accept = async (d: Draft, quiet = false) => {
    const e = edits[d.id] ?? toEdit(d)
    if (!e.title.trim()) {
      showToast('ต้องมีชื่องาน', 'error')
      return false
    }
    await voiceFetch(`/api/voice/drafts/${d.id}/accept`, 'POST', e)
    if (!quiet) showToast('ลงบอร์ดงานแล้ว')
    return true
  }

  const acceptOne = async (d: Draft) => {
    setBusyDraft(d.id)
    try {
      if (await accept(d)) await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'รับงานไม่สำเร็จ', 'error')
    } finally {
      setBusyDraft(null)
    }
  }

  const acceptAll = async () => {
    const pending = (data?.drafts ?? []).filter((d) => d.status === 'pending')
    setBusyAll(true)
    let ok = 0
    try {
      for (const d of pending) {
        setBusyDraft(d.id)
        if (await accept(d, true)) ok++
      }
      showToast(`ลงบอร์ดงานแล้ว ${ok} งาน`)
    } catch (e) {
      showToast(`${e instanceof Error ? e.message : 'รับงานไม่สำเร็จ'} (สำเร็จไปแล้ว ${ok} งาน)`, 'error')
    } finally {
      setBusyDraft(null)
      setBusyAll(false)
      await load()
    }
  }

  const setDraftStatus = async (d: Draft, next: 'rejected' | 'pending') => {
    setBusyDraft(d.id)
    try {
      await voiceFetch(`/api/voice/drafts/${d.id}`, 'PATCH', next === 'rejected' ? { ...edits[d.id], status: next } : { status: next })
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', 'error')
    } finally {
      setBusyDraft(null)
    }
  }

  const remove = async () => {
    try {
      await voiceFetch(`/api/voice/recordings/${id}`, 'DELETE')
      showToast('ลบไฟล์เสียงแล้ว')
      router.push('/tasks/voice')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ลบไม่สำเร็จ', 'error')
    }
  }

  if (userData && !isAdmin) return <EmptyState title="เฉพาะแอดมิน" body="หน้านี้สำหรับผู้ดูแลระบบเท่านั้น" />
  if (loadError) return <EmptyState title="เปิดไม่ได้" body={loadError} />
  if (!data)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )

  const rec = data.recording
  const drafts = data.drafts
  const pendingCount = drafts.filter((d) => d.status === 'pending').length
  const brandOptions: SelectOption[] = [
    ...BRANDS.map((b) => ({ value: b.slug, label: b.label })),
    ...[...new Set(Object.values(edits).map((e) => e.brand))]
      .filter((b): b is string => !!b && !BRANDS.some((x) => x.slug === b))
      .map((b) => ({ value: b, label: brandLabel(b) })),
  ]
  const inProgress = !FINAL.has(status)
  const stepIndex = Math.max(0, STEPS.findIndex((x) => x.key === status))
  const q = data.queue

  return (
    <div className="space-y-4">
      <PageHeader
        title={rec.title || 'ไม่มีชื่อ'}
        description={[
          format(new Date(rec.recorded_at ?? rec.created_at), 'd/M/yyyy HH:mm'),
          durationText(rec.duration_sec),
          SOURCE_LABEL[rec.source] ?? rec.source,
        ]
          .filter(Boolean)
          .join(' · ')}
        icon={AudioLines}
        backHref="/tasks/voice"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={status} kind="voice" />
            <Button variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>
              ลบ
            </Button>
          </div>
        }
      />

      {data.audioUrl ? (
        <audio ref={audioRef} controls preload="none" src={data.audioUrl} className="w-full" />
      ) : rec.audio_deleted_at ? (
        <p className="text-xs text-gray-500">ไฟล์เสียงถูกลบตามกำหนด 90 วันแล้ว (ข้อความถอดเสียงยังอยู่)</p>
      ) : null}

      {inProgress && (
        <SectionCard title="กำลังทำงาน" description="ระบบทำในคิวเบื้องหลัง ปิดหน้านี้ได้ · หน้านี้อัปเดตเองทุก 30 วินาที">
          <ol className="space-y-2">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2">
                {i < stepIndex ? <Check size={18} className="text-green-600" /> : i === stepIndex ? <Spinner size="sm" /> : <span className="w-[18px]" />}
                <span className={i <= stepIndex ? 'text-gray-900' : 'text-gray-400'}>{s.label}</span>
              </li>
            ))}
          </ol>
        </SectionCard>
      )}

      {status === 'failed' && (
        <SectionCard title="ทำไม่สำเร็จ" description={rec.error || 'ไม่ทราบสาเหตุ'}>
          <Button icon={RotateCcw} onClick={retry} loading={retrying}>
            ลองใหม่
          </Button>
        </SectionCard>
      )}

      {(FINAL.has(status) || !!rec.summary) && (
        <SectionCard title="สรุปประชุม" description="เก็บไว้ที่ประชุมนี้ ไม่ขึ้นเป็นงานบนบอร์ด · AI สรุปให้ แก้ได้">
          <Textarea
            rows={8}
            value={summary}
            onChange={(ev) => {
              setSummary(ev.target.value)
              setSummaryDirty(true)
            }}
            placeholder="ยังไม่มีสรุป"
          />
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" onClick={saveSummary} disabled={!summaryDirty}>
              บันทึกสรุป
            </Button>
          </div>
        </SectionCard>
      )}

      {data.tasks.length > 0 && (
        <SectionCard title={`งานที่แจกแล้ว ${data.tasks.length} งาน`} description="แยกตามคนรับ · แตะเพื่อเปิดงานบนบอร์ด">
          <div className="divide-y divide-gray-100">
            {handedOut.map((g) => (
              <div key={g.uid || 'none'} className="py-3 first:pt-0 last:pb-0">
                <div className="mb-2 flex items-center gap-2">
                  {g.uid ? <UserAvatar userId={g.uid} name={g.name} size="sm" /> : <UserAvatar name="?" size="sm" />}
                  <p className="font-semibold text-gray-900">
                    {g.name} <span className="text-xs font-normal text-gray-500">{g.list.length} งาน</span>
                  </p>
                </div>
                <ul className="space-y-1">
                  {g.list.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className="flex w-full items-baseline gap-2 text-left hover:underline"
                        onClick={() => router.push(`/tasks?task=${t.id}`)}
                      >
                        <span className="text-gray-500">#{t.no}</span>
                        <span className={t.status === 'done' ? 'flex-1 text-gray-400 line-through' : 'flex-1 text-gray-900'}>{t.title}</span>
                        {t.due_date && <span className="text-xs text-gray-500">{format(new Date(`${t.due_date}T00:00:00`), 'd/M')}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {data.transcript && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title={`ร่างงาน ${drafts.length} รายการ`}
            description={drafts.length ? 'แก้ได้ทุกช่องก่อนกดรับ · กดเวลาที่ยกมาเพื่อฟังช่วงนั้น' : undefined}
          >
            {pendingCount > 0 && (
              <div className="mb-3 flex justify-end">
                <Button icon={Check} onClick={acceptAll} loading={busyAll} disabled={!!busyDraft && !busyAll}>
                  รับทั้งหมดที่รอตรวจ ({pendingCount})
                </Button>
              </div>
            )}
            {!drafts.length ? (
              <EmptyState
                size="sm"
                title={
                  data.tasks.length
                    ? 'ไม่มีร่างค้าง — งานแจกครบแล้ว (ดูด้านบน)'
                    : status === 'review' || status === 'done'
                      ? 'ไม่พบงานที่มอบหมายในเสียงนี้'
                      : 'ยังไม่มีร่างงาน'
                }
              />
            ) : (
              <div className="divide-y divide-gray-100">
                {drafts.map((d) => {
                  const e = edits[d.id] ?? toEdit(d)
                  const locked = d.status !== 'pending'
                  return (
                    <div key={d.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge status={d.status} kind="voiceDraft" />
                        {d.confidence != null && <span className="text-xs text-gray-500">มั่นใจ {Math.round(d.confidence * 100)}%</span>}
                      </div>
                      <Field label="ชื่องาน">
                        <Input value={e.title} disabled={locked} onChange={(ev) => patchEdit(d.id, { title: ev.target.value })} />
                      </Field>
                      <Field label="รายละเอียด">
                        <Textarea rows={3} value={e.notes} disabled={locked} onChange={(ev) => patchEdit(d.id, { notes: ev.target.value })} />
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="ผู้รับผิดชอบ" help={d.assignee_raw ? `ในเสียงพูดว่า "${d.assignee_raw}"` : undefined} asDiv>
                          <MultiSelectMenu
                            values={e.assignee_ids}
                            options={personOptions}
                            onChange={(v) => patchEdit(d.id, { assignee_ids: v })}
                            placeholder="ยังไม่ระบุ"
                            disabled={locked}
                          />
                        </Field>
                        <Field
                          label="ครบกำหนด"
                          asDiv
                          labelExtra={
                            e.due_date && !locked ? (
                              <Button variant="ghost" size="sm" onClick={() => patchEdit(d.id, { due_date: null })}>
                                ล้าง
                              </Button>
                            ) : undefined
                          }
                        >
                          <DatePicker
                            value={e.due_date ?? ''}
                            onChange={(v) => patchEdit(d.id, { due_date: v || null })}
                            placeholder="ไม่ได้กำหนด"
                            disabled={locked}
                          />
                        </Field>
                      </div>
                      <Field label="แบรนด์" asDiv>
                        <SelectMenu
                          value={e.brand}
                          options={brandOptions}
                          onChange={(v) => patchEdit(d.id, { brand: v })}
                          onCreate={(label) => patchEdit(d.id, { brand: label.trim().toLowerCase() })}
                          clearable="ไม่ระบุแบรนด์"
                          placeholder="ไม่ระบุแบรนด์"
                          disabled={locked}
                        />
                      </Field>
                      {d.evidence_quote && (
                        <p className="text-xs text-gray-500">
                          {d.evidence_start_sec != null && data.audioUrl ? (
                            <button type="button" className="mr-1 font-medium text-red-600" onClick={() => seek(d.evidence_start_sec)}>
                              [{clock(d.evidence_start_sec)}]
                            </button>
                          ) : d.evidence_start_sec != null ? (
                            <span className="mr-1">[{clock(d.evidence_start_sec)}]</span>
                          ) : null}
                          “{d.evidence_quote}”
                        </p>
                      )}
                      <div className="flex flex-wrap justify-end gap-2">
                        {d.status === 'pending' && (
                          <>
                            <Button variant="danger" icon={X} onClick={() => setDraftStatus(d, 'rejected')} disabled={!!busyDraft}>
                              ปัดตก
                            </Button>
                            <Button variant="secondary" icon={Check} onClick={() => acceptOne(d)} loading={busyDraft === d.id} disabled={!!busyDraft}>
                              รับเป็นงาน
                            </Button>
                          </>
                        )}
                        {d.status === 'rejected' && (
                          <Button variant="ghost" icon={RotateCcw} onClick={() => setDraftStatus(d, 'pending')} disabled={!!busyDraft}>
                            เปิดกลับมาตรวจ
                          </Button>
                        )}
                        {d.status === 'accepted' && (
                          <Button variant="ghost" onClick={() => router.push('/tasks')}>
                            ดูบนบอร์ดงาน
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          <div className="space-y-4">
            <SectionCard
              title="ใครเป็นผู้พูด"
              description={
                data.audioUrl
                  ? 'กด ▶ ฟังเสียงตัวอย่าง แล้วเลือกชื่อ · ระบบเดาไว้ให้บางคน'
                  : 'อ่านตัวอย่างคำพูด แล้วเลือกชื่อ · ระบบเดาไว้ให้บางคน'
              }
            >
              {!speakers.length ? (
                <p className="text-xs text-gray-500">ไม่มีเสียงพูดในไฟล์นี้</p>
              ) : (
                <div>
                  {speakers.map(([sp, n]) => {
                    const guess = data.transcript?.speaker_guesses?.[sp]
                    const uid = speakerMap[sp]
                    const person = uid ? byId.get(uid) : undefined
                    return (
                      <SpeakerRow
                        key={sp}
                        speaker={sp}
                        label={speakerLabel(sp)}
                        turns={n}
                        samples={pickSamples(data.transcript?.segments ?? [], sp)}
                        canPlay={!!data.audioUrl}
                        playingAt={sample}
                        onPlay={playSample}
                        avatar={person && <UserAvatar userId={person.user_id} name={personName(person)} size="sm" />}
                        help={guess?.reason || undefined}
                      >
                        <SelectMenu
                          value={uid ?? null}
                          options={personOptions}
                          onChange={(v) => {
                            setSpeakerMap((m) => ({ ...m, [sp]: v }))
                            setMapDirty(true)
                          }}
                          clearable="ไม่ทราบ"
                          placeholder="เลือกว่าใครพูด"
                        />
                      </SpeakerRow>
                    )
                  })}
                  <div className="flex justify-end pt-1">
                    <Button variant="secondary" onClick={saveSpeakers} disabled={!mapDirty}>
                      บันทึกชื่อผู้พูด
                    </Button>
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard title="ข้อความถอดเสียง">
              <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                {data.transcript.segments.map((s, i) => (
                  <div key={i}>
                    <div className="flex items-baseline gap-2 text-xs text-gray-500">
                      {data.audioUrl ? (
                        <button type="button" className="font-medium text-red-600" onClick={() => seek(s.start)}>
                          {clock(s.start)}
                        </button>
                      ) : (
                        <span>{clock(s.start)}</span>
                      )}
                      <SpeakerAvatar speaker={s.speaker} className="self-center" />
                      <span className="font-medium text-gray-700">{speakerName(s.speaker)}</span>
                    </div>
                    <p className="text-gray-900">{s.text}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {q.total > 0 && (inProgress || q.active) && (
        <QueueFloat
          title="เสียงประชุม"
          done={q.done}
          total={q.total}
          failed={q.failed}
          active={q.active}
          open={queueOpen}
          onOpenChange={setQueueOpen}
          unit="ขั้น"
          meta={[...q.running.map((x) => `กำลังทำ: ${x}`), ...q.waiting.map((x) => `รอคิว: ${x}`)].join(' · ') || undefined}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="ลบไฟล์เสียงนี้?"
        description="ลบเสียง ข้อความถอดเสียง และร่างงานที่ยังไม่รับ · งานที่รับลงบอร์ดไปแล้วยังอยู่"
        confirmLabel="ลบ"
        tone="danger"
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}
