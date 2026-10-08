'use client'

// แท็บ "คำเป้าหมาย" — อันดับรายสัปดาห์จาก DataForSEO (เฟส 2)
//
// ต่างจากแท็บคำค้น (GSC) ตรงที่: คำพวกนี้เราเลือกเองว่าอยากติด แม้ยังไม่เคยโผล่เลย
// อันดับ = ตัวเลขเดียว (ค่ากลาง 5 ครั้งล่าสุด — เจ้าของ 9 ต.ค. 69 "บอกไปว่าติดอันดับ xx ไปเลย")
// · กดชื่อคำ = เปิด Google ค้นเองในแท็บใหม่ · กดอันดับ/แถว = ประวัติรายวัน + คู่แข่ง 10 อันดับแรก

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CircleCheck,
  CircleMinus,
  CircleOff,
  CircleX,
  ExternalLink,
  ListOrdered,
  Loader2,
  MessageCircle,
  Plus,
  Radar,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import {
  Button,
  HelpTooltip,
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
  AEO_ENGINE_LABELS,
  getRankQueue,
  getSeoSettings,
  getTargetKeywords,
  setKeywordTracked,
  type RankQueue,
  type SeoSite,
  type TargetKeyword,
} from '@/lib/services/seo/seoService'
import { DISPLAY_ROUNDS, fmtDisplayRank, foundCount, RANK_DEPTH } from '@/lib/services/seo/rankRules'

type Filter = 'all' | 'top10' | 'top30' | 'none' | 'wrong'

const FILTERS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'top10', label: 'หน้าแรก (1–10)' },
  { value: 'top30', label: `อันดับ 11–${RANK_DEPTH}` },
  { value: 'none', label: `ไม่ติด ${RANK_DEPTH} อันดับแรก` },
  { value: 'wrong', label: 'ติดผิดหน้า' },
]

/** เปิด Google ไทยค้นคำนี้เอง (แท็บใหม่) — ผลจะต่างจากเครื่องกลางได้ เพราะ Google ปรับตามคนค้น */
const googleUrl = (q: string) => `https://www.google.co.th/search?q=${encodeURIComponent(q)}&hl=th&gl=th`

const PAGE_SIZE = 20

/** ล้างสไตล์ default ของ HelpTooltip (เส้นประ + cursor: help) — ป้ายเป็นตัวชี้อยู่แล้ว */
const PLAIN_TRIGGER = { textDecoration: 'none', cursor: 'default' }

function PopRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="aoo-pop__row">
      <span className="aoo-pop__label">{label}</span>
      <span>{children}</span>
    </div>
  )
}

/** โดเมนที่ AI อ้าง — ของเราเน้นสีเขียว */
function SourceChips({ domains, ours }: { domains: string[]; ours: string }) {
  const list = Array.from(new Set(domains.filter(Boolean))).slice(0, 10)
  if (!list.length) return <PopRow label="อ้างเว็บ">ไม่มีลิงก์ที่มา</PopRow>
  return (
    <PopRow label="อ้างเว็บ">
      <span className="aoo-pop__chips">
        {list.map((d) => (
          <span key={d} className="aoo-pop__chip" data-ours={d === ours || d.endsWith(`.${ours}`) ? '' : undefined}>
            {d}
          </span>
        ))}
      </span>
    </PopRow>
  )
}

/** ป้าย AI 1 ตัว: อ้างลิงก์เรา · พูดถึงชื่อ · อ้างคนอื่น · ไม่มีกล่อง AI */
type AiState = 'cited' | 'mentioned' | 'no' | 'nobox'
const AI_STATE: Record<AiState, { Icon: typeof CircleCheck; tone: 'success' | 'warning' | 'danger' | 'neutral'; text: string }> = {
  cited: { Icon: CircleCheck, tone: 'success', text: 'อ้างลิงก์เรา' },
  mentioned: { Icon: MessageCircle, tone: 'warning', text: 'พูดถึงชื่อเรา แต่ไม่ใส่ลิงก์' },
  no: { Icon: CircleX, tone: 'danger', text: 'แนะนำเว็บอื่น ไม่พูดถึงเรา' },
  nobox: { Icon: CircleMinus, tone: 'neutral', text: 'คำนี้ Google ไม่ขึ้นกล่อง AI' },
}

