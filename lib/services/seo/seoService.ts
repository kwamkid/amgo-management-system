// lib/services/seo/seoService.ts
//
// ฝั่งหน้าเว็บของเมนู SEO / AEO — RLS (is_web_owner) คุมชั้น DB แล้ว query ตรงได้
// ตาราง seo_gsc_* อ่านได้อย่างเดียว · เขียนเฉพาะ cron ฝั่งเซิร์ฟเวอร์

import { createClient } from '@/lib/supabase/client'
import { displayRank } from './rankRules'
import { getAiSummaries } from './aiSummary'

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

const RANGE_WORD: Record<number, string> = { 7: '7 วัน', 28: '28 วัน', 90: '3 เดือน', 180: '6 เดือน', 365: '1 ปี' }

/**
 * ปุ่มเทียบแบบบอกเลยว่าเทียบกับอะไร (เจ้าของงง "ช่วงก่อน / ปีก่อน" 8 ต.ค. 69)
 * prev = ช่วงยาวเท่ากันที่อยู่ติดกันก่อนหน้า · yoy = ช่วงเดียวกันของปีที่แล้ว
 */
export const compareOptions = (days: number) => [
  { value: 'prev', label: `เทียบ ${RANGE_WORD[days] ?? `${days} วัน`}ก่อนหน้า` },
  { value: 'yoy', label: 'เทียบช่วงเดียวกันปีที่แล้ว' },
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
  /** ค้นกี่ครั้ง / เจอเรากี่ครั้ง — Google เสิร์ฟผลหลายชุดสลับกัน */
  samples: number
  hits: number
  /** Google ส่งลิงก์ปกติมาให้ดูกี่อันดับ (null = ข้อมูลเก่าก่อนเก็บ) */
  organicSeen: number | null
  /** เราโผล่ในส่วนอื่นของหน้า (กล่องรูป · แผนที่ …) */
  features: { type: string; rank: number }[] | null
}

/** ผล AI 1 ตัวของคำนี้ — ไว้โชว์ใน popover (ถามว่าอะไร · เมื่อไหร่ · อ้างเว็บไหน) */
export interface AiOnKeyword {
  cited: boolean
  mentioned: boolean
  checkedOn: string
  prompt: string
  model: string | null
  /** โดเมนที่ AI อ้าง (ไม่ซ้ำ ตามลำดับ) */
  sources: string[]
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
  /**
   * อันดับเฉลี่ยจาก Google Search Console 7 วันล่าสุด (คนค้นจริง) — null = ไม่มีคนเห็นเราในคำนี้
   * ไว้เทียบกับ DataForSEO ที่ค้นครั้งเดียวจากเครื่องกลาง ผลแกว่งได้
   */
  gscPosition: number | null
  /** การแสดงผลจาก GSC 10 วันล่าสุด (หน้าที่ดีสุดต่อวัน) */
  gscImpressions: number
  /** คลิกจาก Google 28 วันล่าสุด (GSC · นับเฉพาะคนที่พิมพ์คำนี้ตรงตัว) */
  clicks28: number
  /** อันดับที่โชว์ = ค่ากลาง 5 ครั้งล่าสุด (rankRules.displayRank) · null = ไม่ติด 30 อันดับแรก */
  rank: number | null
  /** อันดับที่โชว์ก่อนรอบล่าสุด — ไว้คิดขึ้น/ลง */
  rankBefore: number | null
  /**
   * AI แชทตอบถึงเราไหม — จากคำถามในแท็บ AI ตอบที่ผูกกับคำนี้ (ผลล่าสุดต่อ AI)
   * ผูกหลายคำถาม = อ้างในข้อไหนก็นับว่าอ้าง · ไม่มีคำถามผูก = ว่าง
   */
  ai: Partial<Record<AeoEngineKey, AiOnKeyword>>
}


