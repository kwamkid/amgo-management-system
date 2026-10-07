'use client'

// แท็บ "คำเป้าหมาย" — อันดับรายสัปดาห์จาก DataForSEO (เฟส 2)
//
// ต่างจากแท็บคำค้น (GSC) ตรงที่: คำพวกนี้เราเลือกเองว่าอยากติด แม้ยังไม่เคยโผล่เลย
// เห็นอันดับ (หรือ "ไม่ติด") · ขึ้นลงจากรอบก่อน · หน้าที่ติดตรงกับหน้าเป้าหมายไหม
// · หน้าผลลัพธ์มี AI Overview ไหม อ้างเราไหม · กดแถวเพื่อดูคู่แข่ง 10 อันดับแรก

import { useEffect, useMemo, useState } from 'react'
import {
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CircleMinus,
  CircleOff,
  CircleX,
  ImageIcon,
  Loader2,
  MessageCircle,
  Plus,
  Radar,
  Search,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import {
  Alert,
  Button,
  Field,
  IconButton,
  Input,
  Modal,
  Pill,
  Select,
  Textarea,
  Toggle,
  useConfirm,
} from '@/components/aoo'
import { DataTable, QueueFloat, Segmented, StatCard, StatGrid, TableFooter, type Column } from '@/components/shared'
import {
  addTargetKeywords,
  deleteTargetKeyword,
  fmtGscDate,
  fmtNum,
  fmtRank,
  AEO_ENGINE_LABELS,
  getRankQueue,
  getSeoSettings,
  getTargetKeywords,
  setKeywordTracked,
  type RankQueue,
  type SeoSite,
  type TargetKeyword,
} from '@/lib/services/seo/seoService'
import {
  MIN_SAMPLES_TO_SAY_NONE,
  RANK_STATUS_LABEL,
  SERP_FEATURE_LABEL,
  type RankStatus,
} from '@/lib/services/seo/rankRules'

type Filter = 'all' | 'solid' | 'sometimes' | 'checking' | 'none' | 'top10' | 'wrong'

const FILTERS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'solid', label: 'ติดจริง' },
  { value: 'sometimes', label: 'โผล่บางครั้ง' },
  { value: 'checking', label: 'ยังไม่แน่ใจ' },
  { value: 'none', label: 'ยังไม่ติด' },
  { value: 'top10', label: 'หน้าแรก (ติดจริง)' },
  { value: 'wrong', label: 'ติดผิดหน้า' },
]

const PAGE_SIZE = 20

/** ไอคอน + สีของสถานะ "ติดจริงไหม" — ใช้ทั้งในตารางและคำอธิบาย */
const STATUS_ICON: Record<RankStatus, { Icon: typeof CircleCheck; tone: 'success' | 'warning' | 'info' | 'neutral' }> = {
  solid: { Icon: CircleCheck, tone: 'success' },
  sometimes: { Icon: CircleDashed, tone: 'warning' },
  checking: { Icon: CircleHelp, tone: 'info' },
  none: { Icon: CircleOff, tone: 'neutral' },
  unknown: { Icon: CircleHelp, tone: 'neutral' },
}

/** ป้าย AI 1 ตัว: อ้างลิงก์เรา · พูดถึงชื่อ · อ้างคนอื่น · ไม่มีกล่อง AI / ยังไม่ถาม */
type AiState = 'cited' | 'mentioned' | 'no' | 'nobox' | 'unasked'
const AI_STATE: Record<AiState, { Icon: typeof CircleCheck; tone: 'success' | 'warning' | 'danger' | 'neutral'; text: string }> = {
  cited: { Icon: CircleCheck, tone: 'success', text: 'อ้างลิงก์เรา' },
  mentioned: { Icon: MessageCircle, tone: 'warning', text: 'พูดถึงชื่อเรา แต่ไม่ใส่ลิงก์' },
  no: { Icon: CircleX, tone: 'danger', text: 'แนะนำเว็บอื่น ไม่พูดถึงเรา' },
  nobox: { Icon: CircleMinus, tone: 'neutral', text: 'คำนี้ Google ไม่ขึ้นกล่อง AI' },
  unasked: { Icon: CircleMinus, tone: 'neutral', text: 'ยังไม่มีคำถามผูกคำนี้ (เพิ่มได้ในแท็บ AI ตอบ)' },
}

