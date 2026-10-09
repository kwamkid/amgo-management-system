'use client'

// SEO / AEO — ภาพรวมทุกเว็บ
//
// คำถามเดียวที่หน้านี้ต้องตอบ: "งาน SEO ที่ทำไป ทำให้เว็บดีขึ้นหรือยัง"
// 9 ต.ค. 69 เจ้าของบอกการ์ดใหญ่ต่อเว็บดูยาก → ตารางแถวละเว็บ: คนเข้าจาก Google (ขึ้น/ลง) · แนวโน้ม
// · คำเป้าหมายกี่คำ ติดหน้าแรกกี่คำ · AI อ้างเรา — กดแถวเข้าไปดูรายละเอียด
// การ์ดบนสุดเหลือ 4 ใบเล็ก = รวมทุกเว็บ
//
// โหลดเร็ว: รายชื่อเว็บก่อน (โชว์ได้ทันที) แล้วค่อยเติม GSC · คำเป้าหมาย · AI แบบขนาน
// GSC ดึงเฉพาะช่วงที่ต้องใช้ (ช่วงที่ดู + ช่วงเทียบ) ไม่ใช่ 460 วันทุกครั้ง
//
// เมนูส่วนตัวของเจ้าของ: RLS ปล่อยเฉพาะคนใน web_owners

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  CircleCheck,
  CircleX,
  MessageCircle,
  MousePointerClick,
  Search,
  Settings,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, EmptyState, Modal, Pill } from '@/components/aoo'
import { AI_ENGINES, type AiCount, type AiSummary } from '@/lib/services/seo/aiSummary'
import {
  DataTable,
  PageHeader,
  SectionCard,
  Segmented,
  SiteFavicon,
  Sparkline,
  StatCard,
  StatGrid,
  TechLoader,
  type Column,
} from '@/components/shared'
import {
  addDays,
  compareOptions,
  fmtGscDate,
  fmtNum,
  getDailyTotals,
  getKeywordSummaries,
  getSiteAiSummaries,
  getSeoSites,
  periods,
  sumTotals,
  type CompareMode,
  type DailyTotal,
  type KeywordSummary,
  type SeoSite,
} from '@/lib/services/seo/seoService'

// 6 เดือน / 1 ปี: เจ้าของอยากดูว่า "ทำ SEO แล้วดีขึ้นหรือยัง" (9 ต.ค. 69) — ช่วงสั้นมองไม่ออก
// เทียบปีก่อนกับ 1 ปีต้องใช้ข้อมูล ~2 ปี แต่ GSC เก็บ 16 เดือน → ไม่ครบจะขึ้น "เทียบไม่ได้" เอง
const RANGES = [
  { value: '7', label: '7 วัน' },
  { value: '28', label: '28 วัน' },
  { value: '90', label: '3 เดือน' },
  { value: '180', label: '6 เดือน' },
  { value: '365', label: '1 ปี' },
]

type Row = {
  site: SeoSite
  clicks: number | null
  prevClicks: number | null
  impressions: number | null
  position: number | null
  prevPosition: number | null
  /** ช่วงเทียบเก่ากว่าข้อมูลที่ Google เก็บ (16 เดือน) = ไม่โชว์ % */
  partial: boolean
  spark: number[]
  kw?: KeywordSummary
  ai?: AiSummary
}

/** +12% / -30% — null = เทียบไม่ได้ */
function change(cur: number | null, prev: number | null) {
  if (cur == null || !prev) return null
  return Math.round(((cur - prev) / prev) * 100)
}