export interface SeoSettings {
  monthlyBudgetUsd: number
  rankDevice: 'mobile' | 'desktop'
  /** ค้นคำละกี่ครั้งต่อรอบ (Google เสิร์ฟผลหลายชุดสลับกัน) */
  rankSamples: number
  aeoEngines: AeoEngineKey[]
  aeoRecheckDays: number
  alertsEnabled: boolean
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
  // GSC ช้า 2–3 วัน — เอา 10 วันย้อนหลังเพื่อให้ได้ราว 7 วันที่มีข้อมูล
  const gscSince = new Date(Date.now() - 10 * 24 * 3600_000).toISOString().slice(0, 10)
  const clickSince = new Date(Date.now() - 28 * 24 * 3600_000).toISOString().slice(0, 10)
  const [{ data: snaps }, { data: pending }, { data: gsc }, { data: aiRows }, { data: clickRows }] = await Promise.all([
    sb()
      .from('seo_rank_snapshots')
      .select('keyword_id, checked_on, position, ranked_url, has_ai_overview, ai_overview_cites_us, ai_overview_refs, top_competitors, samples, hits, organic_seen, features')
      .in('keyword_id', ids)
      .gte('checked_on', since)
      .order('checked_on', { ascending: false })
      // คำละ ~1 แถว/สัปดาห์ (+ เช็คซ้ำ) × 26 สัปดาห์ × ~50 คำ — เผื่อไว้ ไม่ให้ประวัติเก่าโดนตัด
      .limit(5000),
    sb().from('seo_rank_tasks').select('keyword_id').eq('status', 'pending').in('keyword_id', ids),
    sb()
      .from('seo_gsc_daily')
      .select('query, date, position, impressions')
      .eq('site_id', siteId)
      .in('query', (kws ?? []).map((k) => k.keyword))
      .gte('date', gscSince)
      .limit(5000),
    sb()
      .from('seo_aeo_results')
      .select('prompt_id, engine, checked_on, cited, mentioned, model, sources, seo_aeo_prompts!inner(keyword_id, prompt)')
      .in('seo_aeo_prompts.keyword_id', ids)
      .order('checked_on', { ascending: false })
      .limit(2000),
    sb()
      .from('seo_gsc_daily')
      .select('query, clicks')
      .eq('site_id', siteId)
      .in('query', (kws ?? []).map((k) => k.keyword))
      .gte('date', clickSince)
      .gt('clicks', 0)
      .limit(20000),
  ])
  const clicks = new Map<string, number>()
  for (const r of clickRows ?? []) clicks.set(r.query, (clicks.get(r.query) ?? 0) + r.clicks)
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
      samples: s.samples,
      hits: s.hits,
      organicSeen: s.organic_seen,
      features: (s.features as any) ?? null,
    })
    byKw.set(s.keyword_id, list)
  }
  const pend = new Set((pending ?? []).map((p) => p.keyword_id))

  // GSC แยกแถวตามหน้า — ต่อวันเอาหน้าที่อันดับดีสุด (คือสิ่งที่คนเห็น) แล้วเฉลี่ยถ่วงด้วยการแสดงผล
  const best = new Map<string, { position: number; impressions: number }>()
  for (const g of gsc ?? []) {
    const key = `${g.query}|${g.date}`
    const cur = best.get(key)
    if (!cur || g.position < cur.position) best.set(key, { position: g.position, impressions: g.impressions })
  }
  const gscAvg = new Map<string, { sum: number; w: number; imp: number }>()
  for (const [key, v] of best) {
    const q = key.slice(0, key.lastIndexOf('|'))
    const a = gscAvg.get(q) ?? { sum: 0, w: 0, imp: 0 }
    a.sum += v.position * v.impressions
    a.w += v.impressions
    a.imp += v.impressions
    gscAvg.set(q, a)
  }

  // ผลล่าสุดต่อ (คำถาม × AI) แล้วรวมเข้าคำเป้าหมายที่ผูก
  const aiByKw = new Map<string, TargetKeyword['ai']>()
  const seenAi = new Set<string>()
  for (const r of (aiRows ?? []) as any[]) {
    const key = `${r.prompt_id}|${r.engine}`
    if (seenAi.has(key)) continue
    seenAi.add(key)
    const kwId = r.seo_aeo_prompts.keyword_id as string
    const m = aiByKw.get(kwId) ?? {}
    const cur = m[r.engine as AeoEngineKey]
    // หลายคำถามผูกคำเดียว: เก็บข้อที่ดีสุด (อ้าง > พูดถึง > ไม่) ไว้โชว์รายละเอียด
    const score = (x: { cited: boolean; mentioned: boolean }) => (x.cited ? 2 : x.mentioned ? 1 : 0)
    const next: AiOnKeyword = {
      cited: r.cited,
      mentioned: r.mentioned || r.cited,
      checkedOn: r.checked_on,
      prompt: r.seo_aeo_prompts.prompt,
      model: r.model,
      sources: Array.from(new Set(((r.sources as { domain: string }[]) ?? []).map((x) => x.domain).filter(Boolean))),
    }
    if (!cur || score(next) > score(cur)) m[r.engine as AeoEngineKey] = next
    aiByKw.set(kwId, m)
  }

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
    gscPosition: (() => {
      const a = gscAvg.get(k.keyword)
      return a && a.w ? a.sum / a.w : null
    })(),
    rank: displayRank((byKw.get(k.id) ?? []).map((x) => x.position)),
    rankBefore: displayRank((byKw.get(k.id) ?? []).slice(1).map((x) => x.position)),
    ai: aiByKw.get(k.id) ?? {},
    gscImpressions: gscAvg.get(k.keyword)?.imp ?? 0,
    clicks28: clicks.get(k.keyword) ?? 0,
  }))
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── คนที่ AI ส่งเข้าเว็บ (จาก access log ของเว็บเอง — app/api/seo/ai-referrals) ──────────

