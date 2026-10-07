// lib/services/seo/seoService.ts
//
// ฝั่งหน้าเว็บของเมนู SEO / AEO — RLS (is_web_owner) คุมชั้น DB แล้ว query ตรงได้
// ตาราง seo_gsc_* อ่านได้อย่างเดียว · เขียนเฉพาะ cron ฝั่งเซิร์ฟเวอร์

import { createClient } from '@/lib/supabase/client'
import { isSuspiciousDrop, rankConfidence } from './rankRules'
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
  /** การแสดงผลจาก GSC 10 วันล่าสุด (หน้าที่ดีสุดต่อวัน) — ใช้คิด "คนค้นเห็นเรากี่ %" */
  gscImpressions: number
  /** ติดจริงไหม — รวมประวัติ 4 รอบ + GSC (rankRules.rankConfidence) */
  confidence: ReturnType<typeof rankConfidence>
  /** อันดับรอบล่าสุดร่วงหนัก/หลุด และยังไม่ได้เช็คซ้ำยืนยัน — cron จะเช็คซ้ำให้วันถัดไป */
  dropUnconfirmed: boolean
  /**
   * AI แชทตอบถึงเราไหม — จากคำถามในแท็บ AI ตอบที่ผูกกับคำนี้ (ผลล่าสุดต่อ AI)
   * ผูกหลายคำถาม = อ้างในข้อไหนก็นับว่าอ้าง · ไม่มีคำถามผูก = ว่าง
   */
  ai: Partial<Record<AeoEngineKey, { cited: boolean; mentioned: boolean }>>
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
  const [{ data: snaps }, { data: pending }, { data: gsc }, { data: aiRows }] = await Promise.all([
    sb()
      .from('seo_rank_snapshots')
      .select('keyword_id, checked_on, position, ranked_url, has_ai_overview, ai_overview_cites_us, ai_overview_refs, top_competitors, samples, hits')
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
      .select('prompt_id, engine, checked_on, cited, mentioned, seo_aeo_prompts!inner(keyword_id)')
      .in('seo_aeo_prompts.keyword_id', ids)
      .order('checked_on', { ascending: false })
      .limit(2000),
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
      samples: s.samples,
      hits: s.hits,
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
    m[r.engine as AeoEngineKey] = {
      cited: !!cur?.cited || r.cited,
      mentioned: !!cur?.mentioned || r.mentioned || r.cited,
    }
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
    dropUnconfirmed: (() => {
      const [cur, prev] = byKw.get(k.id) ?? []
      return !!cur && !!prev && isSuspiciousDrop(cur.position, prev.position)
    })(),
    ai: aiByKw.get(k.id) ?? {},
    gscImpressions: gscAvg.get(k.keyword)?.imp ?? 0,
    confidence: rankConfidence(byKw.get(k.id) ?? [], {
      impressions10d: gscAvg.get(k.keyword)?.imp ?? 0,
      monthlyVolume: k.search_volume,
    }),
  }))
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
