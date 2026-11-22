'use client'

// แผนการตลาดของแบรนด์ — 4 tiles + tabs แผน · Action plan · ปฏิทินโพสต์ · KPI
// ?plan=<id> picks the plan; default = the active one, else the newest.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CalendarDays, ListChecks, Megaphone, Plus, Target as TargetIcon, Timer, TrendingUp } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, EmptyState, SelectMenu, TabBar, TabItem } from '@/components/aoo'
import { BrandLogo, PageHeader, SectionCard, StatCard, StatGrid, TechLoader } from '@/components/shared'
import PlanFormModal from '@/components/marketing/PlanFormModal'
import PlanTab from '@/components/marketing/PlanTab'
import ActionPlanTab from '@/components/marketing/ActionPlanTab'
import KpiTab from '@/components/marketing/KpiTab'
import CalendarTab from '@/components/marketing/CalendarTab'
import { fmtMetric, thDateShort } from '@/components/marketing/format'
import { brandLabel } from '@/lib/constants/brands'
import { getTaskPeople, type TaskPerson } from '@/lib/services/taskService'
import {
  PLAN_STATUS,
  actualFor,
  elapsedShare,
  getMetrics,
  getPlanTasks,
  getPlans,
  getTargets,
  paceTone,
  type MetricRow,
  type Plan,
  type PlanTask,
  type Target,
} from '@/lib/services/marketingService'

type Tab = 'plan' | 'actions' | 'calendar' | 'kpi'
const TABS: { key: Tab; label: string; icon: typeof ListChecks }[] = [
  { key: 'plan', label: 'แผน', icon: TargetIcon },
  { key: 'actions', label: 'Action plan', icon: ListChecks },
  { key: 'calendar', label: 'ปฏิทินโพสต์', icon: CalendarDays },
  { key: 'kpi', label: 'KPI', icon: TrendingUp },
]

