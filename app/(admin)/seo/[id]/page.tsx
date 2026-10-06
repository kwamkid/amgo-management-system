'use client'

// SEO / AEO — รายละเอียด 1 เว็บ
//
// กราฟรายวัน (มีเส้นเฉลี่ย 7 วันตัดการแกว่งเสาร์-อาทิตย์) + ตารางคำค้น/หน้า
// เทียบช่วงนี้กับช่วงก่อน — กรองได้ว่าคำไหน "ขึ้น / ตก / ใหม่ / หายไป"
// ซึ่งคือสิ่งที่ต้องดูหลังทำ SEO ไปแต่ละรอบ

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Eye, MousePointerClick, Percent, RefreshCw, TrendingUp } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Alert, Button, Input, TabBar, TabItem } from '@/components/aoo'
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
  COMPARE_OPTIONS,
  compareGsc,
  DETAIL_DAYS,
  fmtCtr,
  fmtGscDate,
  fmtNum,
  fmtPct,
  fmtPosDelta,
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
  const [dim, setDim] = useState<'query' | 'page'>('query')
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<CompareRow[] | null>(null)
  const [shown, setShown] = useState(PAGE_SIZE)
  const [syncing, setSyncing] = useState(false)

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

  const syncNow = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/cron/seo/gsc-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'ดึงข้อมูลไม่สำเร็จ')
      const r = json.results?.[0]
      showToast(r ? r.detail : 'ไม่มีเว็บให้ดึง', r?.status === 'error' ? 'error' : 'success')
      await loadSite()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSyncing(false)
    }
  }

  const stats = useMemo(
    () => (per ? { cur: sumTotals(totals, per.cur.from, per.cur.to), prev: sumTotals(totals, per.prev.from, per.prev.to) } : null),
    [totals, per?.cur.from, per?.cur.to, per?.prev.from] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const chartPoints = useMemo(() => {
    if (!per) return []
    // ช่วงสั้นกว่า 28 วันยังโชว์กราฟ 28 วัน — 7 จุดดูทิศทางไม่ออก
    const from = addDays(per.cur.to, -(Math.max(days, 28) - 1))
    const byDate = new Map(totals.map((t) => [t.date, t]))
    const pts = []
    for (let d = from; d <= per.cur.to; d = addDays(d, 1)) {
      const t = byDate.get(d)
      pts.push({
        date: d,
        value: !t
          ? metric === 'position' || metric === 'ctr'
            ? null
            : 0
          : metric === 'clicks'
            ? t.clicks
            : metric === 'impressions'
              ? t.impressions
              : metric === 'ctr'
                ? t.ctr * 100
                : t.position,
      })
    }
    return pts
  }, [totals, per?.cur.to, days, metric]) // eslint-disable-line react-hooks/exhaustive-deps

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
        actions={
          <Button icon={RefreshCw} loading={syncing} onClick={syncNow}>
            ดึงข้อมูลตอนนี้
          </Button>
        }
      />

      {site.lastError && (
        <Alert tone="error" title="ดึงข้อมูลล่าสุดไม่สำเร็จ" className="mb-4">
          {site.lastError}
        </Alert>
      )}
      {!site.backfillDone && site.backfillFrom && (
        <Alert tone="info" className="mb-4">
          กำลังดึงข้อมูลย้อนหลัง — คำค้นตอนนี้มีถึง {fmtGscDate(site.backfillFrom)} · ช่วงยาว ๆ อาจยังไม่ครบ (กด
          &quot;ดึงข้อมูลตอนนี้&quot; ซ้ำเพื่อเร่งได้)
        </Alert>
      )}

      {!per || !stats ? (
        <SectionCard>
          <p className="text-sm text-gray-500">ยังไม่มีข้อมูล — กด &quot;ดึงข้อมูลตอนนี้&quot;</p>
        </SectionCard>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Segmented value={range} onChange={setRange} options={RANGES} />
            <Segmented value={mode} onChange={(v) => setMode(v as CompareMode)} options={COMPARE_OPTIONS} />
            <span className="text-xs text-gray-400">{periodLabel(per)}</span>
          </div>

          <StatGrid cols={4}>
            <StatCard label="คลิก" value={fmtNum(stats.cur.clicks)} icon={MousePointerClick} tone="accent"
              hint={fmtPct(stats.cur.clicks, stats.prev.clicks)} />
            <StatCard label="การแสดงผล" value={fmtNum(stats.cur.impressions)} icon={Eye} tone="grape"
              hint={fmtPct(stats.cur.impressions, stats.prev.impressions)} />
            <StatCard label="CTR" value={fmtCtr(stats.cur.ctr)} icon={Percent} tone="success"
              hint={stats.prev.impressions ? `ช่วงก่อน ${fmtCtr(stats.prev.ctr)}` : 'ไม่มีช่วงก่อน'} />
            <StatCard label="อันดับเฉลี่ย" value={stats.cur.position?.toFixed(1) ?? '—'} icon={TrendingUp} tone="warning"
              hint={fmtPosDelta(stats.cur.position, stats.prev.position)} />
          </StatGrid>

          <SectionCard
            className="mb-6"
            title={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>แนวโน้มรายวัน</span>
                <Segmented value={metric} onChange={setMetric} options={METRICS} />
              </div>
            }
          >
            <TrendChart
              points={chartPoints}
              tone={metric === 'clicks' ? 'accent' : metric === 'impressions' ? 'grape' : metric === 'ctr' ? 'success' : 'warning'}
              invert={metric === 'position'}
              label={METRICS.find((m) => m.value === metric)?.label}
              format={(v) =>
                metric === 'ctr' ? `${v.toFixed(1)}%` : metric === 'position' ? v.toFixed(1) : fmtNum(Math.round(v))
              }
            />
          </SectionCard>

          <TabBar ariaLabel="มุมมอง" className="mb-3">
            <TabItem active={dim === 'query'} onClick={() => setDim('query')} label="คำค้นที่ Google เจอเรา" />
            <TabItem active={dim === 'page'} onClick={() => setDim('page')} label="หน้า" />
          </TabBar>

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