const pathOf = (url: string | null) => {
  if (!url) return null
  try {
    return decodeURIComponent(new URL(url).pathname) || '/'
  } catch {
    return url
  }
}

/** ขยับกี่อันดับจากรอบก่อน — บวก = ดีขึ้น · null = เทียบไม่ได้ */
function delta(k: TargetKeyword): number | null {
  const [cur, prev] = k.snapshots
  if (!cur || !prev) return null
  if (cur.position == null && prev.position == null) return null
  // ไม่ติด = 101 ไว้คิดระยะ (เพิ่งติด / เพิ่งหลุด ก็ยังเห็นว่าขยับเยอะ)
  return (prev.position ?? 101) - (cur.position ?? 101)
}

/** ถามผลทุกกี่วิ ตอนมีงานรอ */
const POLL_MS = 30_000
/** รอบที่เสร็จแล้วยังโชว์แผงค้างไว้กี่นาที — ให้เห็นว่าจบแล้ว */
const SHOW_DONE_MIN = 60

const clock = (iso: string | number) =>
  new Date(iso).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  })


const wrongPage = (k: TargetKeyword) => {
  const cur = k.snapshots[0]
  return !!(k.targetPath && cur?.rankedUrl && pathOf(cur.rankedUrl) !== k.targetPath)
}

