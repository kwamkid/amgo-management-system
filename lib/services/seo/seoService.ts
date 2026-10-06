// lib/services/seo/seoService.ts
//
// ฝั่งหน้าเว็บของเมนู SEO / AEO — RLS (is_web_owner) คุมชั้น DB แล้ว query ตรงได้
// ตาราง seo_gsc_* อ่านได้อย่างเดียว · เขียนเฉพาะ cron ฝั่งเซิร์ฟเวอร์

import { createClient } from '@/lib/supabase/client'

const sb = () => createClient()

export interface SeoSite {
  id: string
  domain: string
  displayName: string
  gscProperty: string | null
  isActive: boolean
  note: string
  gscAccess: 'unknown' | 'ok' | 'denied'
  gscCheckedAt: string | null
  syncedThrough: string | null
  backfillFrom: string | null
  backfillDone: boolean
  lastSyncedAt: string | null
  lastError: string | null
}

export interface DailyTotal {
  date: string
  clicks: number
  impressions: number
  ctr: number
  position: number | null
}

export interface CompareRow {
  key: string
  clicks: number
  impressions: number
  position: number | null
  prevClicks: number
  prevImpressions: number
  prevPosition: number | null
  firstSeen: string | null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toSite = (r: any): SeoSite => ({
  id: r.id,
  domain: r.domain,
  displayName: r.display_name,
  gscProperty: r.gsc_property,
  isActive: r.is_active,
  note: r.note ?? '',
  gscAccess: r.gsc_access,
  gscCheckedAt: r.gsc_checked_at,
  syncedThrough: r.synced_through,
  backfillFrom: r.backfill_from,
  backfillDone: r.backfill_done,
  lastSyncedAt: r.last_synced_at,
  lastError: r.last_error,
})

export async function getSeoSites(): Promise<SeoSite[]> {
  const { data, error } = await sb().from('seo_sites').select('*').order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []).map(toSite)
}

export async function getSeoSite(id: string): Promise<SeoSite> {
  const { data, error } = await sb().from('seo_sites').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return toSite(data)
}

export async function saveSeoSite(input: {
  id?: string
  domain: string
  displayName: string
  gscProperty: string
  isActive: boolean
  note: string
}) {
  const row = {
    domain: input.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''),
    display_name: input.displayName.trim(),
    gsc_property: input.gscProperty.trim() || null,
    is_active: input.isActive,
    note: input.note.trim() || null,
    updated_at: new Date().toISOString(),
  }
  const q = input.id
    ? sb().from('seo_sites').update(row).eq('id', input.id)
    : sb().from('seo_sites').insert(row)
  const { error } = await q
  if (error) throw new Error(error.code === '23505' ? 'มีเว็บโดเมนนี้อยู่แล้ว' : error.message)
}

export async function deleteSeoSite(id: string) {
  const { error } = await sb().from('seo_sites').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * ยอดรวมรายวันของหลายเว็บ ตั้งแต่วันที่กำหนด
 * ยิงทีละเว็บพร้อมกัน — PostgREST ตัดที่ 1,000 แถวต่อคำขอ (เว็บละ ~400 วันรวมกันเกิน)
 */
export async function getDailyTotals(siteIds: string[], from: string): Promise<Map<string, DailyTotal[]>> {
  const out = new Map<string, DailyTotal[]>()
  await Promise.all(
    siteIds.map(async (id) => {
      const { data, error } = await sb()
        .from('seo_gsc_totals')
        .select('date, clicks, impressions, ctr, position')
        .eq('site_id', id)
        .gte('date', from)
        .order('date')
      if (error) throw new Error(error.message)
      out.set(id, data ?? [])
    })
  )
  return out
}

export async function compareGsc(
  siteId: string,
  dim: 'query' | 'page',
  cur: { from: string; to: string },
  prev: { from: string; to: string }
): Promise<CompareRow[]> {
  const { data, error } = await sb().rpc('seo_gsc_compare', {
    p_site: siteId,
    p_dim: dim,
    p_from: cur.from,
    p_to: cur.to,
    p_prev_from: prev.from,
    p_prev_to: prev.to,
  })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: any) => ({
    key: r.key,
    clicks: Number(r.clicks),
    impressions: Number(r.impressions),
    position: r.position == null ? null : Number(r.position),
    prevClicks: Number(r.prev_clicks),
    prevImpressions: Number(r.prev_impressions),
    prevPosition: r.prev_position == null ? null : Number(r.prev_position),
    firstSeen: r.first_seen,
  }))
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── ช่วงเวลา ────────────────────────────────────────────────────────────

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** คำค้น × หน้า เก็บย้อนหลังกี่วัน — ตรงกับ DETAIL_DAYS ใน gscSync.ts */
export const DETAIL_DAYS = 90

/** เทียบกับอะไร: ช่วงก่อนหน้าที่ยาวเท่ากัน หรือช่วงเดียวกันของปีที่แล้ว */
export type CompareMode = 'prev' | 'yoy'

