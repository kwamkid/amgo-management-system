// Marketing plan & action plan per brand (owner 2026-11-21 · project/jobs/plans/marketing-plan.md)
// Access is enforced by RLS (marketing_can): admin all · brand manager of that brand.
// Action plan = tasks rows with plan_id + phase — same rows as /tasks.

import { createClient } from '@/lib/supabase/client'
import type { Database, Json } from '@/types/database'
import { normalizeBrand, type TaskStatus } from '@/lib/services/taskService'

export type PlanStatus = 'draft' | 'active' | 'done'
export type Metric = 'sales_thb' | 'sales_pcs' | 'followers' | 'reach' | 'views' | 'posts' | 'ad_spend' | 'roas'

export const PLAN_STATUS: { value: PlanStatus; label: string }[] = [
  { value: 'draft', label: 'ร่าง' },
  { value: 'active', label: 'กำลังใช้' },
  { value: 'done', label: 'จบแล้ว' },
]

/** metric → label + unit · ROAS = average, everything else = sum over the plan period (followers = latest) */
export const METRICS: { value: Metric; label: string; unit: string; agg: 'sum' | 'last' | 'avg' }[] = [
  { value: 'sales_thb', label: 'ยอดขาย', unit: '฿', agg: 'sum' },
  { value: 'sales_pcs', label: 'จำนวนชิ้นที่ขาย', unit: 'ชิ้น', agg: 'sum' },
  { value: 'followers', label: 'ผู้ติดตาม', unit: 'คน', agg: 'last' },
  { value: 'reach', label: 'Reach', unit: 'คน', agg: 'sum' },
  { value: 'views', label: 'ยอดวิว', unit: 'วิว', agg: 'sum' },
  { value: 'posts', label: 'จำนวนโพสต์', unit: 'โพสต์', agg: 'sum' },
  { value: 'ad_spend', label: 'ค่าโฆษณา', unit: '฿', agg: 'sum' },
  { value: 'roas', label: 'ROAS', unit: 'เท่า', agg: 'avg' },
]
export const metricInfo = (m: string) => METRICS.find((x) => x.value === m) ?? { value: m as Metric, label: m, unit: '', agg: 'sum' as const }

export const CHANNELS: { value: string; label: string }[] = [
  { value: 'all', label: 'ทุกช่องทาง' },
  { value: 'store', label: 'หน้าร้าน' },
  { value: 'web', label: 'เว็บไซต์' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'lazada', label: 'Lazada' },
  { value: 'tiktok_shop', label: 'TikTok Shop' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'line', label: 'LINE OA' },
]
export const channelLabel = (c: string) => CHANNELS.find((x) => x.value === c)?.label ?? c

/** numbers that can come from aoocommerce / aoosocial — the rest are typed in */
export const AUTO_METRICS: Metric[] = ['sales_thb', 'sales_pcs', 'followers', 'reach', 'views', 'posts']

export interface KeyDate {
  date: string
  label: string
}
export interface Phase {
  key: string
  label: string
}

export interface Plan {
  id: string
  brand: string
  title: string
  startDate: string
  endDate: string
  status: PlanStatus
  goal: string
  budget: number | null
  channels: string[]
  keyDates: KeyDate[]
  phases: Phase[]
}

export interface Target {
  id: string
  planId: string
  metric: Metric
  channel: string
  target: number
  source: 'auto' | 'manual'
}

export interface MetricRow {
  metric: string
  channel: string
  date: string
  value: number
  source: string
}

export interface PlanTask {
  id: string
  no: number
  title: string
  status: TaskStatus
  dueDate: string | null
  phase: string | null
  createdBy: string | null
  doneAt: string | null
  assigneeIds: string[]
}

const PLAN_COLS = 'id, brand, title, start_date, end_date, status, goal, budget, channels, key_dates, phases'
type PlanRow = {
  id: string
  brand: string
  title: string
  start_date: string
  end_date: string
  status: string
  goal: string
  budget: number | null
  channels: string[]
  key_dates: Json
  phases: Json
}
const toPlan = (r: PlanRow): Plan => ({
  id: r.id,
  brand: r.brand,
  title: r.title,
  startDate: r.start_date,
  endDate: r.end_date,
  status: r.status as PlanStatus,
  goal: r.goal,
  budget: r.budget,
  channels: r.channels ?? [],
  keyDates: ((r.key_dates as unknown as KeyDate[]) ?? []).sort((a, b) => a.date.localeCompare(b.date)),
  phases: (r.phases as unknown as Phase[]) ?? [],
})

