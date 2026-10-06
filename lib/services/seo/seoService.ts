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
