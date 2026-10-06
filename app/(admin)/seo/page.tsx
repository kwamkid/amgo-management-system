'use client'

// SEO / AEO — ภาพรวมทุกเว็บ
//
// คำถามเดียวที่หน้านี้ต้องตอบ: "งาน SEO ที่ทำไป ทำให้เว็บดีขึ้นหรือยัง"
// การ์ดต่อเว็บเทียบช่วงนี้กับช่วงก่อนที่ยาวเท่ากัน นับถอยจากวันล่าสุดที่ GSC มีข้อมูล
//
// เมนูส่วนตัวของเจ้าของ: RLS ปล่อยเฉพาะคนใน web_owners

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, MousePointerClick, Percent, RefreshCw, Search, Settings, TrendingUp } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Alert, Button, EmptyState, Pill } from '@/components/aoo'
import { PageHeader, SectionCard, Segmented, SiteFavicon, Sparkline, StatCard, StatGrid, TechLoader } from '@/components/shared'
import {
  addDays,
  COMPARE_OPTIONS,
  fmtCtr,
  fmtGscDate,
  fmtNum,
  fmtPct,
  fmtPosDelta,
  getDailyTotals,
  getSeoSites,
  periods,
  sumTotals,
  type CompareMode,
  type DailyTotal,
  type SeoSite,
} from '@/lib/services/seo/seoService'

const RANGES = [
  { value: '7', label: '7 วัน' },
  { value: '28', label: '28 วัน' },
  { value: '90', label: '90 วัน' },
]

