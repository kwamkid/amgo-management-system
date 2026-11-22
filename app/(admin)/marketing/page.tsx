'use client'

// แผนการตลาด — one card per brand (owner 2026-11-21 · project/jobs/plans/marketing-plan.md)
// admin sees every brand · brand manager (SRP access of that brand) sees their own · RLS enforces it

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Megaphone, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, EmptyState, Pill, Progress } from '@/components/aoo'
import { BrandLogo, PageHeader, SectionCard, TechLoader } from '@/components/shared'
import { brandSelectOptions } from '@/components/shared/BrandBadge'
import PlanFormModal from '@/components/marketing/PlanFormModal'
import { BRANDS, brandLabel } from '@/lib/constants/brands'
import {
  PLAN_STATUS,
  actualFor,
  elapsedShare,
  getMetrics,
  getMyMarketingBrands,
  getPlanTasks,
  getPlans,
  getTargets,
  paceTone,
  type MetricRow,
  type Plan,
  type PlanTask,
  type Target,
} from '@/lib/services/marketingService'
import { fmtMetric, thDateShort } from '@/components/marketing/format'

interface BrandCard {
  brand: string
  plan: Plan | null
  plans: number
  targets: Target[]
  tasks: PlanTask[]
  metrics: MetricRow[]
}

export default function MarketingPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()
  const [cards, setCards] = useState<BrandCard[] | null>(null)
  const [mine, setMine] = useState<string[] | null>(null)
  const [creating, setCreating] = useState(false)

  const allowed = userData && (userData.role === 'admin' || userData.hasSrpAccess)
  useEffect(() => {
    if (userData && !allowed) router.push('/unauthorized')
  }, [userData, allowed, router])

  useEffect(() => {
    if (!allowed) return
    ;(async () => {
      try {
        const [my, plans] = await Promise.all([getMyMarketingBrands(), getPlans()])
        const brands = my ?? [...new Set([...BRANDS.map((b) => b.slug), ...plans.map((p) => p.brand)])]
        setMine(brands)
        // the plan a card shows: active first, then the newest
        const pick = (b: string) => {
          const ps = plans.filter((p) => p.brand === b)
          return ps.find((p) => p.status === 'active') ?? ps[0] ?? null
        }
        const shown = brands.map((b) => ({ brand: b, plan: pick(b), plans: plans.filter((p) => p.brand === b).length }))
        const ids = shown.flatMap((c) => (c.plan ? [c.plan.id] : []))
        const [targets, tasks, metrics] = await Promise.all([
          getTargets(ids),
          getPlanTasks(ids),
          Promise.all(shown.map((c) => (c.plan ? getMetrics(c.brand, c.plan.startDate, c.plan.endDate) : Promise.resolve([])))),
        ])
        setCards(
          shown.map((c, i) => ({
            ...c,
            targets: targets.filter((t) => t.planId === c.plan?.id),
            tasks: tasks.filter((t) => t.planId === c.plan?.id),
            metrics: metrics[i],
          }))
        )
      } catch (e) {
        showToast((e as Error).message, 'error')
        setCards([])
      }
    })()
  }, [allowed]) // eslint-disable-line react-hooks/exhaustive-deps

  const brandOptions = useMemo(
    () => brandSelectOptions(mine ?? []).filter((o) => !mine || mine.includes(o.value)),
    [mine]
  )

  if (!cards) return <TechLoader />

  // cards with a plan first, then brands without one
  const sorted = [...cards].sort((a, b) => Number(!!b.plan) - Number(!!a.plan) || brandLabel(a.brand).localeCompare(brandLabel(b.brand)))

  return (
    <div className="space-y-4">
      <PageHeader
        title="แผนการตลาด"
        description="แผน งาน และ KPI ของแต่ละแบรนด์ — งานในแผนคือรายการเดียวกับหน้างานของทีม"
        icon={Megaphone}
        actions={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            สร้างแผน
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <SectionCard>
          <EmptyState title="ยังไม่มีแบรนด์ที่คุณดูแล" body="ขอสิทธิ์แบรนด์จากแอดมิน (สิทธิ์เดียวกับ SRP Calculator)" />
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((c) => (
            <BrandPlanCard key={c.brand} c={c} />
          ))}
        </div>
      )}

      {creating && (
        <PlanFormModal
          open
          onClose={() => setCreating(false)}
          brandOptions={brandOptions}
          onCreated={(id, brand) => router.push(`/marketing/${brand}?plan=${id}`)}
        />
      )}
    </div>
  )
}

function BrandPlanCard({ c }: { c: BrandCard }) {
  const p = c.plan
  const elapsed = p ? elapsedShare(p) : 0
  const done = c.tasks.filter((t) => t.status === 'done').length
  // up to 2 headline targets: sales first, then followers, then whatever comes first
  const order = ['sales_thb', 'followers', 'sales_pcs', 'posts', 'reach', 'views', 'ad_spend', 'roas']
  const head = [...c.targets].filter((t) => t.target > 0).sort((a, b) => order.indexOf(a.metric) - order.indexOf(b.metric)).slice(0, 2)
  const status = p && PLAN_STATUS.find((s) => s.value === p.status)

  return (
    <Link href={`/marketing/${c.brand}${p ? `?plan=${p.id}` : ''}`} className="block">
      <SectionCard className="h-full transition hover:border-gray-300">
        <div className="mb-3 flex items-center gap-2">
          <BrandLogo brand={c.brand} />
          <span className="font-semibold text-gray-800">{brandLabel(c.brand)}</span>
          {status && (
            <Pill tone={p!.status === 'active' ? 'success' : p!.status === 'done' ? 'neutral' : 'warning'} className="ml-auto">
              {status.label}
            </Pill>
          )}
        </div>

        {!p ? (
          <p className="text-xs text-gray-400">ยังไม่มีแผน — กดเพื่อสร้าง</p>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="truncate text-gray-700">{p.title}</p>
              <p className="text-xs text-gray-400">
                {thDateShort(p.startDate)} – {thDateShort(p.endDate)} · ผ่านไป {Math.round(elapsed * 100)}%
                {c.plans > 1 && ` · ทั้งหมด ${c.plans} แผน`}
              </p>
            </div>
            {head.map((t) => {
              const actual = actualFor(c.metrics, t.metric, t.channel)
              const prog = actual == null ? null : actual / t.target
              return (
                <Row
                  key={t.id}
                  label={fmtMetric.label(t.metric, t.channel)}
                  value={`${actual == null ? '—' : fmtMetric.value(t.metric, actual)} / ${fmtMetric.value(t.metric, t.target)}`}
                  prog={prog}
                  tone={paceTone(prog, elapsed)}
                />
              )
            })}
            <Row
              label="งานในแผน"
              value={c.tasks.length ? `${done} / ${c.tasks.length}` : 'ยังไม่มีงาน'}
              prog={c.tasks.length ? done / c.tasks.length : null}
              tone={paceTone(c.tasks.length ? done / c.tasks.length : null, elapsed)}
            />
          </div>
        )}
      </SectionCard>
    </Link>
  )
}

function Row({ label, value, prog, tone }: { label: string; value: string; prog: number | null; tone: 'success' | 'warning' | 'danger' | 'neutral' }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium text-gray-700">{value}</span>
      </div>
      <Progress value={Math.min(100, Math.round((prog ?? 0) * 100))} tone={tone === 'neutral' ? 'accent' : tone} />
    </div>
  )
}
