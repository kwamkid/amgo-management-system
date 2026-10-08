'use client'

// SEO / AEO — รายละเอียด 1 เว็บ
//
// กราฟรายวัน (มีเส้นเฉลี่ย 7 วันตัดการแกว่งเสาร์-อาทิตย์) + ตารางคำค้น/หน้า
// เทียบช่วงนี้กับช่วงก่อน — กรองได้ว่าคำไหน "ขึ้น / ตก / ใหม่ / หายไป"
// ซึ่งคือสิ่งที่ต้องดูหลังทำ SEO ไปแต่ละรอบ

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Eye, MousePointerClick, Percent, Search, TrendingUp } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Alert, Button, Input, TabBar, TabItem } from '@/components/aoo'
import TargetKeywords from './TargetKeywords'
import AiAnswers from './AiAnswers'
import {
  DataTable,
  PageHeader,
  SectionCard,
  Segmented,
  SiteFavicon,
  StatCard,
  StatGrid,
  TechLoader,
  TrendChart,
  type Column,
} from '@/components/shared'
import {
  addDays,
  compareOptions,
  compareGsc,
  DETAIL_DAYS,
  fmtCtr,
  fmtGscDate,
  fmtNum,
  fmtPct,
  fmtPosDelta,
  getBingTotals,
  getDailyTotals,
  getSeoSite,
  periodLabel,
  periods,
  sumTotals,
  type CompareMode,
  type CompareRow,
  type DailyTotal,
  type SeoSite,
} from '@/lib/services/seo/seoService'

const RANGES = [
  { value: '7', label: '7 วัน' },
  { value: '28', label: '28 วัน' },
  { value: '90', label: '3 เดือน' },
  { value: '180', label: '6 เดือน' },
  { value: '365', label: '1 ปี' },
]

const METRICS = [
  { value: 'clicks', label: 'คลิก' },
  { value: 'impressions', label: 'การแสดงผล' },
  { value: 'ctr', label: 'CTR' },
  { value: 'position', label: 'อันดับ' },
]

const FILTERS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'up', label: 'อันดับขึ้น' },
  { value: 'down', label: 'อันดับตก' },
  { value: 'new', label: 'ใหม่' },
  { value: 'lost', label: 'หายไป' },
]

const PAGE_SIZE = 100

/** อันดับขยับเกินนี้ถึงนับว่า "ขึ้น/ตก" — ต่ำกว่านี้เป็นการแกว่งปกติ */
const POS_STEP = 1

type Status = 'up' | 'down' | 'new' | 'lost' | 'same'

function statusOf(r: CompareRow, curFrom: string, historyFrom: string | null): Status {
  if (!r.impressions && r.prevImpressions) return 'lost'
  // "ใหม่" ต้องมีประวัติก่อนหน้าให้เทียบ — คำที่เห็นครั้งแรกตั้งแต่วันแรกของ backfill ไม่นับ
  if (!r.prevImpressions && r.firstSeen && r.firstSeen >= curFrom && (!historyFrom || r.firstSeen > historyFrom))
    return 'new'
  if (r.position != null && r.prevPosition != null) {
    if (r.prevPosition - r.position >= POS_STEP) return 'up'
    if (r.position - r.prevPosition >= POS_STEP) return 'down'
  }
  return 'same'
}