/** brands this user may plan · null = all (admin) */
export async function getMyMarketingBrands(): Promise<string[] | null> {
  const { data, error } = await createClient().rpc('marketing_my_brands')
  if (error) throw error
  return data ?? null
}

export async function getPlans(brand?: string): Promise<Plan[]> {
  let q = createClient().from('marketing_plans').select(PLAN_COLS).order('start_date', { ascending: false })
  if (brand) q = q.eq('brand', brand)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(toPlan)
}

export async function createPlan(input: Omit<Plan, 'id'>): Promise<string> {
  const { data, error } = await createClient()
    .from('marketing_plans')
    .insert({
      brand: normalizeBrand(input.brand)!,
      title: input.title.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      status: input.status,
      goal: input.goal,
      budget: input.budget,
      channels: input.channels,
      key_dates: input.keyDates as unknown as Json,
      phases: input.phases as unknown as Json,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updatePlan(id: string, p: Partial<Omit<Plan, 'id' | 'brand'>>): Promise<void> {
  const row: Database['public']['Tables']['marketing_plans']['Update'] = {}
  if (p.title !== undefined) row.title = p.title.trim()
  if (p.startDate !== undefined) row.start_date = p.startDate
  if (p.endDate !== undefined) row.end_date = p.endDate
  if (p.status !== undefined) row.status = p.status
  if (p.goal !== undefined) row.goal = p.goal
  if (p.budget !== undefined) row.budget = p.budget
  if (p.channels !== undefined) row.channels = p.channels
  if (p.keyDates !== undefined) row.key_dates = p.keyDates as unknown as Json
  if (p.phases !== undefined) row.phases = p.phases as unknown as Json
  const { error } = await createClient().from('marketing_plans').update(row).eq('id', id)
  if (error) throw error
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await createClient().from('marketing_plans').delete().eq('id', id)
  if (error) throw error
}

export async function getTargets(planIds: string[]): Promise<Target[]> {
  if (!planIds.length) return []
  const { data, error } = await createClient()
    .from('marketing_targets')
    .select('id, plan_id, metric, channel, target, source')
    .in('plan_id', planIds)
    .order('sort')
    .order('created_at')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    planId: r.plan_id,
    metric: r.metric as Metric,
    channel: r.channel,
    target: Number(r.target),
    source: r.source as 'auto' | 'manual',
  }))
}

export async function upsertTarget(t: Omit<Target, 'id'>): Promise<void> {
  const { error } = await createClient()
    .from('marketing_targets')
    .upsert(
      { plan_id: t.planId, metric: t.metric, channel: t.channel, target: t.target, source: t.source },
      { onConflict: 'plan_id,metric,channel' }
    )
  if (error) throw error
}

export async function deleteTarget(id: string): Promise<void> {
  const { error } = await createClient().from('marketing_targets').delete().eq('id', id)
  if (error) throw error
}

/** daily numbers of one brand inside [since, until] */
export async function getMetrics(brand: string, since: string, until: string): Promise<MetricRow[]> {
  const { data, error } = await createClient()
    .from('marketing_metric_daily')
    .select('metric, channel, date, value, source')
    .eq('brand', brand)
    .gte('date', since)
    .lte('date', until)
    .order('date')
    .limit(5000)
  if (error) throw error
  return (data ?? []).map((r) => ({ ...r, value: Number(r.value) }))
}

/** type in one number (ad spend, ROAS …) — replaces that day's manual value */
export async function saveManualMetric(brand: string, metric: string, channel: string, date: string, value: number): Promise<void> {
  const { error } = await createClient()
    .from('marketing_metric_daily')
    .upsert({ brand, metric, channel, date, value, source: 'manual', synced_at: new Date().toISOString() }, { onConflict: 'brand,metric,channel,date,source' })
  if (error) throw error
}

/** actual for one target over the plan period — prefers synced rows over manual ones on the same day */
export function actualFor(rows: MetricRow[], metric: string, channel: string): number | null {
  const mine = rows.filter((r) => r.metric === metric && (channel === 'all' ? true : r.channel === channel))
  if (!mine.length) return null
  // channel 'all': use explicit 'all' rows when present, else sum the channels
  const pool = channel === 'all' && mine.some((r) => r.channel === 'all') ? mine.filter((r) => r.channel === 'all') : mine
  const byKey = new Map<string, MetricRow>()
  for (const r of pool) {
    const k = `${r.channel}|${r.date}`
    const prev = byKey.get(k)
    if (!prev || prev.source === 'manual') byKey.set(k, r)
  }
  const vals = [...byKey.values()]
  const agg = metricInfo(metric).agg
  if (agg === 'avg') return vals.reduce((s, r) => s + r.value, 0) / vals.length
  if (agg === 'last') {
    const last = vals.reduce((m, r) => (r.date > m ? r.date : m), '')
    return vals.filter((r) => r.date === last).reduce((s, r) => s + r.value, 0)
  }
  return vals.reduce((s, r) => s + r.value, 0)
}