export interface AiReferralSummary {
  /** ต่อ AI: จำนวนคน (รวมรายวัน) · จำนวนครั้ง */
  bySource: { source: string; people: number; visits: number }[]
  /** หน้าที่ AI ส่งคนเข้ามาบ่อยสุด */
  topPages: { path: string; source: string; people: number }[]
  /** วันล่าสุดที่มีข้อมูล — null = เว็บนี้ยังไม่ได้ส่งยอดมา */
  lastDate: string | null
}

export async function getAiReferrals(siteId: string, days = 28): Promise<AiReferralSummary> {
  const since = new Date(Date.now() - days * 24 * 3600_000).toISOString().slice(0, 10)
  const { data, error } = await sb()
    .from('seo_ai_referrals')
    .select('date, source, path, visits, people')
    .eq('site_id', siteId)
    .gte('date', since)
    .limit(10000)
  if (error) throw new Error(error.message)
  const src = new Map<string, { people: number; visits: number }>()
  const pages = new Map<string, { path: string; source: string; people: number }>()
  let lastDate: string | null = null
  for (const r of data ?? []) {
    if (!lastDate || r.date > lastDate) lastDate = r.date
    // แถว "*" = ทั้งเว็บ คนไม่ซ้ำต่อวัน → ยอดรวมต่อ AI · แถวอื่น = รายหน้า
    if (r.path === '*') {
      const a = src.get(r.source) ?? { people: 0, visits: 0 }
      a.people += r.people
      a.visits += r.visits
      src.set(r.source, a)
      continue
    }
    const key = `${r.source}|${r.path}`
    const p = pages.get(key) ?? { path: r.path, source: r.source, people: 0 }
    p.people += r.people
    pages.set(key, p)
  }
  return {
    bySource: [...src.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.people - a.people),
    topPages: [...pages.values()].sort((a, b) => b.people - a.people).slice(0, 8),
    lastDate,
  }
}

/** รอบเช็คล่าสุดของเว็บ — ไว้โชว์แผงคิว (กี่คำได้ผลแล้ว / ส่งเมื่อไหร่) */
export interface RankQueue {
  postedAt: string
  total: number
  done: number
  failed: number
  pending: number
}