export default function TargetKeywords({ site }: { site: SeoSite }) {
  const { showToast } = useToast()
  const { confirm, dialog } = useConfirm()
  const [rows, setRows] = useState<TargetKeyword[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  /** AI ที่เปิดใช้ในตั้งค่า — คอลัมน์ AI โชว์ครบทุกตัวนี้เสมอ */
  const [engines, setEngines] = useState<string[]>(AEO_ENGINE_LABELS.map((e) => e.key))
  const [busy, setBusy] = useState<'check' | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    lines: '',
    groupName: '',
    targetPath: '',
    priority: '2',
  })
  const [saving, setSaving] = useState(false)
  /** ช่องเสริม (กลุ่ม/หน้า/ความสำคัญ) ซ่อนไว้ — ปกติแค่วางคำบรรทัดละคำ */
  const [moreOpts, setMoreOpts] = useState(false)
  const [detail, setDetail] = useState<TargetKeyword | null>(null)
  const [queue, setQueue] = useState<RankQueue | null>(null)
  /** เวลาที่กดเช็ค — ใช้โชว์ "กำลังส่งเข้าคิว" จนกว่างานจะโผล่ */
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  /** แผงคิวเปิดอยู่ไหม — ปิดแล้วเหลือปุ่มกลมมุมขวาล่าง */
  const [queueOpen, setQueueOpen] = useState(true)

  const loadQueue = () =>
    getRankQueue(site.id)
      .then(setQueue)
      .catch(() => {})

  const load = () =>
    Promise.all([
      getTargetKeywords(site.id)
        .then(setRows)
        .catch((e) => {
          showToast(e.message, 'error')
          setRows([])
        }),
      loadQueue(),
    ])

  useEffect(() => {
    load()
    getSeoSettings()
      .then((st) => setEngines(st.aeoEngines))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id])

  /**
   * ลงคิวเช็คอันดับแล้วจบ — งานเดินฝั่งเซิร์ฟเวอร์ ผลกลับมาเองทาง pingback ปิดหน้าได้
   * หน้าเว็บแค่โหลดสถานะใหม่เป็นระยะ (อ่านอย่างเดียว ไม่ได้ไปถามผลเอง)
   */
  const check = async () => {
    setBusy('check')
    try {
      const res = await fetch('/api/cron/seo/rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: site.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'ไม่สำเร็จ')
      setStartedAt(Date.now())
      setQueueOpen(true)
      showToast('ลงคิวเช็คอันดับแล้ว — ปิดหน้านี้ได้ ผลกลับมาเอง')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  // เพิ่งกดเช็ค (รองานส่งออก ~ไม่กี่วิ) หรือยังมีคำรอผล = โหลดสถานะใหม่เป็นระยะ · หยุดเองเมื่อจบ
  const pendingCount = queue?.pending ?? 0
  const starting = !!startedAt && Date.now() - startedAt < 2 * 60_000 && !(queue && new Date(queue.postedAt).getTime() >= startedAt - 5_000)
  useEffect(() => {
    if (!pendingCount && !starting) return
    const t = setInterval(
      () => {
        setNow(Date.now())
        load()
      },
      starting ? 5_000 : POLL_MS
    )
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount, starting, site.id])

  const add = async () => {
    setSaving(true)
    try {
      const n = await addTargetKeywords(
        site.id,
        moreOpts ? { ...form, priority: Number(form.priority) } : { lines: form.lines },
      )
      showToast(`บันทึก ${n} คำ`)
      setAdding(false)
      setForm({ lines: '', groupName: '', targetPath: '', priority: '2' })
      await load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (k: TargetKeyword) => {
    const ok = await confirm({
      title: `ลบคำ "${k.keyword}"?`,
      description: 'ประวัติอันดับของคำนี้จะหายด้วย ถ้าแค่ไม่อยากเสียเงินเช็ค ให้ปิดสวิตช์ติดตามแทน',
      confirmLabel: 'ลบ',
      tone: 'danger',
    })
    if (!ok) return
    await deleteTargetKeyword(k.id).catch((e) => showToast(e.message, 'error'))
    load()
  }

  const toggle = async (k: TargetKeyword, v: boolean) => {
    setRows((r) => r?.map((x) => (x.id === k.id ? { ...x, isTracked: v } : x)) ?? null)
    await setKeywordTracked(k.id, v).catch((e) => showToast(e.message, 'error'))
  }

  const stats = useMemo(() => {
    const list = rows ?? []
    const checked = list.filter((k) => k.snapshots[0])
    const solid = list.filter((k) => k.confidence.status === 'solid')
    const detailed = checked.filter((k) => k.snapshots[0].detailed)
    return {
      checked: checked.length,
      solid: solid.length,
      sometimes: list.filter((k) => k.confidence.status === 'sometimes').length,
      // หน้าแรกนับเฉพาะคำที่ติดจริง — อันดับครั้งเดียวที่ Google สลับมาให้ไม่นับ
      top10: solid.filter((k) => (k.snapshots[0]?.position ?? k.gscPosition ?? 999) <= 10).length,
      ranked: checked.filter((k) => k.snapshots[0].position != null).length,
      aio: detailed.filter((k) => k.snapshots[0].hasAiOverview).length,
      aioUs: detailed.filter((k) => k.snapshots[0].aiOverviewCitesUs).length,
      aioChecked: detailed.length,
      lastCheck:
        checked
          .map((k) => k.snapshots[0].checkedOn)
          .sort()
          .pop() ?? null,
      pending: list.filter((k) => k.pending).length,
    }
  }, [rows])

  const filtered = useMemo(
    () =>
      (rows ?? []).filter((k) => {
        const st = k.confidence.status
        if (filter === 'solid' || filter === 'sometimes' || filter === 'checking') return st === filter
        if (filter === 'none') return st === 'none'
        if (filter === 'top10') return st === 'solid' && (k.snapshots[0]?.position ?? k.gscPosition ?? 999) <= 10
        if (filter === 'wrong') return wrongPage(k)
        return true
      }),
    [rows, filter],
  )
  // เปลี่ยนตัวกรอง = กลับหน้า 1
  useEffect(() => setPage(1), [filter, site.id])
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns: Column<TargetKeyword>[] = [
    {
      key: 'keyword',
      header: 'คำเป้าหมาย',
      mobilePrimary: true,
      sticky: true,
      width: 200,
      sortValue: (k) => k.keyword,
      cell: (k) => (
        <div className="min-w-0">
          <div className="break-words font-medium text-gray-900">
            {k.keyword}
            {k.priority === 1 && (
              <Pill tone="accent" className="ml-1.5">
                หลัก
              </Pill>
            )}
          </div>
          <div className="text-xs text-gray-400">{[k.groupName, k.targetPath].filter(Boolean).join(' · ') || '—'}</div>
        </div>
      ),
    },
    {
      key: 'volume',
      header: 'ค้นหา/เดือน',
      align: 'right',
      hideOnMobile: true,
      sortValue: (k) => k.searchVolume,
      cell: (k) => (k.searchVolume != null ? fmtNum(k.searchVolume) : '—'),
    },
    {
      // อันดับ + แนวโน้มในช่องเดียว (เจ้าของขอ) — ขึ้น = เขียวสด · ลง = แดง
      key: 'rank',
      header: 'อันดับ',
      align: 'right',
      sortValue: (k) => (k.snapshots[0] ? (k.snapshots[0].position ?? 101) : null),
      cell: (k) => {
        const cur = k.snapshots[0]
        const d = delta(k)
        if (k.pending)
          return (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              กำลังเช็ค
            </span>
          )
        if (!cur) return <span className="text-gray-400">ยังไม่เช็ค</span>
        // ร่วงหนักรอบเดียว = ยังไม่เชื่อ (SERP แกว่ง) — โชว์สีปกติ + "รอเช็คซ้ำ" แทนแดง "หลุด"
        const tone = k.dropUnconfirmed || d == null || d === 0 ? undefined : d > 0 ? 'success' : 'danger'
        return (
          <div className="whitespace-nowrap text-right">
            <div className="inline-flex items-center justify-end gap-1.5">
              <span className="aoo-rank" data-tone={tone}>
                {fmtRank(cur.position)}
              </span>
              {k.dropUnconfirmed ? (
                <span
                  className="aoo-delta"
                  data-tone="warning"
                  title="รอบนี้ร่วงหนักผิดปกติ ระบบจะเช็คซ้ำให้พรุ่งนี้ก่อนสรุป"
                >
                  รอเช็คซ้ำ
                </span>
              ) : (
                d != null &&
                d !== 0 && (
                  <span className="aoo-delta inline-flex items-center gap-0.5" data-tone={tone}>
                    {d > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {Math.abs(d) > 90 ? (d > 0 ? 'เพิ่งติด' : 'หลุด') : Math.abs(d)}
                  </span>
                )
              )}
            </div>
            <div className="text-xs text-gray-400">เช็ค {fmtGscDate(cur.checkedOn)}</div>
          </div>
        )
      },
    },
    {
      // ติดจริงไหม — รวมประวัติ 4 รอบ + GSC (เจ้าของขอ 8 ต.ค. 69: อันดับครั้งเดียวแกว่ง อ่านแล้วไม่ต่อกัน)
      key: 'status',
      header: 'ติดจริงไหม',
      sortValue: (k) => ({ solid: 0, sometimes: 1, checking: 2, none: 3, unknown: 4 })[k.confidence.status],
      cell: (k) => {
        const c = k.confidence
        const { Icon, tone } = STATUS_ICON[c.status]
        return (
          <div className="whitespace-nowrap">
            <span className="aoo-status" data-tone={tone}>
              <Icon size={16} />
              {RANK_STATUS_LABEL[c.status]}
            </span>
            {c.samples > 0 && (
              <div
                className="flex items-center gap-1 text-xs text-gray-500"
                title={`Google ไทย (ค้นจากเครื่องกลาง) ${c.days} วันล่าสุดใน 35 วัน — เจอลิงก์เว็บเรากี่ครั้ง${
                  c.organicSeen ? ` · Google ให้ดูลิงก์ปกติแค่ ${c.organicSeen} อันดับ` : ''
                }`}
              >
                <Search size={12} /> เจอ {c.hits}/{c.samples} ครั้ง ({c.days} วัน)
                {!c.hits && c.organicSeen ? ` · ไม่อยู่ใน ${c.organicSeen} ลิงก์แรก` : ''}
              </div>
            )}
            {c.features.length > 0 && (
              <div
                className="flex items-center gap-1 text-xs text-gray-500"
                title="เราโผล่ในส่วนอื่นของหน้า Google — Search Console นับตำแหน่งนี้เป็นอันดับด้วย"
              >
                <ImageIcon size={12} />
                {c.features.map((f) => `โผล่ใน${SERP_FEATURE_LABEL[f.type] ?? f.type} ตำแหน่ง ${f.rank}`).join(' · ')}
              </div>
            )}
            {c.status === 'checking' && (
              <div className="text-xs text-gray-400">
                ข้อมูลยังน้อย ({c.samples}/{MIN_SAMPLES_TO_SAY_NONE} ครั้ง) — ระบบเช็คเพิ่มให้วันละครั้ง
              </div>
            )}
            {(k.gscPosition != null || c.share != null) && (
              <div
                className="flex items-center gap-1 text-xs text-gray-500"
                title="Search Console 10 วันล่าสุด: อันดับเฉลี่ยคิดเฉพาะครั้งที่โผล่ · % = การแสดงผล ÷ ยอดค้นหาโดยประมาณ (เห็นเรา 1% แต่อันดับ 7 = Google แค่ลองแสดง)"
              >
                <Users size={12} />
                คนจริง {k.gscPosition != null ? `~${k.gscPosition.toFixed(1)}` : 'ไม่เห็นเรา'}
                {c.share != null && ` · เห็นเรา ${Math.round(c.share * 100)}%`}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'page',
      header: 'หน้าที่ติด',
      hideOnMobile: true,
      cell: (k) => {
        const cur = k.snapshots[0]
        const p = pathOf(cur?.rankedUrl ?? null)
        if (!p) return <span className="text-gray-400">—</span>
        return (
          <div>
            <div className="break-all text-sm">{p}</div>
            {wrongPage(k) && (
              <div className="aoo-delta" data-tone="warning">
                ติดผิดหน้า (เป้า {k.targetPath})
              </div>
            )}
          </div>
        )
      },
    },
    {
      // แยกทีละ AI ที่เราเน้น (เจ้าของขอ 7–8 ต.ค. 69) — โชว์ครบทุกตัวเสมอ ไม่มีข้อมูลก็บอกว่ายังไม่ถาม
      // Google = กล่อง AI บนหน้าผลค้นหา · ที่เหลือ = คำถามในแท็บ AI ตอบที่ผูกคำนี้
      key: 'aio',
      header: 'AI อ้างเราไหม',
      cell: (k) => {
        const cur = k.snapshots[0]
        const chips: { label: string; state: AiState }[] = []
        // ประวัติที่นำเข้ามีแค่อันดับ — ไม่รู้ว่ามี AI Overview ไหม อย่าเดาว่า "ไม่มี"
        if (cur?.detailed)
          chips.push({ label: 'Google', state: !cur.hasAiOverview ? 'nobox' : cur.aiOverviewCitesUs ? 'cited' : 'no' })
        for (const e of AEO_ENGINE_LABELS.filter((x) => engines.includes(x.key))) {
          const r = k.ai[e.key]
          chips.push({ label: e.label, state: !r ? 'unasked' : r.cited ? 'cited' : r.mentioned ? 'mentioned' : 'no' })
        }
        return (
          <div className="flex flex-col gap-0.5">
            {chips.map((c) => {
              const st = AI_STATE[c.state]
              return (
                <span key={c.label} className="aoo-status aoo-status--sm" data-tone={st.tone} title={`${c.label}: ${st.text}`}>
                  <st.Icon size={14} />
                  {c.label}
                </span>
              )
            })}
          </div>
        )
      },
    },
    {
      key: 'checked',
      header: 'เช็คล่าสุด',
      sortValue: (k) => k.snapshots[0]?.checkedOn ?? null,
      cell: (k) => {
        const cur = k.snapshots[0]
        if (!cur) return <span className="text-gray-400">{k.pending ? 'รอผล…' : '—'}</span>
        return (
          <div className="whitespace-nowrap text-sm">
            {fmtGscDate(cur.checkedOn)}
            {k.pending && <div className="text-xs text-gray-400">มีรอบใหม่รอผล</div>}
          </div>
        )
      },
    },
    {
      key: 'tracked',
      header: 'ติดตาม',
      align: 'center',
      cell: (k) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Toggle checked={k.isTracked} onChange={(v) => toggle(k, v)} size="sm" aria-label="ติดตามคำนี้" />
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      mobileFooterAction: true,
      cell: (k) => (
        <div onClick={(e) => e.stopPropagation()}>
          <IconButton icon={Trash2} tone="danger" aria-label="ลบคำ" onClick={() => remove(k)} />
        </div>
      ),
    },
  ]

  const tracked = (rows ?? []).filter((k) => k.isTracked).length
  const showQueue = !!queue && (queue.pending > 0 || now - new Date(queue.postedAt).getTime() < SHOW_DONE_MIN * 60_000)

  return (
    <div>
      {dialog}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-400">
          เช็คอัตโนมัติสัปดาห์ละครั้ง (Google ประเทศไทย) · ติดตาม {tracked} คำ
          {stats.lastCheck ? ` · ล่าสุด ${fmtGscDate(stats.lastCheck)}` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAdding(true)}>
            เพิ่มคำ
          </Button>
          <Button size="sm" icon={Radar} loading={busy === 'check'} onClick={check} disabled={!tracked}>
            เช็คอันดับตอนนี้
          </Button>
        </div>
      </div>

      {(starting || (showQueue && queue)) && (
        <QueueFloat
          title={starting ? 'กำลังส่งเข้าคิวเช็คอันดับ' : 'เช็คอันดับ'}
          unit="คำ"
          done={queue && !starting ? queue.done + queue.failed : 0}
          total={queue && !starting ? queue.total : 0}
          failed={queue && !starting ? queue.failed : 0}
          active={starting || pendingCount > 0}
          open={queueOpen}
          onOpenChange={setQueueOpen}
          meta={
            starting
              ? 'รอเซิร์ฟเวอร์ส่งคำไป DataForSEO ไม่กี่วินาที'
              : `ส่งเข้าคิว ${clock(queue!.postedAt)}${
                  pendingCount
                    ? ' · ผลแต่ละคำกลับมาเองเมื่อเสร็จ (ปกติ 5–30 นาที) · ปิดหน้านี้ได้ ผลไม่หาย'
                    : ''
                }`
          }
        />
      )}

      {rows && rows.length > 0 && (
        <StatGrid cols={4}>
          <StatCard
            label="ติดจริง"
            value={`${stats.solid}/${rows.length}`}
            icon={CircleCheck}
            tone="success"
            hint="เจอบ่อยในประวัติ 4 รอบ หรือคนค้นเห็นเรา ≥ 50%"
          />
          <StatCard
            label="ติดหน้าแรก (จริง)"
            value={`${stats.top10}/${rows.length}`}
            icon={Trophy}
            tone="accent"
            hint="ติดจริง + อันดับ 1–10"
          />
          <StatCard
            label="โผล่บางครั้ง"
            value={`${stats.sometimes}/${rows.length}`}
            icon={CircleDashed}
            tone="warning"
            hint="Google ลองแสดงเราบ้าง ยังไม่ติดจริง"
          />
          <StatCard
            label="Google AI อ้างเรา"
            value={stats.aioChecked ? `${stats.aioUs}/${stats.aio}` : '—'}
            icon={Sparkles}
            tone="grape"
            hint={stats.aioChecked ? `จากคำที่มีกล่อง AI ${stats.aio} คำ` : 'รู้หลังเช็คผ่าน amgo รอบแรก'}
          />
        </StatGrid>
      )}

      {rows && rows.length > 0 && (
        <div className="mb-3">
          <Segmented value={filter} onChange={(v) => setFilter(v as Filter)} options={FILTERS} />
          {/* อธิบายแต่ละช่อง — เจ้าของงงว่า "มี · ไม่อ้างเรา" คืออะไร (6 ต.ค. 69) */}
          <div className="aoo-legend">
            <span><b>ติดจริงไหม</b> (รวมประวัติ 4 รอบ + คนค้นจริง ไม่ดูอันดับครั้งเดียว):</span>
            {(['solid', 'sometimes', 'checking', 'none'] as RankStatus[]).map((st) => {
              const { Icon, tone } = STATUS_ICON[st]
              return (
                <span key={st} className="aoo-status aoo-status--sm" data-tone={tone}>
                  <Icon size={14} />
                  {RANK_STATUS_LABEL[st]}
                </span>
              )
            })}
            <span className="inline-flex items-center gap-1">
              <Search size={12} /> เจอกี่ครั้งตอน Google ไทยค้นจากเครื่องกลาง
            </span>
            <span className="inline-flex items-center gap-1">
              <Users size={12} /> คนค้นจริง (Search Console) — อันดับเฉลี่ยตอนโผล่ · เห็นเรากี่ % ของคนค้น
            </span>
            <span className="inline-flex items-center gap-1">
              <ImageIcon size={12} /> โผล่ในกล่องรูป/แผนที่ (GSC นับเป็นอันดับด้วย)
            </span>
          </div>
          <div className="aoo-legend">
            <span><b>AI อ้างเราไหม</b> (แยกทีละตัว):</span>
            {(['cited', 'mentioned', 'no', 'unasked'] as AiState[]).map((st) => {
              const a = AI_STATE[st]
              return (
                <span key={st} className="aoo-status aoo-status--sm" data-tone={a.tone}>
                  <a.Icon size={14} />
                  {st === 'cited' ? 'อ้างลิงก์เรา' : st === 'mentioned' ? 'พูดถึงชื่อ' : st === 'no' ? 'ไม่พูดถึงเรา' : 'ยังไม่ถาม / ไม่มีกล่อง AI'}
                </span>
              )
            })}
            <span>· ChatGPT / Perplexity / Gemini มาจากคำถามที่ผูกคำนี้ในแท็บ AI ตอบ</span>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={paged}
        rowKey={(k) => k.id}
        loading={rows === null}
        onRowClick={(k) => k.snapshots[0] && setDetail(k)}
        emptyTitle={rows?.length ? 'ไม่มีคำในตัวกรองนี้' : 'ยังไม่มีคำเป้าหมาย'}
        emptyBody={rows?.length ? undefined : 'กด "เพิ่มคำ" แล้ววางรายการคำ บรรทัดละคำ'}
      />
      <TableFooter page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} unit="คำ" />

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="เพิ่มคำเป้าหมาย"
        maxWidth={560}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              ยกเลิก
            </Button>
            <Button loading={saving} onClick={add} disabled={!form.lines.trim()}>
              บันทึก
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="คำ (บรรทัดละคำ)"
            required
            help='วางได้ทีละหลายคำ · ใส่ยอดค้นหาท้ายบรรทัดได้ เช่น "รวมแชท, 210" · คำที่มีอยู่แล้วไม่เพิ่มซ้ำ'
          >
            <Textarea
              rows={8}
              autoFocus
              value={form.lines}
              onChange={(e) => setForm({ ...form, lines: e.target.value })}
              placeholder={'รวมแชท\nระบบรวมแชท\nโปรแกรมตอบแชท'}
            />
          </Field>
          <button
            type="button"
            className="text-sm font-medium text-gray-500 underline"
            onClick={() => setMoreOpts((v) => !v)}
          >
            {moreOpts ? 'ซ่อนตัวเลือกเพิ่มเติม' : 'ตัวเลือกเพิ่มเติม (กลุ่ม · หน้าเป้าหมาย · ความสำคัญ)'}
          </button>
          {moreOpts && (
            <>
              <Field label="กลุ่มคำ">
                <Input
                  value={form.groupName}
                  onChange={(e) => setForm({ ...form, groupName: e.target.value })}
                  placeholder="แชท"
                />
              </Field>
              <Field
                label="หน้าเป้าหมาย"
                help="path ของหน้าที่อยากให้ติด เช่น /features/chat — ใช้เตือนเมื่อ Google เอาหน้าอื่นไปติดแทน"
              >
                <Input
                  value={form.targetPath}
                  onChange={(e) => setForm({ ...form, targetPath: e.target.value })}
                  placeholder="/features/chat"
                />
              </Field>
              <Field label="ความสำคัญ">
                <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="1">1 · คำหลักของหน้า</option>
                  <option value="2">2 · คำรอง</option>
                  <option value="3">3 · ติดตามไว้ดู</option>
                </Select>
              </Field>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `"${detail.keyword}" · ${fmtRank(detail.snapshots[0]?.position)}` : ''}
        description={
          detail?.snapshots[0] ? `เช็คเมื่อ ${fmtGscDate(detail.snapshots[0].checkedOn)} · Google ประเทศไทย` : undefined
        }
        maxWidth={640}
      >
        {detail?.snapshots[0] && (
          <div className="space-y-4 text-sm">
            {!detail.snapshots[0].detailed && (
              <p className="text-gray-500">
                ผลรอบนี้นำเข้าจากระบบแผน SEO เดิม มีแค่อันดับ — คู่แข่งและ AI Overview จะเห็นหลังเช็คผ่าน amgo
              </p>
            )}
            <div>
              <p className="mb-2 font-semibold text-gray-700">10 อันดับแรก</p>
              <ol className="space-y-1">
                {detail.snapshots[0].topCompetitors.map((c) => (
                  <li key={`${c.rank}-${c.url}`} className="flex gap-2">
                    <span className="w-6 shrink-0 text-right text-gray-400">{c.rank}</span>
                    <a href={c.url} target="_blank" rel="noreferrer" className="min-w-0 break-words hover:underline">
                      <span className={c.domain.endsWith(site.domain) ? 'font-semibold' : ''}>{c.domain}</span>
                      <span className="block text-xs text-gray-400">{c.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
            {detail.snapshots[0].hasAiOverview && (
              <div>
                <p className="mb-2 font-semibold text-gray-700">AI Overview อ้างถึง</p>
                {detail.snapshots[0].aiOverviewRefs.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set(detail.snapshots[0].aiOverviewRefs.map((r) => r.domain))).map((d) => (
                      <Pill key={d} tone={d.endsWith(site.domain) ? 'success' : 'neutral'}>
                        {d}
                      </Pill>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">ไม่มีลิงก์อ้างอิง</p>
                )}
              </div>
            )}
            {detail.snapshots.length > 1 && (
              <Alert tone="info" compact>
                ประวัติ:{' '}
                {detail.snapshots
                  .slice(0, 8)
                  .map((s) => `${fmtGscDate(s.checkedOn)} ${fmtRank(s.position)}`)
                  .join(' · ')}
              </Alert>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