export default function BrandMarketingPage() {
  const { brand } = useParams<{ brand: string }>()
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()
  // useToast returns a new function each render — keep it out of effect deps or the loads loop forever
  const toastRef = useRef(showToast)
  useEffect(() => {
    toastRef.current = showToast
  })

  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [targets, setTargets] = useState<Target[]>([])
  const [tasks, setTasks] = useState<PlanTask[]>([])
  const [metrics, setMetrics] = useState<MetricRow[]>([])
  const [people, setPeople] = useState<TaskPerson[]>([])
  const [tab, setTab] = useState<Tab>('plan')
  const [creating, setCreating] = useState(false)

  const allowed = userData && (userData.role === 'admin' || userData.hasSrpAccess)
  useEffect(() => {
    if (userData && !allowed) router.push('/unauthorized')
  }, [userData, allowed, router])

  // reload triggers — data loads live in effects (promise callbacks), bump a tick to refetch
  const [plansTick, setPlansTick] = useState(0)
  const [detailTick, setDetailTick] = useState(0)
  const loadPlans = () => setPlansTick((t) => t + 1)
  const loadDetail = () => setDetailTick((t) => t + 1)

  useEffect(() => {
    if (!allowed) return
    let live = true
    Promise.all([getPlans(brand), getTaskPeople()])
      .then(([ps, ppl]) => {
        if (!live) return
        setPeople(ppl)
        setPlans(ps)
        const qs = new URLSearchParams(window.location.search)
        const want = qs.get('plan')
        setPlanId((cur) => {
          const keep = cur ?? want
          if (keep && ps.some((p) => p.id === keep)) return keep
          return (ps.find((p) => p.status === 'active') ?? ps[0])?.id ?? null
        })
        const t = qs.get('tab') as Tab | null
        if (t && TABS.some((x) => x.key === t)) setTab(t)
      })
      .catch((e: Error) => {
        if (!live) return
        toastRef.current(e.message, 'error')
        setPlans([])
      })
    return () => {
      live = false
    }
  }, [allowed, brand, plansTick])

  const plan = plans?.find((p) => p.id === planId) ?? null
  // only refetch numbers when the plan's id/period changes, not on every plans reload
  const planKey = plan ? [plan.id, plan.brand, plan.startDate, plan.endDate].join('|') : ''

  useEffect(() => {
    if (!planKey) return
    const [id, b, since, until] = planKey.split('|')
    let live = true
    Promise.all([getTargets([id]), getPlanTasks([id]), getMetrics(b, since, until)])
      .then(([t, k, m]) => {
        if (!live) return
        setTargets(t)
        setTasks(k)
        setMetrics(m)
      })
      .catch((e: Error) => live && toastRef.current(e.message, 'error'))
    return () => {
      live = false
    }
  }, [planKey, detailTick])

  const pickPlan = (id: string | null) => {
    if (!id) return
    setPlanId(id)
    window.history.replaceState(null, '', `/marketing/${brand}?plan=${id}`)
  }
  const pickTab = (t: Tab) => {
    setTab(t)
    const u = new URL(window.location.href)
    u.searchParams.set('tab', t)
    window.history.replaceState(null, '', u.toString())
  }

  const tiles = useMemo(() => {
    if (!plan) return null
    const elapsed = elapsedShare(plan)
    const done = tasks.filter((t) => t.status === 'done').length
    const pick = (m: string) => targets.find((t) => t.metric === m && t.target > 0)
    const tile = (t: Target | undefined) => {
      if (!t) return null
      const a = actualFor(metrics, t.metric, t.channel)
      const prog = a == null ? null : a / t.target
      return {
        label: fmtMetric.label(t.metric, t.channel),
        value: a == null ? '—' : fmtMetric.value(t.metric, a),
        hint: `เป้า ${fmtMetric.value(t.metric, t.target)}${prog == null ? ' · ยังไม่มีตัวเลข' : ` · ${Math.round(prog * 100)}%`}`,
        tone: paceTone(prog, elapsed),
      }
    }
    return {
      elapsed,
      done,
      sales: tile(pick('sales_thb') ?? pick('sales_pcs')),
      follow: tile(pick('followers') ?? pick('reach') ?? pick('posts')),
    }
  }, [plan, tasks, targets, metrics])

  if (!plans) return <TechLoader />

  // no data / too early = soft grey card, so only real pace colours stand out
  const tileTone = (t: 'success' | 'warning' | 'danger' | 'neutral') =>
    t === 'neutral' ? { tone: 'neutral' as const, variant: 'soft' as const } : { tone: t, variant: 'solid' as const }

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <BrandLogo brand={brand} />
            แผนการตลาด {brandLabel(brand)}
          </span>
        }
        description={plan ? `${thDateShort(plan.startDate)} – ${thDateShort(plan.endDate)}` : undefined}
        icon={Megaphone}
        backHref="/marketing"
        actions={
          <Button variant="secondary" icon={Plus} onClick={() => setCreating(true)}>
            แผนใหม่
          </Button>
        }
      />

      {/* plan picker under the header — inside the header it squeezed the title to nothing on phones */}
      {plans.length > 1 && (
        <div className="sm:max-w-sm">
          <SelectMenu
            value={planId}
            onChange={pickPlan}
            ariaLabel="เลือกแผน"
            options={plans.map((p) => ({
              value: p.id,
              label: p.title,
              hint: `${PLAN_STATUS.find((s) => s.value === p.status)?.label} · ${thDateShort(p.startDate)} – ${thDateShort(p.endDate)}`,
            }))}
          />
        </div>
      )}

      {!plan ? (
        <SectionCard>
          <EmptyState
            title={`${brandLabel(brand)} ยังไม่มีแผน`}
            body="สร้างแผนแรก เลือกเทมเพลตเปิดตัวหรือแคมเปญได้ จะได้งานตั้งต้นกับเป้า KPI มาให้เลย"
            action={
              <Button icon={Plus} onClick={() => setCreating(true)}>
                สร้างแผน
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <>
          {tiles && (
            <StatGrid cols={4} compact>
              <StatCard label="เวลาผ่านไป" value={`${Math.round(tiles.elapsed * 100)}%`} icon={Timer} hint={plan.title} tone="grape" variant="soft" />
              <StatCard
                label="งานในแผน"
                value={tasks.length ? `${tiles.done}/${tasks.length}` : '0'}
                icon={ListChecks}
                {...tileTone(paceTone(tasks.length ? tiles.done / tasks.length : null, tiles.elapsed))}
                hint={tasks.length ? `เสร็จ ${Math.round((tiles.done / tasks.length) * 100)}%` : 'ยังไม่มีงาน'}
                onClick={() => pickTab('actions')}
              />
              <StatCard
                label={tiles.sales?.label ?? 'ยอดขาย'}
                value={tiles.sales?.value ?? '—'}
                hint={tiles.sales?.hint ?? 'ยังไม่ตั้งเป้า'}
                {...tileTone(tiles.sales?.tone ?? 'neutral')}
                icon={TrendingUp}
                onClick={() => pickTab('kpi')}
              />
              <StatCard
                label={tiles.follow?.label ?? 'ผู้ติดตาม'}
                value={tiles.follow?.value ?? '—'}
                hint={tiles.follow?.hint ?? 'ยังไม่ตั้งเป้า'}
                {...tileTone(tiles.follow?.tone ?? 'neutral')}
                icon={TargetIcon}
                onClick={() => pickTab('kpi')}
              />
            </StatGrid>
          )}

          <TabBar ariaLabel="ส่วนของแผน">
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map((t) => (
                <TabItem
                  key={t.key}
                  active={tab === t.key}
                  onClick={() => pickTab(t.key)}
                  label={
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <t.icon size={16} className="hidden sm:block" />
                      {t.label}
                    </span>
                  }
                />
              ))}
            </div>
          </TabBar>

          {tab === 'plan' && (
            <PlanTab
              plan={plan}
              onSaved={loadPlans}
              onDeleted={() => {
                setPlanId(null)
                router.replace(`/marketing/${brand}`)
                loadPlans()
              }}
            />
          )}
          {tab === 'actions' && (
            <ActionPlanTab plan={plan} tasks={tasks} people={people} me={userData?.id ?? ''} onChanged={loadDetail} />
          )}
          {tab === 'calendar' && <CalendarTab plan={plan} />}
          {tab === 'kpi' && <KpiTab plan={plan} targets={targets} metrics={metrics} onChanged={loadDetail} />}
        </>
      )}

      {creating && (
        <PlanFormModal
          open
          brand={brand}
          brandOptions={[]}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            setPlanId(id)
            window.history.replaceState(null, '', `/marketing/${brand}?plan=${id}`)
            loadPlans()
          }}
        />
      )}
    </div>
  )
}