/**
 * ช่วงนี้ vs ช่วงเทียบ ยาวเท่ากัน — นับถอยจาก "วันล่าสุดที่มีข้อมูล" ไม่ใช่วันนี้
 * (GSC ช้า 2–3 วัน ถ้านับจากวันนี้ ช่วงนี้จะสั้นกว่าช่วงก่อนเสมอ ดูเหมือนตกทุกครั้ง)
 *
 * yoy ถอย 364 วัน (52 สัปดาห์พอดี) ไม่ใช่ 365 — ให้วันในสัปดาห์ตรงกัน
 * ยอดเสาร์-อาทิตย์ต่างจากวันธรรมดามาก ถ้าวันเหลื่อมกันตัวเลขจะเพี้ยน
 */
export function periods(latest: string, days: number, mode: CompareMode = 'prev') {
  const cur = { from: addDays(latest, -(days - 1)), to: latest }
  const prev =
    mode === 'yoy'
      ? { from: addDays(cur.from, -364), to: addDays(cur.to, -364) }
      : { from: addDays(cur.from, -days), to: addDays(cur.from, -1) }
  return { cur, prev }
}

export const COMPARE_OPTIONS = [
  { value: 'prev', label: 'เทียบช่วงก่อน' },
  { value: 'yoy', label: 'เทียบปีก่อน' },
]

/** ข้อความบอกช่วงที่เทียบ เช่น "8 ก.ย.–5 ต.ค. 69 เทียบ 11 ส.ค.–7 ก.ย. 69" */
export function periodLabel(p: ReturnType<typeof periods>) {
  return `${fmtGscDate(p.cur.from)}–${fmtGscDate(p.cur.to)} เทียบ ${fmtGscDate(p.prev.from)}–${fmtGscDate(p.prev.to)}`
}

export function sumTotals(rows: DailyTotal[], from: string, to: string) {
  let clicks = 0
  let impressions = 0
  let posWeight = 0
  for (const r of rows) {
    if (r.date < from || r.date > to) continue
    clicks += r.clicks
    impressions += r.impressions
    if (r.position != null) posWeight += r.position * r.impressions
  }
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? posWeight / impressions : null,
  }
}

/** % เปลี่ยน — null เมื่อช่วงก่อนเป็น 0 (หารไม่ได้ ไม่ใช่ "+100%") */
export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null
  return ((cur - prev) / prev) * 100
}

// ── ข้อความแสดงผล ───────────────────────────────────────────────────────

/** "▲ 12%" / "▼ 8%" / "ใหม่" — ใช้บนการ์ดสีทึบ (ตัวหนังสือขาว) จึงบอกทิศด้วยลูกศร ไม่ใช่สี */
export function fmtPct(cur: number, prev: number): string {
  const p = pctChange(cur, prev)
  if (p == null) return cur ? 'ช่วงก่อนเป็น 0' : 'ไม่เปลี่ยน'
  if (Math.abs(p) < 0.5) return 'ไม่เปลี่ยน'
  return `${p > 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)}%`
}

/** อันดับ: ค่าลดลง = ดีขึ้น → แสดง ▲ เมื่ออันดับดีขึ้น */
export function fmtPosDelta(cur: number | null, prev: number | null): string {
  if (cur == null || prev == null) return cur == null ? 'ไม่ติด' : 'ไม่มีช่วงก่อน'
  const d = prev - cur
  if (Math.abs(d) < 0.1) return 'ไม่เปลี่ยน'
  return `${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)} อันดับ`
}