export async function getRankQueue(siteId: string): Promise<RankQueue | null> {
  const since = new Date(Date.now() - 2 * 24 * 3600_000).toISOString()
  const { data, error } = await sb()
    .from('seo_rank_tasks')
    .select('keyword_id, status, posted_at, seo_keywords!inner(site_id)')
    .eq('seo_keywords.site_id', siteId)
    .gte('posted_at', since)
    .order('posted_at', { ascending: false })
  if (error) throw new Error(error.message)
  if (!data?.length) return null
  // งานที่ส่งห่างจากงานล่าสุดไม่เกิน 10 นาที = รอบเดียวกัน
  const newest = new Date(data[0].posted_at).getTime()
  const batch = data.filter((t) => newest - new Date(t.posted_at).getTime() < 10 * 60_000)
  // นับเป็นคำ (คำละหลายตัวอย่าง) — คำเสร็จเมื่อทุกตัวอย่างไม่ค้างแล้ว
  const byKw = new Map<string, string[]>()
  for (const t of batch) byKw.set(t.keyword_id, [...(byKw.get(t.keyword_id) ?? []), t.status])
  const states = [...byKw.values()]
  return {
    postedAt: data[0].posted_at,
    total: states.length,
    done: states.filter((st) => !st.includes('pending') && st.includes('done')).length,
    failed: states.filter((st) => !st.includes('pending') && !st.includes('done')).length,
    pending: states.filter((st) => st.includes('pending')).length,
  }
}

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
/**
 * เพิ่มคำ — บรรทัดละคำ (ใส่ยอดค้นหาท้ายบรรทัดได้ "รวมแชท, 210")
 * ช่องเสริมที่เว้นว่าง = ไม่แตะค่าเดิมของคำที่มีอยู่แล้ว (เดิมเผลอล้างกลุ่ม/หน้าเป้าหมายทิ้ง)
 */
export async function addTargetKeywords(
  siteId: string,
  input: { lines: string; groupName?: string; targetPath?: string; priority?: number }
): Promise<number> {
  const pageId = input.targetPath?.trim() ? await ensurePage(siteId, input.targetPath) : undefined
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
        ...(input.groupName?.trim() ? { group_name: input.groupName.trim() } : {}),
        ...(pageId ? { target_page_id: pageId } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(vol != null ? { search_volume: vol } : {}),
      }
    })
  if (!rows.length) return 0
  const { data: saved, error } = await sb()
    .from('seo_keywords')
    .upsert(rows, { onConflict: 'site_id,keyword' })
    .select('id, keyword, seo_aeo_prompts(id)')
  if (error) throw new Error(error.message)
  // คำใหม่ได้คำถาม AI อัตโนมัติ — ไม่งั้นช่อง "AI อ้างเราไหม" ว่างตลอด (เจ้าของ 9 ต.ค. 69) · แก้คำได้ในแท็บ AI ตอบ
  const noPrompt = (saved ?? []).filter((k: { seo_aeo_prompts: unknown[] | null }) => !k.seo_aeo_prompts?.length)
  if (noPrompt.length) {
    await sb()
      .from('seo_aeo_prompts')
      .upsert(
        noPrompt.map((k: { id: string; keyword: string }) => ({ site_id: siteId, keyword_id: k.id, prompt: `${k.keyword} ที่ไหนดี แนะนำหน่อย` })),
        { onConflict: 'site_id,prompt', ignoreDuplicates: true }
      )
  }
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
  const { data } = await sb()
    .from('seo_settings')
    .select('monthly_budget_usd, rank_device, rank_samples, aeo_engines, aeo_recheck_days, alerts_enabled')
    .maybeSingle()
  return {
    monthlyBudgetUsd: Number(data?.monthly_budget_usd ?? 10),
    rankDevice: (data?.rank_device ?? 'mobile') as 'mobile' | 'desktop',
    rankSamples: data?.rank_samples ?? 1,
    aeoEngines: (data?.aeo_engines ?? ['chatgpt', 'perplexity', 'gemini']) as AeoEngineKey[],
    aeoRecheckDays: data?.aeo_recheck_days ?? 7,
    alertsEnabled: data?.alerts_enabled ?? true,
  }
}