export default function SeoOverviewPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [sites, setSites] = useState<SeoSite[] | null>(null)
  const [totals, setTotals] = useState<Map<string, DailyTotal[]> | null>(null)
  const [kw, setKw] = useState<Map<string, KeywordSummary>>(new Map())
  const [ai, setAi] = useState<Map<string, AiSummary>>(new Map())
  const [range, setRange] = useState('28')
  const [mode, setMode] = useState<CompareMode>('prev')
  const days = Number(range)

  const canSee = !!userData?.hasWebAccess

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  // รายชื่อเว็บ + คำเป้าหมาย + AI (ไม่ขึ้นกับช่วงวันที่) — โหลดครั้งเดียว
  useEffect(() => {
    if (!canSee) return
    getSeoSites()
      .then((list) => {
        const active = list.filter((s) => s.isActive)
        setSites(active)
        const ids = active.map((s) => s.id)
        getKeywordSummaries(ids).then(setKw).catch(() => {})
        getSiteAiSummaries(ids).then(setAi).catch(() => {})
      })
      .catch((e) => {
        showToast((e as Error).message, 'error')
        setSites([])
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee])

  // GSC เฉพาะช่วงที่ต้องใช้ — เปลี่ยนช่วง/โหมดค่อยดึงใหม่
  useEffect(() => {
    if (!sites?.length) return
    const latest = sites.map((s) => s.syncedThrough).filter(Boolean).sort().pop()
    if (!latest) return setTotals(new Map())
    const from = periods(latest, days, mode).prev.from
    getDailyTotals(
      sites.map((s) => s.id),
      addDays(from, -7)
    )
      .then(setTotals)
      .catch((e) => showToast((e as Error).message, 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites, days, mode])

  const rows: Row[] = useMemo(
    () =>
      (sites ?? []).map((site) => {
        const t = totals?.get(site.id)
        if (!site.syncedThrough || !t)
          return { site, clicks: null, prevClicks: null, impressions: null, position: null, prevPosition: null, partial: false, spark: [], kw: kw.get(site.id), ai: ai.get(site.id) }
        const per = periods(site.syncedThrough, days, mode)
        const cur = sumTotals(t, per.cur.from, per.cur.to)
        const prev = sumTotals(t, per.prev.from, per.prev.to)
        const earliest = t.reduce((m, r) => (!m || r.date < m ? r.date : m), '')
        return {
          site,
          clicks: cur.clicks,
          prevClicks: prev.clicks,
          impressions: cur.impressions,
          position: cur.position,
          prevPosition: prev.position,
          partial: !!earliest && per.prev.from < earliest,
          spark: t.filter((r) => r.date >= per.cur.from && r.date <= per.cur.to).map((r) => r.clicks),
          kw: kw.get(site.id),
          ai: ai.get(site.id),
        }
      }),
    [sites, totals, kw, ai, days, mode]
  )

  // การ์ดรวมทุกเว็บ
  const sum = useMemo(() => {
    const c = rows.reduce((a, r) => a + (r.clicks ?? 0), 0)
    const p = rows.reduce((a, r) => a + (r.partial ? 0 : (r.prevClicks ?? 0)), 0)
    const k = rows.reduce(
      (a, r) => ({ total: a.total + (r.kw?.total ?? 0), top10: a.top10 + (r.kw?.top10 ?? 0), top3: a.top3 + (r.kw?.top3 ?? 0) }),
      { total: 0, top10: 0, top3: 0 }
    )
    const aiAll = rows.reduce(
      (a, r) => {
        for (const e of AI_ENGINES) {
          a.cited += r.ai?.[e.key].cited ?? 0
          a.total += r.ai?.[e.key].total ?? 0
        }
        return a
      },
      { cited: 0, total: 0 }
    )
    return { clicks: c, change: rows.some((r) => r.partial) ? null : change(c, p), ...k, ai: aiAll }
  }, [rows])

  const columns: Column<Row>[] = [
    {
      key: 'site',
      header: 'เว็บ',
      mobilePrimary: true,
      sticky: true,
      sortValue: (r) => r.site.displayName,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2">
          <SiteFavicon domain={r.site.domain} />
          <div className="min-w-0">
            <div className="truncate font-semibold text-gray-900">{r.site.displayName}</div>
            <div className="truncate text-xs text-gray-400">
              {r.site.domain}
              {r.site.gscAccess === 'denied' && ' · ⚠️ ไม่มีสิทธิ์ GSC'}
              {r.site.lastError && ' · ⚠️ ดึงล่าสุดพัง'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'clicks',
      header: 'คลิกจาก Google',
      align: 'right',
      sortValue: (r) => r.clicks,
      cell: (r) => {
        if (r.clicks == null) return <span className="text-gray-400">—</span>
        const ch = r.partial ? null : change(r.clicks, r.prevClicks)
        return (
          <div className="whitespace-nowrap text-right">
            <div className="text-base font-bold text-gray-900">{fmtNum(r.clicks)}</div>
            <div
              className="aoo-delta inline-flex items-center gap-0.5"
              data-tone={ch == null || ch === 0 ? 'muted' : ch > 0 ? 'success' : 'danger'}
            >
              {ch == null ? (
                r.partial ? 'เทียบไม่ได้' : '—'
              ) : (
                <>
                  {ch > 0 ? <TrendingUp size={13} /> : ch < 0 ? <TrendingDown size={13} /> : null}
                  {ch > 0 ? '+' : ''}
                  {ch}%
                </>
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: 'trend',
      header: 'แนวโน้ม',
      hideOnMobile: true,
      width: 140,
      cell: (r) => (r.spark.length > 1 ? <Sparkline values={r.spark} tone="accent" /> : <span className="text-gray-400">—</span>),
    },
    {
      key: 'position',
      header: 'อันดับเฉลี่ย',
      align: 'right',
      hideOnMobile: true,
      sortValue: (r) => r.position,
      cell: (r) =>
        r.position == null ? (
          <span className="text-gray-400">—</span>
        ) : (
          <div className="whitespace-nowrap text-right">
            <div className="font-semibold">{r.position.toFixed(1)}</div>
            <div className="text-xs text-gray-400">แสดง {fmtNum(r.impressions ?? 0)}</div>
          </div>
        ),
    },
    {
      // คำเป้าหมายกี่คำ ติดหน้าแรกกี่คำ (เจ้าของขอ 9 ต.ค. 69)
      key: 'keywords',
      header: 'คำเป้าหมาย',
      sortValue: (r) => r.kw?.top10 ?? null,
      cell: (r) => {
        const k = r.kw
        if (!k?.total) return <span className="text-xs text-gray-400">ยังไม่มีคำ</span>
        return (
          <div className="whitespace-nowrap">
            <div className="text-sm">
              <b className="text-gray-900">{k.total}</b> คำ · หน้าแรก <b className="aoo-kw-top">{k.top10}</b>
              {k.top3 ? <span className="text-gray-500"> (top 3: {k.top3})</span> : null}
            </div>
            <div className="text-xs text-gray-400">
              อันดับ 11–30: {k.page23} · ไม่ติด: {k.none}
              {k.unchecked ? ` · รอเช็ค ${k.unchecked}` : ''}
            </div>
          </div>
        )
      },
    },
    {
      key: 'ai',
      header: 'AI อ้างเรา',
      hideOnMobile: true,
      cell: (r) => {
        const list = AI_ENGINES.filter((e) => r.ai?.[e.key].total)
        if (!list.length) return <span className="text-xs text-gray-400">ยังไม่ได้ถาม</span>
        return (
          <div className="flex flex-wrap gap-1">
            {list.map((e) => (
              <AiPill key={e.key} engine={e.label} count={r.ai![e.key]} site={r.site.displayName} />
            ))}
          </div>
        )
      },
    },
  ]

  if (!canSee || sites === null) return <TechLoader />

  const latest = sites.map((s) => s.syncedThrough).filter(Boolean).sort().pop()

  return (
    <div>
      <PageHeader
        title="SEO / AEO"
        description={`คนเข้าจาก Google · อันดับคำเป้าหมาย · AI อ้างเรา — ทุกเว็บ${latest ? ` · ข้อมูล Google ถึง ${fmtGscDate(latest)}` : ''}`}
        icon={TrendingUp}
        actions={
          // ไม่มีปุ่มดึงเอง (เจ้าของสั่งเอาออก 6 ต.ค. 69 — cron ตี 4 ดึงให้ทุกวันอยู่แล้ว กดแล้วงง)
          <Button variant="secondary" icon={Settings} href="/seo/settings">
            ตั้งค่าเว็บ
          </Button>
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
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented value={range} onChange={setRange} options={RANGES} />
            <Segmented value={mode} onChange={(v) => setMode(v as CompareMode)} options={compareOptions(days)} />
          </div>

          <StatGrid cols={4}>
            <StatCard
              variant="soft"
              label={`คลิกจาก Google ${RANGES.find((x) => x.value === range)?.label ?? `${range} วัน`}`}
              value={fmtNum(sum.clicks)}
              icon={MousePointerClick}
              tone="accent"
              hint={sum.change == null ? 'รวมทุกเว็บ' : `${sum.change > 0 ? '+' : ''}${sum.change}% รวมทุกเว็บ`}
            />
            <StatCard
              variant="soft"
              label="คำเป้าหมาย"
              value={fmtNum(sum.total)}
              icon={Target}
              tone="grape"
              hint={`${sites.length} เว็บ`}
            />
            <StatCard
              variant="soft"
              label="ติดหน้าแรก"
              value={`${sum.top10}/${sum.total}`}
              icon={Trophy}
              tone="success"
              hint={`top 3 อยู่ ${sum.top3} คำ`}
            />
            <StatCard
              variant="soft"
              label="AI อ้างเรา"
              value={sum.ai.total ? `${sum.ai.cited}/${sum.ai.total}` : '—'}
              icon={Bot}
              tone="warning"
              hint="ทุก AI ทุกเว็บ"
            />
          </StatGrid>

          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.site.id}
            loading={!totals}
            onRowClick={(r) => router.push(`/seo/${r.site.id}`)}
            emptyTitle="ยังไม่มีเว็บ"
          />
        </>
      )}
    </div>
  )
}

/**
 * ป้าย "ChatGPT 2/44" กดได้ — เปิด modal รายการว่า AI ตัวนี้ใส่ลิงก์เรา (อ้างเรา) ในคำไหน
 * เอ่ยชื่อเราแต่ไม่ใส่ลิงก์ในคำไหน และคำไหนยังไม่พูดถึงเรา (เจ้าของงง "2 คำไหนบ้าง" 9 ต.ค. 69)
 * 9 ต.ค. 69: เปลี่ยนจาก popover เป็น Modal กลาง (ปิดง่าย) · แต่ละข้อเป็น bullet · ยังไม่พูดถึงเรา = สีแดง
 * ตัวเลข = ใส่ลิงก์เรา / จำนวนคำที่ถาม (Google = คำค้นที่มีกล่อง AI Overview) · ย้อน 30 วัน
 */
function AiPill({ engine, count, site }: { engine: string; count: AiCount; site: string }) {
  const [open, setOpen] = useState(false)
  const isGoogle = engine.startsWith('Google')
  const groups: { state: AiCount['items'][number]['state']; title: string; tone: 'success' | 'warning' | 'danger'; Icon: typeof CircleCheck }[] = [
    { state: 'cited', title: 'อ้างเรา (ใส่ลิงก์เว็บเรา)', tone: 'success', Icon: CircleCheck },
    { state: 'mentioned', title: 'เอ่ยชื่อเรา แต่ไม่ใส่ลิงก์', tone: 'warning', Icon: MessageCircle },
    { state: 'none', title: 'ยังไม่พูดถึงเรา — งานที่ต้องทำ', tone: 'danger', Icon: CircleX },
  ]
  return (
    <>
      <button
        type="button"
        onClick={(ev) => {
          ev.stopPropagation() // แถวตารางกดแล้วเปิดหน้าเว็บ — กดป้ายต้องไม่พาออก
          setOpen(true)
        }}
        className="cursor-pointer"
        aria-label={`${engine}: อ้างเรา ${count.cited} จาก ${count.total}`}
      >
        <Pill tone={count.cited ? 'success' : 'neutral'}>
          {engine.replace(' AI', '')} {count.cited}/{count.total}
        </Pill>
      </button>
      {/* หยุด event ไม่ให้ทะลุไปถึงแถวตาราง (portal ยังส่ง event ผ่าน React tree) */}
      <div onClick={(ev) => ev.stopPropagation()}>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={`${engine} อ้าง ${site} ${count.cited} จาก ${count.total} ${isGoogle ? 'คำค้น' : 'คำถาม'}`}
          description={
            isGoogle
              ? 'นับเฉพาะคำค้นที่ Google ขึ้นกล่อง AI Overview · ผลเช็ครอบล่าสุดใน 30 วัน'
              : 'คำถามที่ให้ AI ตอบ · คำตอบล่าสุดใน 30 วัน'
          }
          maxWidth={640}
        >
          <div className="space-y-5">
            {groups.map((g) => {
              const items = count.items.filter((i) => i.state === g.state)
              if (!items.length) return null
              return (
                <section key={g.state}>
                  <h3 className="aoo-status mb-1.5" data-tone={g.tone}>
                    <g.Icon size={16} />
                    {g.title} · {items.length}
                  </h3>
                  {/* bullet ด้วย utility ของ Tailwind (ไม่พึ่ง globals.css — dev server ชอบค้าง CSS เก่า)
                      สีตาม data-tone ของกลุ่ม: ยังไม่พูดถึงเรา = แดงทั้งจุดและข้อความ */}
                  <ul
                    className="aoo-ai-list list-disc space-y-1.5 pl-6 text-[15px] leading-snug marker:text-[var(--tone)]"
                    data-tone={g.tone}
                  >
                    {items.map((i, n) => (
                      <li key={n} className={g.tone === 'danger' ? 'text-[var(--tone-ink)]' : 'text-gray-800'}>
                        {i.text}
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        </Modal>
      </div>
    </>
  )
}