const pathOf = (url: string | null) => {
  if (!url) return null
  try {
    return decodeURIComponent(new URL(url).pathname) || '/'
  } catch {
    return url
  }
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
  /** ค้นหาคำในตาราง */
  const [q, setQ] = useState('')
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
    const detailed = checked.filter((k) => k.snapshots[0].detailed)
    return {
      checked: checked.length,
      top10: checked.filter((k) => k.rank != null && k.rank <= 10).length,
      top30: checked.filter((k) => k.rank != null).length,
      none: checked.filter((k) => k.rank == null).length,
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
        if (q.trim() && !k.keyword.toLowerCase().includes(q.trim().toLowerCase())) return false
        const checked = !!k.snapshots[0]
        if (filter === 'top10') return k.rank != null && k.rank <= 10
        if (filter === 'top30') return k.rank != null && k.rank > 10
        if (filter === 'none') return checked && k.rank == null
        if (filter === 'wrong') return wrongPage(k)
        return true
      }),
    [rows, filter, q],
  )
  // เปลี่ยนตัวกรอง = กลับหน้า 1
  useEffect(() => setPage(1), [filter, q, site.id])
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
            {/* เปิด Google ค้นเองในแท็บใหม่ — เช็คด้วยตาได้ (เจ้าของขอ 9 ต.ค. 69) */}
            <a
              href={googleUrl(k.keyword)}
              target="_blank"
              rel="noreferrer"
              title="เปิด Google ค้นคำนี้ในแท็บใหม่"
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {k.keyword}
              <ExternalLink size={12} className="ml-1 inline-block align-baseline text-gray-400" />
            </a>
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
      // ตัวเลขเดียว = ค่ากลาง 5 ครั้งล่าสุด (rankRules.displayRank) · กดดูประวัติรายวัน
      key: 'rank',
      header: 'อันดับ',
      align: 'right',
      sortValue: (k) => (k.snapshots[0] ? (k.rank ?? RANK_DEPTH + 1) : null),
      cell: (k) => {
        const cur = k.snapshots[0]
        if (!cur)
          return k.pending ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              กำลังเช็ค
            </span>
          ) : (
            <span className="text-gray-400">ยังไม่เช็ค</span>
          )
        // ขึ้น/ลง เทียบอันดับที่โชว์ก่อนรอบล่าสุด (ไม่ใช่ผลดิบครั้งเดียว)
        const d = k.rank != null && k.rankBefore != null ? k.rankBefore - k.rank : 0
        const tone = k.rank == null ? 'muted' : d > 0 ? 'success' : d < 0 ? 'danger' : undefined
        return (
          <button
            type="button"
            className="whitespace-nowrap text-right hover:underline"
            title="ดูประวัติอันดับรายวัน"
            onClick={(e) => {
              e.stopPropagation()
              setDetail(k)
            }}
          >
            <div className="inline-flex items-center justify-end gap-1.5">
              {d !== 0 && (
                <span className="aoo-delta inline-flex items-center gap-0.5" data-tone={tone}>
                  {d > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {Math.abs(d)}
                </span>
              )}
              <span className="aoo-rank" data-tone={tone}>
                {k.rank != null ? `#${k.rank}` : 'ไม่ติด'}
              </span>
            </div>
            <div className="text-xs text-gray-400">
              {k.rank == null ? `${RANK_DEPTH} อันดับแรก · ` : ''}เช็ค {fmtGscDate(cur.checkedOn)}
              {k.pending ? ' · รอผลรอบใหม่' : ''}
            </div>
          </button>
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
      // แยกทีละ AI ที่เราเน้น (เจ้าของขอ 7–8 ต.ค. 69) — โชว์ครบทุกตัวเสมอ · ชี้ที่ป้ายเพื่อดูรายละเอียด
      // (popover กลาง HelpTooltip ไม่ใช่ title ของ html) Google = กล่อง AI บนหน้าผลค้นหา · ที่เหลือ = คำถามที่ผูกคำนี้
      key: 'aio',
      header: 'AI อ้างเราไหม',
      cell: (k) => {
        const cur = k.snapshots[0]
        const rows: { label: string; state: AiState; detail: ReactNode }[] = []
        if (cur?.detailed) {
          const st: AiState = !cur.hasAiOverview ? 'nobox' : cur.aiOverviewCitesUs ? 'cited' : 'no'
          rows.push({
            label: 'Google',
            state: st,
            detail: (
              <>
                <PopRow label="ที่มา">กล่องคำตอบ AI บนหน้าผลค้นหา Google ของคำนี้</PopRow>
                <PopRow label="เช็คเมื่อ">{fmtGscDate(cur.checkedOn)}</PopRow>
                {cur.hasAiOverview && <SourceChips domains={cur.aiOverviewRefs.map((r) => r.domain)} ours={site.domain} />}
              </>
            ),
          })
        }
        // ChatGPT / Perplexity / Gemini: โชว์เฉพาะตัวที่เช็คคำนี้แล้ว (เจ้าของงง "ยังไม่มีคำถามผูกคำนี้" 9 ต.ค. 69)
        const chat = AEO_ENGINE_LABELS.filter((x) => engines.includes(x.key))
        const unchecked = chat.filter((e) => !k.ai[e.key])
        for (const e of chat) {
          const r = k.ai[e.key]
          if (!r) continue
          rows.push({
            label: e.label,
            state: r.cited ? 'cited' : r.mentioned ? 'mentioned' : 'no',
            detail: (
              <>
                <PopRow label="ถามว่า">&quot;{r.prompt}&quot;</PopRow>
                <PopRow label="ถามเมื่อ">
                  {fmtGscDate(r.checkedOn)}
                  {r.model ? ` · ${r.model}` : ''}
                </PopRow>
                <SourceChips domains={r.sources} ours={site.domain} />
              </>
            ),
          })
        }
        return (
          <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
            {rows.map((c) => {
              const st = AI_STATE[c.state]
              return (
                <HelpTooltip
                  key={c.label}
                  delay={150}
                  width={320}
                  triggerStyle={PLAIN_TRIGGER}
                  content={
                    <div className="aoo-pop">
                      <div className="aoo-pop__title">
                        <span className="aoo-status aoo-status--sm" data-tone={st.tone}>
                          <st.Icon size={14} />
                          {c.label}
                        </span>
                        · {st.text}
                      </div>
                      {c.detail}
                    </div>
                  }
                >
                  <span className="aoo-status aoo-status--sm" data-tone={st.tone}>
                    <st.Icon size={14} />
                    {c.label}
                  </span>
                </HelpTooltip>
              )
            })}
            {unchecked.length > 0 && (
              <HelpTooltip
                delay={150}
                width={320}
                triggerStyle={PLAIN_TRIGGER}
                content={
                  <div className="aoo-pop">
                    <div className="aoo-pop__title">{unchecked.map((e) => e.label).join(' · ')} ไม่ได้เช็คคำนี้</div>
                    <div>
                      Google เช็คให้ทุกคำอัตโนมัติ (ดูจากหน้าค้นหา) · ส่วน {unchecked.map((e) => e.label).join(' / ')}{' '}
                      ต้องจ่ายค่าถามทีละคำถาม จึงเช็คเฉพาะคำที่ตั้งคำถามไว้ในแท็บ &quot;AI ตอบ&quot; เท่านั้น
                    </div>
                  </div>
                }
              >
                <span className="text-xs text-gray-400">{unchecked.map((e) => e.label).join(' · ')}: ไม่ได้เช็ค</span>
              </HelpTooltip>
            )}
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
        <div>
          <h2 className="aoo-section-title">คำเป้าหมาย — สถานะ ณ วันนี้</h2>
          <p className="text-xs text-gray-500">
            เฉพาะ {tracked} คำที่เราเลือกติดตาม · อันดับ = ค่ากลางของครั้งที่เจอใน {DISPLAY_ROUNDS} ครั้งล่าสุด
            · ดู {RANK_DEPTH} อันดับแรก · เช็คทุก 7 วัน (คำที่อันดับนิ่งทุก 14 วัน · ผลเปลี่ยนเยอะเช็คซ้ำวันถัดไป)
            {stats.lastCheck ? ` · ล่าสุด ${fmtGscDate(stats.lastCheck)}` : ''}
          </p>
        </div>
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
            label="ติดหน้าแรก (1–10)"
            value={`${stats.top10}/${rows.length}`}
            icon={Trophy}
            tone="accent"
            hint="อันดับ 1–10"
          />
          <StatCard
            label={`ติด ${RANK_DEPTH} อันดับแรก`}
            value={`${stats.top30}/${rows.length}`}
            icon={CircleCheck}
            tone="success"
            hint={`อันดับ 1–${RANK_DEPTH} (หน้า 1–3)`}
          />
          <StatCard
            label="ยังไม่ติด"
            value={`${stats.none}/${rows.length}`}
            icon={CircleOff}
            tone="warning"
            hint={`ไม่อยู่ใน ${RANK_DEPTH} อันดับแรก`}
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
          <div className="flex flex-wrap items-center gap-2">
            <Segmented value={filter} onChange={(v) => setFilter(v as Filter)} options={FILTERS} />
            <div className="w-full sm:w-64">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาคำ…" aria-label="ค้นหาคำในตาราง" />
            </div>
          </div>
          {/* อธิบายแต่ละช่อง — เจ้าของงงว่า "มี · ไม่อ้างเรา" คืออะไร (6 ต.ค. 69) */}
          <div className="aoo-legend">
            <span><b>AI อ้างเราไหม</b> (แยกทีละตัว):</span>
            {(['cited', 'mentioned', 'no', 'nobox'] as AiState[]).map((st) => {
              const a = AI_STATE[st]
              return (
                <span key={st} className="aoo-status aoo-status--sm" data-tone={a.tone}>
                  <a.Icon size={14} />
                  {st === 'cited' ? 'อ้างลิงก์เรา' : st === 'mentioned' ? 'พูดถึงชื่อ' : st === 'no' ? 'ไม่พูดถึงเรา' : 'Google ไม่ขึ้นกล่อง AI'}
                </span>
              )
            })}
            <span>· Google เช็คทุกคำ · ChatGPT / Perplexity / Gemini เช็คเฉพาะคำที่ตั้งคำถามไว้ในแท็บ AI ตอบ</span>
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
        title={detail ? `"${detail.keyword}" · ${fmtDisplayRank(detail.rank)}` : ''}
        description={
          detail?.snapshots[0]
            ? `อันดับ = ค่ากลางของครั้งที่เจอใน ${DISPLAY_ROUNDS} ครั้งล่าสุด · Google ประเทศไทย · ดู ${RANK_DEPTH} อันดับแรก`
            : undefined
        }
        maxWidth={640}
      >
        {detail?.snapshots[0] && (
          <div className="space-y-4 text-sm">
            {/* ประวัติรายวัน (เจ้าของขอ 9 ต.ค. 69) — ผลดิบแต่ละครั้ง ใหม่ → เก่า */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 font-semibold text-gray-700">
                <ListOrdered size={16} /> ประวัติอันดับ
                {(() => {
                  const c = foundCount(detail.snapshots.map((x) => x.position))
                  return (
                    <span className="text-xs font-normal text-gray-500">
                      · เจอเว็บเรา {c.found} จาก {c.total} ครั้งล่าสุด
                    </span>
                  )
                })()}
              </p>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">วันที่เช็ค</th>
                      <th className="px-3 py-2 text-right font-medium">อันดับ</th>
                      <th className="px-3 py-2 text-left font-medium">หน้าที่ติด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.snapshots.map((x, i) => {
                      const older = detail.snapshots[i + 1]
                      const cur = x.position != null && x.position <= RANK_DEPTH ? x.position : null
                      const prev = older ? (older.position != null && older.position <= RANK_DEPTH ? older.position : null) : undefined
                      const d = cur != null && prev != null ? prev - cur : 0
                      return (
                        <tr key={x.checkedOn} className="border-t border-gray-100">
                          <td className="whitespace-nowrap px-3 py-1.5">{fmtGscDate(x.checkedOn)}</td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right">
                            {d !== 0 && (
                              <span className="aoo-delta mr-1.5 inline-flex items-center gap-0.5" data-tone={d > 0 ? 'success' : 'danger'}>
                                {d > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {Math.abs(d)}
                              </span>
                            )}
                            <span className={cur != null ? 'font-semibold' : 'text-gray-400'}>
                              {cur != null ? `#${cur}` : 'ไม่ติด'}
                            </span>
                          </td>
                          <td className="break-all px-3 py-1.5 text-gray-500">{pathOf(x.rankedUrl) ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {detail.gscPosition != null && (
                <p className="mt-2 text-xs text-gray-500">
                  คนค้นจริง (Search Console 7 วันล่าสุด) เห็นเราอันดับเฉลี่ย ~{detail.gscPosition.toFixed(1)}
                </p>
              )}
            </div>
            {!detail.snapshots[0].detailed && (
              <p className="text-gray-500">
                ผลรอบล่าสุดนำเข้าจากระบบแผน SEO เดิม มีแค่อันดับ — คู่แข่งและ AI Overview จะเห็นหลังเช็คผ่าน amgo
              </p>
            )}
            <div>
              <p className="mb-2 font-semibold text-gray-700">10 อันดับแรก (รอบล่าสุด {fmtGscDate(detail.snapshots[0].checkedOn)})</p>
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
          </div>
        )}
      </Modal>
    </div>
  )
}