export async function saveSeoSettings(s: SeoSettings) {
  const { error } = await sb()
    .from('seo_settings')
    .update({
      monthly_budget_usd: s.monthlyBudgetUsd,
      rank_device: s.rankDevice,
      rank_samples: s.rankSamples,
      aeo_engines: s.aeoEngines,
      aeo_recheck_days: s.aeoRecheckDays,
      alerts_enabled: s.alertsEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true)
  if (error) throw new Error(error.message)
}

// ── AEO (เฟส 3) — คำถามที่ถาม AI แล้วดูว่าตอบถึงเราไหม ───────────────────

export type AeoEngineKey = 'chatgpt' | 'perplexity' | 'gemini'

/** ลำดับคอลัมน์ + ชื่อที่แสดง (ราคา/โมเดลอยู่ฝั่งเซิร์ฟเวอร์ใน aeo.ts) */
export const AEO_ENGINE_LABELS: { key: AeoEngineKey; label: string }[] = [
  { key: 'chatgpt', label: 'ChatGPT' },
  { key: 'perplexity', label: 'Perplexity' },
  { key: 'gemini', label: 'Gemini' },
]

export interface AeoResult {
  engine: AeoEngineKey
  checkedOn: string
  mentioned: boolean
  cited: boolean
  sources: { domain: string; title: string; url: string }[]
  answer: string
  model: string | null
}

export interface AeoPrompt {
  id: string
  prompt: string
  isTracked: boolean
  /** คำเป้าหมายที่ผูกไว้ — ผลไปโชว์ในตารางคำเป้าหมายด้วย */
  keywordId: string | null
  keyword: string | null
  /** ผลล่าสุดต่อ AI */
  latest: Partial<Record<AeoEngineKey, AeoResult>>
  /** ใหม่ → เก่า ทุก AI */
  history: AeoResult[]
}

export async function getAeoPrompts(siteId: string): Promise<AeoPrompt[]> {
  const { data: prompts, error } = await sb()
    .from('seo_aeo_prompts')
    .select('id, prompt, is_tracked, keyword_id, seo_keywords(keyword)')
    .eq('site_id', siteId)
    .order('created_at')
  if (error) throw new Error(error.message)
  if (!prompts?.length) return []
  const { data: results } = await sb()
    .from('seo_aeo_results')
    .select('prompt_id, engine, checked_on, mentioned, cited, sources, answer, model')
    .in(
      'prompt_id',
      prompts.map((p) => p.id)
    )
    .order('checked_on', { ascending: false })
    .limit(2000)
  const byPrompt = new Map<string, AeoResult[]>()
  for (const r of results ?? []) {
    const list = byPrompt.get(r.prompt_id) ?? []
    list.push({
      engine: r.engine as AeoEngineKey,
      checkedOn: r.checked_on,
      mentioned: r.mentioned,
      cited: r.cited,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sources: (r.sources as any) ?? [],
      answer: r.answer ?? '',
      model: r.model,
    })
    byPrompt.set(r.prompt_id, list)
  }
  return prompts.map((p) => {
    const history = byPrompt.get(p.id) ?? []
    const latest: AeoPrompt['latest'] = {}
    for (const h of history) if (!latest[h.engine]) latest[h.engine] = h
    return {
      id: p.id,
      prompt: p.prompt,
      isTracked: p.is_tracked,
      keywordId: p.keyword_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      keyword: (p.seo_keywords as any)?.keyword ?? null,
      latest,
      history,
    }
  })
}

/** เพิ่มคำถามทีละหลายบรรทัด — ซ้ำของเดิมข้ามไป · คืนจำนวนที่เพิ่ม */
export async function addAeoPrompts(siteId: string, lines: string, keywordId?: string | null) {
  const rows = Array.from(new Set(lines.split('\n').map((l) => l.trim()).filter(Boolean))).map((prompt) => ({
    site_id: siteId,
    prompt,
    ...(keywordId ? { keyword_id: keywordId } : {}),
  }))
  if (!rows.length) return 0
  const { data, error } = await sb()
    .from('seo_aeo_prompts')
    .upsert(rows, { onConflict: 'site_id,prompt', ignoreDuplicates: true })
    .select('id')
  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export async function setAeoPromptTracked(id: string, isTracked: boolean) {
  const { error } = await sb().from('seo_aeo_prompts').update({ is_tracked: isTracked }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteAeoPrompt(id: string) {
  const { error } = await sb().from('seo_aeo_prompts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** ยอด Bing ในช่วงวันที่ — null = ไม่มีข้อมูล Bing เลย (ยังไม่ตั้ง key / ไม่ได้ลงทะเบียนเว็บ) */
export async function getBingTotals(siteId: string, from: string, to: string) {
  const { data } = await sb()
    .from('seo_bing_daily')
    .select('clicks, impressions')
    .eq('site_id', siteId)
    .gte('date', from)
    .lte('date', to)
  if (!data?.length) return null
  return {
    clicks: data.reduce((a, r) => a + r.clicks, 0),
    impressions: data.reduce((a, r) => a + r.impressions, 0),
  }
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

/** สรุป AI ตัวไหนอ้างเรา แยกทีละ AI ต่อเว็บ (หน้ารายการ SEO) */
export const getSiteAiSummaries = (siteIds: string[]) => getAiSummaries(sb(), siteIds)

export async function setAeoPromptKeyword(id: string, keywordId: string | null) {
  const { error } = await sb().from('seo_aeo_prompts').update({ keyword_id: keywordId }).eq('id', id)
  if (error) throw new Error(error.message)
}

// ── สรุปคำเป้าหมายต่อเว็บ (หน้ารายการ SEO) ───────────────────────────────
// เบากว่า getTargetKeywords ทีละเว็บ: 2 query รวมทุกเว็บ · อันดับใช้กติกาเดียวกับตาราง (displayRank)

export type KeywordSummary = {
  total: number
  /** อันดับ 1–3 */
  top3: number
  /** อันดับ 1–10 (รวม top3) */
  top10: number
  /** อันดับ 11–30 */
  page23: number
  /** ไม่ติด 30 อันดับแรก */
  none: number
  /** ยังไม่เคยเช็ค */
  unchecked: number
}

export async function getKeywordSummaries(siteIds: string[]): Promise<Map<string, KeywordSummary>> {
  const out = new Map<string, KeywordSummary>(
    siteIds.map((id) => [id, { total: 0, top3: 0, top10: 0, page23: 0, none: 0, unchecked: 0 }])
  )
  if (!siteIds.length) return out
  const { data: kws, error } = await sb().from('seo_keywords').select('id, site_id').in('site_id', siteIds).eq('is_tracked', true)
  if (error) throw new Error(error.message)
  if (!kws?.length) return out
  // 5 ครั้งล่าสุดต่อคำ — ย้อนพอ (รายสัปดาห์ × 5 + เช็คซ้ำ)
  const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10)
  const { data: snaps } = await sb()
    .from('seo_rank_snapshots')
    .select('keyword_id, checked_on, position')
    .in(
      'keyword_id',
      kws.map((k) => k.id)
    )
    .gte('checked_on', since)
    .order('checked_on', { ascending: false })
    .limit(10000)
  const pos = new Map<string, (number | null)[]>()
  for (const s of snaps ?? []) {
    const l = pos.get(s.keyword_id) ?? []
    l.push(s.position)
    pos.set(s.keyword_id, l)
  }
  for (const k of kws) {
    const sum = out.get(k.site_id)!
    sum.total++
    const p = pos.get(k.id)
    if (!p?.length) {
      sum.unchecked++
      continue
    }
    const r = displayRank(p)
    if (r == null) sum.none++
    else if (r <= 10) {
      sum.top10++
      if (r <= 3) sum.top3++
    } else sum.page23++
  }
  return out
}

// ── AI อ้างเราที่ไหนบ้าง (LLM Mentions) — อ่านอย่างเดียว ─────────────────────

export type LlmShare = { domain: string; isUs: boolean; mentions: number; aiSearchVolume: number }
export type LlmQuestion = {
  kind: 'ours' | 'gap'
  question: string
  platform: string | null
  aiSearchVolume: number | null
  sources: string[]
  competitor: string | null
  lastSeen: string | null
}

export async function getLlmMentions(siteId: string): Promise<{ fetchedOn: string | null; share: LlmShare[]; questions: LlmQuestion[] }> {
  const { data: latest } = await sb()
    .from('seo_llm_share')
    .select('fetched_on')
    .eq('site_id', siteId)
    .order('fetched_on', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latest) return { fetchedOn: null, share: [], questions: [] }
  const [{ data: share }, { data: qs }] = await Promise.all([
    sb()
      .from('seo_llm_share')
      .select('domain, is_us, mentions, ai_search_volume')
      .eq('site_id', siteId)
      .eq('fetched_on', latest.fetched_on)
      .eq('platform', 'all'),
    sb()
      .from('seo_llm_questions')
      .select('kind, question, platform, ai_search_volume, sources, competitor, last_seen')
      .eq('site_id', siteId)
      .order('ai_search_volume', { ascending: false, nullsFirst: false })
      .limit(500),
  ])
  return {
    fetchedOn: latest.fetched_on,
    share: (share ?? [])
      .map((r) => ({ domain: r.domain, isUs: r.is_us, mentions: r.mentions, aiSearchVolume: r.ai_search_volume }))
      .sort((a, b) => b.mentions - a.mentions),
    questions: (qs ?? []).map((q) => ({
      kind: q.kind as 'ours' | 'gap',
      question: q.question,
      platform: q.platform,
      aiSearchVolume: q.ai_search_volume,
      sources: q.sources ?? [],
      competitor: q.competitor,
      lastSeen: q.last_seen,
    })),
  }
}

/** ตาราง AEO หน้ารวม: รอบล่าสุดของแต่ละเว็บ — AI Overview อ้างเรากี่คำตอบ · คู่แข่งที่ถูกอ้างมากสุด · โอกาสกี่ข้อ */
export type LlmSiteSummary = {
  fetchedOn: string
  mentions: number
  top: { domain: string; mentions: number } | null
  ours: number
  gap: number
}

export async function getLlmSummaries(siteIds: string[]): Promise<Map<string, LlmSiteSummary>> {
  const out = new Map<string, LlmSiteSummary>()
  if (!siteIds.length) return out
  const [{ data: share }, { data: qs }] = await Promise.all([
    sb()
      .from('seo_llm_share')
      .select('site_id, fetched_on, domain, is_us, mentions')
      .in('site_id', siteIds)
      .eq('platform', 'all')
      .order('fetched_on', { ascending: false })
      .limit(1000),
    sb().from('seo_llm_questions').select('site_id, kind').in('site_id', siteIds).limit(5000),
  ])
  for (const r of share ?? []) {
    let s = out.get(r.site_id)
    if (!s) out.set(r.site_id, (s = { fetchedOn: r.fetched_on, mentions: 0, top: null, ours: 0, gap: 0 }))
    if (r.fetched_on !== s.fetchedOn) continue // เอาเฉพาะรอบล่าสุด
    if (r.is_us) s.mentions = r.mentions
    else if (!s.top || r.mentions > s.top.mentions) s.top = { domain: r.domain, mentions: r.mentions }
  }
  for (const q of qs ?? []) {
    const s = out.get(q.site_id)
    if (s) s[q.kind === 'gap' ? 'gap' : 'ours']++
  }
  return out
}