export default function SeoSitePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [site, setSite] = useState<SeoSite | null>(null)
  const [totals, setTotals] = useState<DailyTotal[]>([])
  const [range, setRange] = useState('28')
  const [mode, setMode] = useState<CompareMode>('prev')
  const [metric, setMetric] = useState('clicks')
  // แท็บแรก = คำเป้าหมาย เพราะเว็บใหม่ยังไม่มีข้อมูล GSC ให้ดู
  const [tab, setTab] = useState<'target' | 'ai' | 'query' | 'page'>('target')
  const dim: 'query' | 'page' = tab === 'page' ? 'page' : 'query'
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<CompareRow[] | null>(null)
  const [shown, setShown] = useState(PAGE_SIZE)

  const canSee = !!userData?.hasWebAccess

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  const loadSite = async () => {
    try {
      const s = await getSeoSite(id)
      setSite(s)
      if (s.syncedThrough) {
        const map = await getDailyTotals([s.id], addDays(s.syncedThrough, -760)) // 1 ปี + เทียบปีก่อน
        setTotals(map.get(s.id) ?? [])
      }
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  useEffect(() => {
    if (canSee) loadSite()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee, id])

  const days = Number(range)
  const per = site?.syncedThrough ? periods(site.syncedThrough, days, mode) : null

  // ตารางคำค้นเก็บแค่ 90 วัน — เทียบได้เฉพาะเมื่อทั้งช่วงนี้และช่วงก่อนอยู่ใน 90 วัน
  // (เทียบปีก่อน / ช่วงยาว ใช้ได้กับการ์ดและกราฟ ซึ่งมาจากยอดรวมที่เก็บไว้ตลอด)
  const canCompare = mode === 'prev' && days * 2 <= DETAIL_DAYS

  // Bing ช่วงเดียวกัน — โชว์บรรทัดเดียวใต้ตัวเลือกช่วง (ไม่มีข้อมูล = ไม่โชว์ · ต้องตั้ง BING_WEBMASTER_API_KEY)
  const [bing, setBing] = useState<{ clicks: number; impressions: number } | null>(null)
  useEffect(() => {
    if (!site?.id || !per) return
    getBingTotals(site.id, per.cur.from, per.cur.to).then(setBing).catch(() => setBing(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id, per?.cur.from, per?.cur.to])
  const tableDays = Math.min(days, DETAIL_DAYS)
  const table = site?.syncedThrough
    ? canCompare
      ? per!
      : { cur: periods(site.syncedThrough, tableDays).cur, prev: { from: '1900-01-01', to: '1900-01-01' } }
    : null
  // วันเก่าสุดที่มีคำค้นจริง — "คำใหม่" ต้องเจอหลังวันนี้ ไม่ใช่แค่เพราะของเก่าถูกลบ
  const detailFrom =
    site?.syncedThrough && site.backfillFrom
      ? [site.backfillFrom, addDays(site.syncedThrough, -(DETAIL_DAYS - 1))].sort()[1]
      : null

  useEffect(() => {
    if (!site || !table) return
    setRows(null)
    setShown(PAGE_SIZE)
    compareGsc(site.id, dim, table.cur, table.prev)
      .then(setRows)
      .catch((e) => {
        showToast((e as Error).message, 'error')
        setRows([])
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id, site?.syncedThrough, dim, range, canCompare])

  // วันแรกที่มีข้อมูล GSC — Google เก็บย้อนหลังได้แค่ 16 เดือน ช่วงเทียบที่เก่ากว่านี้ข้อมูลไม่ครบ
  const earliest = useMemo(() => totals.reduce((m, t) => (!m || t.date < m ? t.date : m), ''), [totals])
  const prevPartial = !!per && !!earliest && per.prev.from < earliest
  const stats = useMemo(
    () => (per ? { cur: sumTotals(totals, per.cur.from, per.cur.to), prev: sumTotals(totals, per.prev.from, per.prev.to) } : null),
    [totals, per?.cur.from, per?.cur.to, per?.prev.from] // eslint-disable-line react-hooks/exhaustive-deps
  )
  /** ช่วงเทียบข้อมูลไม่ครบ = ไม่โชว์ % (240% ที่เห็นคือเทียบกับข้อมูลแค่ 4 เดือน เจ้าของงง 8 ต.ค. 69) */
  const partialHint = `เทียบไม่ได้ — ข้อมูลมีตั้งแต่ ${fmtGscDate(earliest)}`

  // กราฟ: ≤ 28 วัน = รายวัน · ยาวกว่านั้น = รายสัปดาห์ (1 ปีรายวัน = 365 แท่งคู่ บางจนดูไม่ออก — เจ้าของ 8 ต.ค. 69)
  // ช่วงเทียบ = ช่วงเดียวกันที่เลื่อนวันด้วยระยะเดียวกับการ์ด (ช่วงก่อน = ถอย N วัน · ปีก่อน = ถอย 364 วัน ตรงวันในสัปดาห์)
  const bucketDays = days > 28 ? 7 : 1
  const { chartPoints, chartCompare, chartLabel } = useMemo(() => {
    if (!per) return { chartPoints: [], chartCompare: undefined, chartLabel: '' }
    const byDate = new Map(totals.map((t) => [t.date, t]))
    // ช่วงสั้นกว่า 28 วันยังโชว์กราฟ 28 วัน — 7 จุดดูทิศทางไม่ออก
    const span = Math.max(days, 28)
    const nBuckets = Math.floor(span / bucketDays)
    const shift = Math.round((Date.parse(per.cur.to) - Date.parse(per.prev.to)) / 864e5)

    /** รวมค่าในถังที่จบวันที่ end ย้อนไป bucketDays วัน */
    const bucket = (end: string) => {
      let clicks = 0
      let imp = 0
      let posW = 0
      let any = false
      for (let i = 0; i < bucketDays; i++) {
        const t = byDate.get(addDays(end, -i))
        if (!t) continue
        any = true
        clicks += t.clicks
        imp += t.impressions
        if (t.position != null) posW += t.position * t.impressions
      }
      // ก่อนวันแรกที่มีข้อมูล = ไม่รู้ (null) ไม่ใช่ 0 — ไม่งั้นช่วงเทียบกลายเป็นเส้นแบนที่ศูนย์
      if (end < earliest) return null
      if (!any) return metric === 'position' || metric === 'ctr' ? null : 0
      if (metric === 'clicks') return clicks
      if (metric === 'impressions') return imp
      if (metric === 'ctr') return imp ? (clicks / imp) * 100 : null
      return imp ? posW / imp : null
    }

    const ends: string[] = []
    for (let b = nBuckets - 1; b >= 0; b--) ends.push(addDays(per.cur.to, -b * bucketDays))
    const pts = ends.map((e) => ({ date: addDays(e, -(bucketDays - 1)), value: bucket(e) }))
    const cmpDates = ends.map((e) => addDays(e, -shift))
    const cmpValues = cmpDates.map((e) => bucket(e))
    const hasCmp = cmpValues.some((v) => v != null && v !== 0)
    // ชื่อในคำอธิบายสี = ช่วงวันที่จริงของกราฟ (เจ้าของงง "ช่วงนี้ / 7 วัน / ปีก่อน" 8 ต.ค. 69)
    // วันที่แบบตัวเลข 9/9/69 – 6/10/69 (เจ้าของขอ 8 ต.ค. 69 อ่านง่ายกว่า "9 ก.ย. 69")
    const num = (d: string) => {
      const [y, m, dd] = d.split('-').map(Number)
      return `${dd}/${m}/${String((y + 543) % 100).padStart(2, '0')}`
    }
    const range = (from: string, to: string) => `${num(from)} – ${num(to)}`
    const cmpFrom = addDays(cmpDates[0], -(bucketDays - 1))
    return {
      chartPoints: pts,
      chartLabel: range(pts[0].date, ends[ends.length - 1]),
      chartCompare: hasCmp
        ? {
            values: cmpValues,
            dates: cmpDates.map((e) => addDays(e, -(bucketDays - 1))),
            // ชื่อสั้น ตรงกับปุ่มเทียบ — วันที่อยู่ใน legend ต่อท้าย
            label: mode === 'yoy' ? 'ปีที่แล้ว' : 'ก่อนหน้า',
            legend:
              range(cmpFrom, cmpDates[cmpDates.length - 1]) +
              (cmpFrom < earliest ? ` (Google เก็บข้อมูลย้อนหลังได้ 16 เดือน — มีตั้งแต่ ${num(earliest)})` : ''),
          }
        : undefined,
    }
  }, [totals, per?.cur.to, per?.prev.to, days, metric, mode, bucketDays, earliest]) // eslint-disable-line react-hooks/exhaustive-deps

  const withStatus = useMemo(
    () =>
      rows && table
        ? rows.map((r) => ({ ...r, status: canCompare ? statusOf(r, table.cur.from, detailFrom) : ('same' as Status) }))
        : [],
    [rows, table?.cur.from, detailFrom, canCompare] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: withStatus.length, up: 0, down: 0, new: 0, lost: 0 }
    for (const r of withStatus) if (r.status !== 'same') c[r.status]++
    return c
  }, [withStatus])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return withStatus.filter(
      (r) => (filter === 'all' || r.status === filter) && (!needle || r.key.toLowerCase().includes(needle))
    )
  }, [withStatus, filter, q])

  if (!canSee || !site) return <TechLoader />

  const shortPage = (url: string) => {
    try {
      const u = new URL(url)
      return decodeURIComponent(u.pathname + u.search) || '/'
    } catch {
      return url
    }
  }

  type Row = (typeof withStatus)[number]
  const columns: Column<Row>[] = [
    {
      key: 'key',
      header: dim === 'query' ? 'คำค้น' : 'หน้า',
      mobilePrimary: true,
      sticky: true,
      width: 220,
      sortValue: (r) => r.key,
      cell: (r) => (
        <div className="min-w-0">
          <div className="break-words font-medium text-gray-900">{dim === 'page' ? shortPage(r.key) : r.key}</div>
          {r.status === 'new' && <div className="aoo-delta" data-tone="success">เจอครั้งแรก {fmtGscDate(r.firstSeen)}</div>}
          {r.status === 'lost' && <div className="aoo-delta" data-tone="danger">ช่วงนี้ไม่ขึ้นเลย</div>}
        </div>
      ),
    },
    {
      key: 'clicks',
      header: 'คลิก',
      align: 'right',
      sortValue: (r) => r.clicks,
      cell: (r) => (
        <div>
          <div className="font-semibold">{fmtNum(r.clicks)}</div>
          {canCompare && <div className="text-xs text-gray-400">ก่อน {fmtNum(r.prevClicks)}</div>}
        </div>
      ),
    },
    {
      key: 'impressions',
      header: 'การแสดงผล',
      align: 'right',
      sortValue: (r) => r.impressions,
      cell: (r) => (
        <div>
          <div>{fmtNum(r.impressions)}</div>
          {canCompare && <div className="text-xs text-gray-400">{fmtPct(r.impressions, r.prevImpressions)}</div>}
        </div>
      ),
    },
    {
      key: 'position',
      header: 'อันดับเฉลี่ย',
      align: 'right',
      sortValue: (r) => r.position,
      cell: (r) => (
        <div>
          <div className="font-semibold">{r.position?.toFixed(1) ?? '—'}</div>
          {canCompare && (
            <div
              className="aoo-delta"
              data-tone={r.status === 'up' ? 'success' : r.status === 'down' ? 'danger' : 'muted'}
            >
              {r.prevPosition != null ? `ก่อน ${r.prevPosition.toFixed(1)} · ` : ''}
              {fmtPosDelta(r.position, r.prevPosition)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'ctr',
      header: 'CTR',
      align: 'right',
      hideOnMobile: true,
      sortValue: (r) => (r.impressions ? r.clicks / r.impressions : null),
      cell: (r) => (r.impressions ? fmtCtr(r.clicks / r.impressions) : '—'),
    },
  ]

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <SiteFavicon domain={site.domain} size={24} />
            {site.displayName}
          </span>
        }
        description={`${site.domain} · ข้อมูลถึง ${fmtGscDate(site.syncedThrough)} (เวลา US)`}
        icon={TrendingUp}
        backHref="/seo"
      />

      {site.lastError && (
        <Alert tone="error" title="ดึงข้อมูลล่าสุดไม่สำเร็จ" className="mb-4">
          {site.lastError}
        </Alert>
      )}
      {!site.backfillDone && site.backfillFrom && (
        <Alert tone="info" className="mb-4">
          กำลังดึงข้อมูลย้อนหลัง — คำค้นตอนนี้มีถึง {fmtGscDate(site.backfillFrom)} · ช่วงยาว ๆ อาจยังไม่ครบ
          (ระบบดึงต่อให้ทุกเช้าตี 4)
        </Alert>
      )}

      {!per || !stats ? (
        <SectionCard>
          <p className="text-sm text-gray-500">ยังไม่มีข้อมูล — ระบบดึงให้รอบตี 4</p>
        </SectionCard>
      ) : (
        <>
          {/* สถิติ 2 ชุดในหน้านี้ (เจ้าของงง 8 ต.ค. 69) — ชุดนี้ = ทั้งเว็บจาก Search Console ตามช่วงวันที่เลือก
              ชุดล่างในแท็บคำเป้าหมาย = สถานะคำที่เราติดตาม ณ วันนี้ ไม่ขึ้นกับช่วงวันที่ */}
          <h2 className="aoo-section-title">
            ภาพรวมทั้งเว็บ
            <span className="aoo-source-badge">
              <Search size={13} />
              Google Search Console
            </span>
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            นับทุกคำที่คนค้นแล้วเจอเว็บเรา ตามช่วงวันที่ที่เลือก · ข้อมูลช้า 2–3 วัน
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Segmented value={range} onChange={setRange} options={RANGES} />
            <Segmented value={mode} onChange={(v) => setMode(v as CompareMode)} options={compareOptions(days)} />
            <span className="text-xs text-gray-400">{periodLabel(per)}</span>
            {bing && (
              <span className="text-xs text-gray-500">
                · Bing ช่วงนี้: คลิก {fmtNum(bing.clicks)} · การแสดงผล {fmtNum(bing.impressions)}
              </span>
            )}
          </div>

          <StatGrid cols={4}>
            <StatCard variant="soft" onClick={() => setMetric('clicks')} selected={metric === 'clicks'} label="คลิก" value={fmtNum(stats.cur.clicks)} icon={MousePointerClick} tone="accent"
              hint={prevPartial ? partialHint : fmtPct(stats.cur.clicks, stats.prev.clicks)} />
            <StatCard variant="soft" onClick={() => setMetric('impressions')} selected={metric === 'impressions'} label="การแสดงผล" value={fmtNum(stats.cur.impressions)} icon={Eye} tone="grape"
              hint={prevPartial ? partialHint : fmtPct(stats.cur.impressions, stats.prev.impressions)} />
            <StatCard variant="soft" onClick={() => setMetric('ctr')} selected={metric === 'ctr'} label="CTR" value={fmtCtr(stats.cur.ctr)} icon={Percent} tone="success"
              hint={prevPartial ? partialHint : stats.prev.impressions ? `ช่วงก่อน ${fmtCtr(stats.prev.ctr)}` : 'ไม่มีช่วงก่อน'} />
            <StatCard variant="soft" onClick={() => setMetric('position')} selected={metric === 'position'} label="อันดับเฉลี่ย" value={stats.cur.position?.toFixed(1) ?? '—'} icon={TrendingUp} tone="warning"
              hint={prevPartial ? partialHint : fmtPosDelta(stats.cur.position, stats.prev.position)} />
          </StatGrid>

          <SectionCard
            className="mb-6"
            title={
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  แนวโน้ม{bucketDays > 1 ? 'รายสัปดาห์' : 'รายวัน'} · {METRICS.find((m) => m.value === metric)?.label}
                </span>
                <span className="text-xs font-normal text-gray-400">กดการ์ดข้างบนเพื่อเปลี่ยนตัวเลขที่ดู</span>
              </div>
            }
          >
            <TrendChart
              points={chartPoints}
              compare={chartCompare}
              periodLabel={chartLabel}
              periodName={mode === 'yoy' ? 'ปีนี้' : 'ช่วงที่ดู'}
              bucket={bucketDays > 1 ? 'week' : 'day'}
              tone={metric === 'clicks' ? 'accent' : metric === 'impressions' ? 'grape' : metric === 'ctr' ? 'success' : 'warning'}
              invert={metric === 'position'}
              label={METRICS.find((m) => m.value === metric)?.label}
              format={(v) =>
                metric === 'ctr' ? `${v.toFixed(1)}%` : metric === 'position' ? v.toFixed(1) : fmtNum(Math.round(v))
              }
            />
          </SectionCard>

        </>
      )}

      <TabBar ariaLabel="มุมมอง" className="mb-3 mt-2">
        <TabItem active={tab === 'target'} onClick={() => setTab('target')} label="คำเป้าหมาย (อันดับ)" />
        <TabItem active={tab === 'ai'} onClick={() => setTab('ai')} label="AI ตอบ (AEO)" />
        <TabItem active={tab === 'query'} onClick={() => setTab('query')} label="คำค้นที่ Google เจอเรา" />
        <TabItem active={tab === 'page'} onClick={() => setTab('page')} label="หน้า" />
      </TabBar>

      {tab === 'target' ? (
        <TargetKeywords site={site} />
      ) : tab === 'ai' ? (
        <AiAnswers site={site} />
      ) : !per || !stats ? (
        <SectionCard>
          <p className="text-sm text-gray-500">ยังไม่มีข้อมูลจาก Search Console — Google ยังไม่เคยแสดงเว็บนี้ หรือยังไม่ได้ดึงข้อมูล</p>
        </SectionCard>
      ) : (
        <>

      {!canCompare && (
        <Alert tone="info" compact className="mb-3">
          ตารางนี้แสดงแค่ {tableDays} วันล่าสุด ไม่มีตัวเลขเทียบ — ระบบเก็บคำค้นย้อนหลังแค่ {DETAIL_DAYS} วัน
          จึงเทียบได้เฉพาะ &quot;เทียบช่วงก่อน&quot; แบบ 7 หรือ 28 วัน (การ์ดกับกราฟด้านบนเทียบได้ทุกแบบ)
        </Alert>
      )}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        {canCompare && (
        <Segmented
          value={filter}
          onChange={(v) => {
            setFilter(v)
            setShown(PAGE_SIZE)
          }}
          options={FILTERS.map((f) => ({ ...f, label: `${f.label} ${rows ? counts[f.value] : ''}`.trim() }))}
        />
        )}
        <div className="sm:w-64">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={dim === 'query' ? 'ค้นคำ…' : 'ค้นหน้า…'}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered.slice(0, shown)}
        rowKey={(r) => r.key}
        loading={rows === null}
        emptyTitle="ไม่มีรายการในตัวกรองนี้"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
            <span>
              แสดง {Math.min(shown, filtered.length)} จาก {filtered.length} รายการ · ไม่รวมคำค้นที่ Google
              ซ่อนไว้ (ค้นน้อยมาก) ยอดรวมด้านบนจึงสูงกว่าผลรวมในตาราง
              {rows && rows.length >= 1000 ? ' · แสดง 1,000 อันดับแรกตามคลิก' : ''}
            </span>
            {shown < filtered.length && (
              <Button size="sm" variant="secondary" onClick={() => setShown(shown + PAGE_SIZE)}>
                แสดงเพิ่ม
              </Button>
            )}
          </div>
        }
      />
        </>
      )}
    </div>
  )
}
