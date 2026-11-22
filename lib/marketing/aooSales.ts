// Step 2 of the marketing plan — daily sell-out ฿ + pcs per brand × channel from aoocommerce
// (aoo MCP tool sales_summary) → marketing_metric_daily (source 'aoo'). Server only.
//
// Counted: retail (own shops / POS / social / own website) · marketplace (Shopee/Lazada/TikTok)
//          · department-store counter sales (pc_counter = real sell-out).
// Not counted: wholesale to dealers (sell-in), consignment sent out, legacy history,
//              free "Sponsor" channels (influencer / hospital gifts recorded as manual orders).

import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, format, parseISO } from 'date-fns'
import { BRANDS, brandLabel } from '@/lib/constants/brands'
import { aooMcp, type AooOverview, type AooSalesRow } from '@/lib/aoo/mcp'
import type { Database } from '@/types/database'

type Db = SupabaseClient<Database>

const FLOWS = ['r_retail', 'm_marketplace', 'pc_counter']
const SPONSOR = /spons/i
/** sales_summary caps at 1,000 rows — a 31-day window of one brand stays well under it */
const WINDOW_DAYS = 31

/** aoo row → our channel key (lib/services/marketingService CHANNELS) · null = not counted */
export function aooChannel(r: Pick<AooSalesRow, 'flow' | 'source' | 'channel'>): string | null {
  if (r.channel && SPONSOR.test(r.channel)) return null
  switch (r.source) {
    case 'shopee':
      return 'shopee'
    case 'lazada':
      return 'lazada'
    case 'tiktok':
      return 'tiktok_shop'
    case 'storefront':
      return 'web'
    case 'facebook':
      return 'facebook'
    case 'instagram':
      return 'instagram'
    case 'line':
      return 'line'
    case 'pos':
    case 'counter':
    case 'manual':
      return 'store'
    default:
      return r.flow === 'pc_counter' ? 'store' : null
  }
}

export interface BrandAooLink {
  brand: string
  names: string[]
  /** marketplace shops to count (empty = every shop) */
  shops: string[]
}

/** brands to sync: the admin's links first, else a BRANDS label that exists in aoo (Hape, GB …) */
export async function aooBrandLinks(db: Db, only?: string): Promise<BrandAooLink[]> {
  const { data, error } = await db.from('marketing_brand_links').select('brand, aoo_brand_names, aoo_channel_ids')
  if (error) throw error
  const links = new Map((data ?? []).map((l) => [l.brand, l]))
  const overview = await aooMcp<AooOverview>('company_overview')
  const aooNames = new Set(overview.brands.map((b) => b.toLowerCase()))
  const slugs = only ? [only] : [...new Set([...BRANDS.map((b) => b.slug), ...links.keys()])]
  const out: BrandAooLink[] = []
  for (const brand of slugs) {
    const l = links.get(brand)
    const label = brandLabel(brand)
    const names = l?.aoo_brand_names.length ? l.aoo_brand_names : aooNames.has(label.toLowerCase()) ? [label] : []
    if (names.length) out.push({ brand, names, shops: l?.aoo_channel_ids ?? [] })
  }
  return out
}

/** sum aoo rows into (channel, day) → ฿ + pcs */
export function toDaily(rows: AooSalesRow[], shops: string[]): Map<string, { thb: number; pcs: number }> {
  const keep = new Set(shops.map((s) => s.toLowerCase()))
  const acc = new Map<string, { thb: number; pcs: number }>()
  for (const r of rows) {
    if (!r.day) continue
    if (keep.size && r.flow === 'm_marketplace' && !keep.has((r.channel ?? '').toLowerCase())) continue
    const ch = aooChannel(r)
    if (!ch) continue
    const k = `${ch}|${r.day}`
    const v = acc.get(k) ?? { thb: 0, pcs: 0 }
    v.thb += Number(r.revenue) || 0
    v.pcs += Number(r.qty) || 0
    acc.set(k, v)
  }
  return acc
}

export interface SyncResult {
  brand: string
  from: string
  to: string
  days: number
  thb: number
  pcs: number
}

/** replace the brand's aoo rows in [from, to] with fresh numbers (cancelled orders drop out) */
export async function syncBrandSales(db: Db, link: BrandAooLink, from: string, to: string): Promise<SyncResult> {
  const rows: AooSalesRow[] = []
  for (let s = parseISO(from); format(s, 'yyyy-MM-dd') <= to; s = addDays(s, WINDOW_DAYS)) {
    const e = format(addDays(s, WINDOW_DAYS - 1), 'yyyy-MM-dd')
    const part = await aooMcp<AooSalesRow[]>('sales_summary', {
      date_from: format(s, 'yyyy-MM-dd'),
      date_to: e < to ? e : to,
      group_by: ['day', 'flow', 'source', 'channel'],
      brands: link.names,
      flows: FLOWS,
      include_legacy: false,
      limit: 1000,
    })
    if (part.length >= 1000) throw new Error(`ยอด ${link.brand} ช่วง ${format(s, 'yyyy-MM-dd')} เกิน 1,000 แถว — ต้องแบ่งช่วงให้สั้นลง`)
    rows.push(...part)
  }
  const daily = toDaily(rows, link.shops)
  const now = new Date().toISOString()
  const insert = [...daily].flatMap(([k, v]) => {
    const [channel, date] = k.split('|')
    const base = { brand: link.brand, channel, date, source: 'aoo', synced_at: now }
    return [
      { ...base, metric: 'sales_thb', value: Math.round(v.thb * 100) / 100 },
      { ...base, metric: 'sales_pcs', value: v.pcs },
    ]
  })
  const del = await db
    .from('marketing_metric_daily')
    .delete()
    .eq('brand', link.brand)
    .eq('source', 'aoo')
    .in('metric', ['sales_thb', 'sales_pcs'])
    .gte('date', from)
    .lte('date', to)
  if (del.error) throw del.error
  for (let i = 0; i < insert.length; i += 500) {
    const { error } = await db.from('marketing_metric_daily').insert(insert.slice(i, i + 500))
    if (error) throw error
  }
  const vals = [...daily.values()]
  return {
    brand: link.brand,
    from,
    to,
    days: new Set([...daily.keys()].map((k) => k.split('|')[1])).size,
    thb: vals.reduce((s, v) => s + v.thb, 0),
    pcs: vals.reduce((s, v) => s + v.pcs, 0),
  }
}

// ── queue (kind 'marketing.aoo.sales' in lib/queue/handlers.ts) ────

export const AOO_SALES_KIND = 'marketing.aoo.sales'

export const aooSalesJob = (brand: string, from: string, to: string, groupKey: string) => ({
  kind: AOO_SALES_KIND,
  payload: { brand, from, to },
  groupKey,
  label: `ดึงยอดขาย aoo · ${brandLabel(brand)}`,
})

/** last N days up to today (Thai time) */
export function periodBack(days: number): { from: string; to: string } {
  const today = new Date(Date.now() + 7 * 3600e3)
  return { from: format(addDays(today, -(days - 1)), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
}

/** one queued brand — a brand with no aoo name (J'adore before launch) is skipped, not failed */
export async function runAooSalesJob(db: Db, p: { brand: string; from: string; to: string }) {
  const [link] = await aooBrandLinks(db, p.brand)
  if (!link) return { brand: p.brand, skipped: 'ไม่มีชื่อแบรนด์นี้ใน aoo' }
  return syncBrandSales(db, link, p.from, p.to)
}