// ── action plan (tasks) ────────────────────────────────────────────

export async function getPlanTasks(planIds: string[]): Promise<(PlanTask & { planId: string })[]> {
  if (!planIds.length) return []
  const { data, error } = await createClient()
    .from('tasks')
    .select('id, no, title, status, due_date, done_at, created_by, phase, plan_id, sort_order, task_assignees(user_id)')
    .in('plan_id', planIds)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    no: r.no,
    title: r.title,
    status: r.status as TaskStatus,
    dueDate: r.due_date,
    phase: r.phase,
    createdBy: r.created_by,
    doneAt: r.done_at,
    planId: r.plan_id!,
    assigneeIds: (r.task_assignees ?? []).map((a) => a.user_id),
  }))
}

/** link an action to a plan — the task itself is made with createTask (same as /tasks) */
export async function setTaskPlan(taskId: string, planId: string | null, phase: string | null): Promise<void> {
  const { error } = await createClient().from('tasks').update({ plan_id: planId, phase }).eq('id', taskId)
  if (error) throw error
}

// ── brand ↔ aoocommerce / aoosocial (admin, /marketing/settings) ───

export interface BrandLink {
  brand: string
  aoosocialCompanyId: string | null
  aoosocialAccountIds: string[]
  /** brand names in aoo · empty = the brand label when aoo has it */
  aooBrandNames: string[]
  /** marketplace shop names to count · empty = every shop */
  aooShops: string[]
  updatedAt: string | null
}

export async function getBrandLinks(): Promise<BrandLink[]> {
  const { data, error } = await createClient().from('marketing_brand_links').select('*').order('brand')
  if (error) throw error
  return (data ?? []).map((l) => ({
    brand: l.brand,
    aoosocialCompanyId: l.aoosocial_company_id,
    aoosocialAccountIds: l.aoosocial_account_ids,
    aooBrandNames: l.aoo_brand_names,
    aooShops: l.aoo_channel_ids,
    updatedAt: l.updated_at,
  }))
}

export async function saveBrandLink(l: Omit<BrandLink, 'updatedAt'>): Promise<void> {
  const { error } = await createClient()
    .from('marketing_brand_links')
    .upsert(
      {
        brand: l.brand,
        aoosocial_company_id: l.aoosocialCompanyId || null,
        aoosocial_account_ids: l.aoosocialAccountIds,
        aoo_brand_names: l.aooBrandNames,
        aoo_channel_ids: l.aooShops,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'brand' }
    )
  if (error) throw error
}

export interface AooOptions {
  brands: string[]
  shops: { name: string; platform: string }[]
  socialAccounts: { id: string; platform: string; name: string; companyId: string; company: string; needsReconnect: boolean }[]
  socialError: string | null
}

async function apiJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  return body as T
}

/** aoo brand names + marketplace shops for the pickers (admin) */
export const getAooOptions = async () => apiJson<AooOptions>(await fetch('/api/marketing/aoo', { cache: 'no-store' }))

/** "ดึงยอดตอนนี้" — queue a re-sync of one brand's aoo sales for [from, to] (admin) → queue group to follow */
export const syncAooSales = async (brand: string, from: string, to: string) =>
  apiJson<{ groupKey: string }>(
    await fetch('/api/marketing/aoo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand, from, to }),
    })
  )

// ── period helpers ─────────────────────────────────────────────────

export const todayTh = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)

/** share of the plan period already gone, 0..1 */
export function elapsedShare(p: Pick<Plan, 'startDate' | 'endDate'>, today = todayTh()): number {
  const s = Date.parse(p.startDate)
  const e = Date.parse(p.endDate) + 864e5
  const t = Date.parse(today) + 864e5
  if (t <= s) return 0
  if (t >= e) return 1
  return (t - s) / (e - s)
}

/** on track = progress keeps up with time · tone for cards/tiles */
export function paceTone(progress: number | null, elapsed: number): 'success' | 'warning' | 'danger' | 'neutral' {
  if (progress == null) return 'neutral'
  if (elapsed <= 0.05) return 'neutral'
  const r = progress / elapsed
  return r >= 0.9 ? 'success' : r >= 0.6 ? 'warning' : 'danger'
}