export default function SeoOverviewPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [sites, setSites] = useState<SeoSite[] | null>(null)
  const [totals, setTotals] = useState<Map<string, DailyTotal[]>>(new Map())
  const [range, setRange] = useState('28')
  const [mode, setMode] = useState<CompareMode>('prev')
  const [syncing, setSyncing] = useState(false)

  const canSee = !!userData?.hasWebAccess

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  const load = async () => {
    try {
      const list = (await getSeoSites()).filter((s) => s.isActive)
      // ดึงพอสำหรับเทียบปีก่อนของช่วงยาวสุด (90 + 364 วัน)
      const latest = list.map((s) => s.syncedThrough).filter(Boolean).sort().pop()
      const from = addDays(latest ?? new Date().toISOString().slice(0, 10), -460)
      setTotals(await getDailyTotals(list.map((s) => s.id), from))
      setSites(list)
    } catch (e) {
      showToast((e as Error).message, 'error')
      setSites([])
    }
  }

  useEffect(() => {
    if (canSee) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee])

  // ปกติ cron ดึงทุกเช้า — ปุ่มนี้ไว้ดึงทันที และกดซ้ำเพื่อเร่ง backfill ได้
  const syncNow = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/cron/seo/gsc-daily', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'ดึงข้อมูลไม่สำเร็จ')
      const results = json.results as { site: string; status: string; detail: string }[]
      const bad = results.filter((r) => r.status !== 'ok')
      showToast(
        bad.length
          ? bad.map((r) => `${r.site}: ${r.detail}`).join(' · ')
          : `ดึงแล้ว ${results.length} เว็บ`,
        bad.some((r) => r.status === 'error') ? 'error' : 'success'
      )
      await load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSyncing(false)
    }
  }

  if (!canSee || sites === null) return <TechLoader />

  return (
    <div>
      <PageHeader
        title="SEO / AEO"
        description="ผลบน Google Search รายวัน — ดูว่างานที่ทำไปได้ผลหรือยัง"
        icon={TrendingUp}
        actions={
          <>
            <Button variant="secondary" icon={Settings} href="/seo/settings">
              ตั้งค่าเว็บ
            </Button>
            <Button icon={RefreshCw} loading={syncing} onClick={syncNow} disabled={!sites.length}>
              ดึงข้อมูลตอนนี้
            </Button>
          </>
        }
      />

      {!sites.length ? (
        <SectionCard>
          <EmptyState
            icon={<Search size={28} />}
            title="ยังไม่มีเว็บที่ติดตาม"
            body="เพิ่มเว็บและใส่ property ของ Search Console ก่อน ระบบจะดึงข้อมูลย้อนหลัง 16 เดือนให้เอง"
            action={<Button href="/seo/settings">เพิ่มเว็บ</Button>}
          />
        </SectionCard>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Segmented value={range} onChange={setRange} options={RANGES} />
            <Segmented value={mode} onChange={(v) => setMode(v as CompareMode)} options={COMPARE_OPTIONS} />
          </div>
          <div className="space-y-4">
            {sites.map((s) => (
              <SiteCard key={s.id} site={s} rows={totals.get(s.id) ?? []} days={Number(range)} mode={mode} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SiteCard({ site, rows, days, mode }: { site: SeoSite; rows: DailyTotal[]; days: number; mode: CompareMode }) {
  const stats = useMemo(() => {
    if (!site.syncedThrough) return null
    const { cur, prev } = periods(site.syncedThrough, days, mode)
    return { cur: sumTotals(rows, cur.from, cur.to), prev: sumTotals(rows, prev.from, prev.to), from: cur.from }
  }, [site.syncedThrough, rows, days, mode])

  const spark = rows.filter((r) => stats && r.date >= stats.from).map((r) => r.clicks)

  return (
    <SectionCard
      title={
        <div className="flex flex-wrap items-center gap-2">
          <SiteFavicon domain={site.domain} />
          <Link href={`/seo/${site.id}`} className="text-base font-bold text-gray-900 hover:underline">
            {site.displayName}
          </Link>
          <span className="text-xs font-normal text-gray-400">{site.domain}</span>
          {site.gscAccess === 'denied' && <Pill tone="danger">ไม่มีสิทธิ์ GSC</Pill>}
          {site.gscAccess === 'ok' && !site.backfillDone && <Pill tone="info">กำลังดึงย้อนหลัง</Pill>}
        </div>
      }
      description={
        site.syncedThrough
          ? `ข้อมูลถึง ${fmtGscDate(site.syncedThrough)} (วันตามเวลา US — Google ช้า 2–3 วัน) · ${mode === 'yoy' ? 'เทียบช่วงเดียวกันปีที่แล้ว' : `เทียบ ${days} วันก่อนหน้า`}`
          : 'ยังไม่มีข้อมูล — กด "ดึงข้อมูลตอนนี้" หรือรอรอบ 04:00'
      }
    >
      {site.lastError && (
        <Alert tone="error" compact className="mb-3">
          ดึงล่าสุดพัง: {site.lastError}
        </Alert>
      )}
      {stats && (
        <>
          <StatGrid cols={4}>
            <StatCard
              label="คลิก"
              value={fmtNum(stats.cur.clicks)}
              icon={MousePointerClick}
              tone="sky"
              hint={fmtPct(stats.cur.clicks, stats.prev.clicks)}
            />
            <StatCard
              label="การแสดงผล"
              value={fmtNum(stats.cur.impressions)}
              icon={Eye}
              tone="grape"
              hint={fmtPct(stats.cur.impressions, stats.prev.impressions)}
            />
            <StatCard
              label="CTR"
              value={fmtCtr(stats.cur.ctr)}
              icon={Percent}
              tone="pink"
              hint={stats.prev.impressions ? `ช่วงก่อน ${fmtCtr(stats.prev.ctr)}` : 'ไม่มีช่วงก่อน'}
            />
            <StatCard
              label="อันดับเฉลี่ย"
              value={stats.cur.position?.toFixed(1) ?? '—'}
              icon={TrendingUp}
              tone="plum"
              hint={fmtPosDelta(stats.cur.position, stats.prev.position)}
            />
          </StatGrid>
          {spark.length > 1 && (
            <Link href={`/seo/${site.id}`} className="block" aria-label="ดูรายละเอียด">
              <p className="mb-1 text-xs text-gray-400">คลิกรายวัน · กดเพื่อดูคำค้นและหน้า</p>
              <Sparkline values={spark} tone="sky" />
            </Link>
          )}
        </>
      )}
    </SectionCard>
  )
}