/** วันที่ของ GSC (Pacific) → "3 ต.ค." — แสดงตามวันที่ตรง ๆ ไม่แปลงเขตเวลา */
export const fmtGscDate = (d?: string | null) =>
  d
    ? new Date(`${d}T00:00:00Z`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' })
    : '—'

export const fmtNum = (n: number) => n.toLocaleString('th-TH')
export const fmtCtr = (r: number) => `${(r * 100).toFixed(1)}%`

// ── เฟส 2: คำเป้าหมาย + อันดับ (DataForSEO) ─────────────────────────────

export interface RankSnapshot {
  checkedOn: string
  position: number | null
  rankedUrl: string | null
  hasAiOverview: boolean
  aiOverviewCitesUs: boolean
  aiOverviewRefs: { domain: string; url: string }[]
  topCompetitors: { rank: number; domain: string; url: string; title: string }[]
  /** false = ได้มาแค่อันดับ (ประวัติที่นำเข้าจาก seo-system เดิม) ไม่มีคู่แข่ง/AI Overview */
  detailed: boolean
}

export interface TargetKeyword {
  id: string
  keyword: string
  groupName: string
  searchVolume: number | null
  targetPath: string | null
  priority: number
  isTracked: boolean
  /** ใหม่ → เก่า */
  snapshots: RankSnapshot[]
  pending: boolean
}

export interface SeoSettings {
  monthlyBudgetUsd: number
  rankDevice: 'mobile' | 'desktop'
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getTargetKeywords(siteId: string): Promise<TargetKeyword[]> {
  const { data: kws, error } = await sb()
    .from('seo_keywords')
    .select('id, keyword, group_name, search_volume, priority, is_tracked, seo_pages(path)')
    .eq('site_id', siteId)
    .order('priority')
    .order('search_volume', { ascending: false, nullsFirst: false })
  if (error) throw new Error(error.message)
  const ids = (kws ?? []).map((k) => k.id)
  if (!ids.length) return []

  const since = new Date(Date.now() - 180 * 24 * 3600_000).toISOString().slice(0, 10)
  const [{ data: snaps }, { data: pending }] = await Promise.all([
    sb()
      .from('seo_rank_snapshots')
      .select('keyword_id, checked_on, position, ranked_url, has_ai_overview, ai_overview_cites_us, ai_overview_refs, top_competitors')
      .in('keyword_id', ids)
      .gte('checked_on', since)
      .order('checked_on', { ascending: false })
      .limit(1000),
    sb().from('seo_rank_tasks').select('keyword_id').eq('status', 'pending').in('keyword_id', ids),
  ])
  const byKw = new Map<string, RankSnapshot[]>()
  for (const s of snaps ?? []) {
    const list = byKw.get(s.keyword_id) ?? []
    list.push({
      checkedOn: s.checked_on,
      position: s.position,
      rankedUrl: s.ranked_url,
      hasAiOverview: s.has_ai_overview,
      aiOverviewCitesUs: s.ai_overview_cites_us,
      aiOverviewRefs: (s.ai_overview_refs as any) ?? [],
      topCompetitors: (s.top_competitors as any) ?? [],
      detailed: s.top_competitors != null,
    })
    byKw.set(s.keyword_id, list)
  }
  const pend = new Set((pending ?? []).map((p) => p.keyword_id))
  return (kws ?? []).map((k: any) => ({
    id: k.id,
    keyword: k.keyword,
    groupName: k.group_name ?? '',
    searchVolume: k.search_volume,
    targetPath: k.seo_pages?.path ?? null,
    priority: k.priority,
    isTracked: k.is_tracked,
    snapshots: byKw.get(k.id) ?? [],
    pending: pend.has(k.id),
  }))
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** หา/สร้างหน้าเป้าหมายจาก path — คืน id (path ว่าง = null) */
async function ensurePage(siteId: string, path: string): Promise<string | null> {
  const clean = path.trim()
  if (!clean) return null
  const normalized = clean.startsWith('/') ? clean : `/${clean}`
  const { data, error } = await sb()
    .from('seo_pages')
    .upsert({ site_id: siteId, path: normalized }, { onConflict: 'site_id,path' })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

/**
 * เพิ่มคำทีละหลายคำ — 1 บรรทัด 1 คำ · ใส่ยอดค้นหาท้ายบรรทัดได้ "รวมแชท, 210"
 * คำที่มีอยู่แล้วจะอัปเดตกลุ่ม/หน้า/ยอดค้นหาแทนการเพิ่มซ้ำ
 */
export async function addTargetKeywords(
  siteId: string,
  input: { lines: string; groupName: string; targetPath: string; priority: number }
): Promise<number> {
  const pageId = await ensurePage(siteId, input.targetPath)
  const rows = input.lines
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(.*?)[,\t]\s*([\d,]+)\s*$/)
      const keyword = (m ? m[1] : l).trim().toLowerCase()
      const vol = m ? Number(m[2].replace(/,/g, '')) : null
      return {
        site_id: siteId,
        keyword,
        group_name: input.groupName.trim() || null,
        target_page_id: pageId,
        priority: input.priority,
        ...(vol != null ? { search_volume: vol } : {}),
      }
    })
  if (!rows.length) return 0
  const { error } = await sb().from('seo_keywords').upsert(rows, { onConflict: 'site_id,keyword' })
  if (error) throw new Error(error.message)
  return rows.length
}

export async function setKeywordTracked(id: string, isTracked: boolean) {
  const { error } = await sb().from('seo_keywords').update({ is_tracked: isTracked }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteTargetKeyword(id: string) {
  const { error } = await sb().from('seo_keywords').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getSeoSettings(): Promise<SeoSettings> {
  const { data } = await sb().from('seo_settings').select('monthly_budget_usd, rank_device').maybeSingle()
  return {
    monthlyBudgetUsd: Number(data?.monthly_budget_usd ?? 10),
    rankDevice: (data?.rank_device ?? 'mobile') as 'mobile' | 'desktop',
  }
}

export async function saveSeoSettings(s: SeoSettings) {
  const { error } = await sb()
    .from('seo_settings')
    .update({ monthly_budget_usd: s.monthlyBudgetUsd, rank_device: s.rankDevice, updated_at: new Date().toISOString() })
    .eq('id', true)
  if (error) throw new Error(error.message)
}

/** ค่า API เดือนนี้ (เวลาไทย) */
export async function getMonthApiSpend(): Promise<number> {
  const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).format(new Date())
  const start = new Date(`${now}-01T00:00:00+07:00`).toISOString()
  const { data } = await sb().from('seo_api_costs').select('cost_usd').gte('created_at', start)
  return (data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0)
}

/** อันดับเป็นข้อความ — null = ไม่ติด 100 */
export const fmtRank = (p: number | null | undefined) => (p == null ? 'ไม่ติด' : `#${p}`)
