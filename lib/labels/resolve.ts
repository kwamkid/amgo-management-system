// lib/labels/resolve.ts
//
// รวมข้อมูลฉลากของรอบสั่งของ 1 รอบ — server only
// ค่าแต่ละช่องไล่จากกว้างไปแคบ: '*' (ทุกแบรนด์) → แบรนด์ของรอบ → แบรนด์ย่อย (part) → หมวด → รหัสสินค้า
// ชั้นไหนไม่ได้กรอก (null) ใช้ค่าชั้นก่อนหน้า · ราคา = ที่กรอกไว้ที่สินค้า → SRP Calculator → ราคาที่ตกลงไว้ในรอบสั่ง
// → ราคาหน้าร้าน aoo (SRP Calculator มีราคา Hape แค่ ~33 รุ่น ณ 30 ต.ค. 69 — ลำดับเดียวกับ sell() ในหน้าแพลนสั่งของ)
// ใช้ได้ทั้ง client ของผู้ใช้ (หน้าแอดมิน, RLS) และ admin client (หน้าแชร์ให้โรงงาน — เช็ค token แล้ว)

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { aooPrices } from '@/lib/services/import/importServer'
import type { Database } from '@/types/database'
import { parseSize, type LabelData } from './types'

type Sb = SupabaseClient<Database>
export type SpecRow = Database['public']['Tables']['label_specs']['Row']

export const SPEC_FIELDS = [
  'header', 'type_th', 'warning', 'age', 'usage', 'manufacturer', 'country',
  'importer', 'address', 'contact', 'tis_text', 'tis_license', 'show_license', 'qr_url',
  'size', 'tis_type', 'price', 'icon_03', 'skip',
] as const
export type SpecField = (typeof SPEC_FIELDS)[number]

/** where a value came from — the review page shows it so the owner knows which layer to edit */
export type Layer = 'all' | 'brand' | 'part' | 'group' | 'product' | 'srp' | 'agreed' | 'aoo' | 'round' | ''

/** must be on the label (สคบ. + TIS) — a line missing any of these is flagged */
export const REQUIRED: SpecField[] = ['warning', 'age', 'manufacturer', 'country', 'importer', 'address', 'price']

export interface LabelLine {
  code: string
  name: string
  grp: string
  /** brand key of the part this line belongs to (lower-case) */
  part: string
  img: string | null
  qty: number
  copies: number
  /** no label printed for this line (display stands etc.) */
  skip: boolean
  values: Partial<Record<SpecField, string | number | boolean | null>>
  from: Partial<Record<SpecField, Layer>>
  missing: SpecField[]
  label: LabelData
}

export interface RoundLabels {
  round: { id: string; slug: string; name: string; brand: string; arrive: string | null; status: string }
  settings: { import_month: string; import_month_set: boolean; extra_pct: number; default_size: string; share_token: string | null; shared_at: string | null }
  parts: { key: string; name: string }[]
  lines: LabelLine[]
  specs: SpecRow[]
}

const key = (s: string) => s.trim().toLowerCase()

const monthOf = (d: string | null) => {
  if (!d) return ''
  const [y, m] = d.split('-')
  return `${m}/${y}`
}

type Part = { source: string; name: string; srpBrand: string }

/** load + resolve every ordered line (qty > 0) of a round; null when the round doesn't exist / isn't visible */
export async function loadRoundLabels(sb: Sb, where: { slug: string } | { id: string }): Promise<RoundLabels | null> {
  const q = sb.from('import_rounds').select('id, slug, brand, sub, srp_brand, title, container, ship_no, arrive, status, extra')
  const { data: r } = await ('slug' in where ? q.eq('slug', where.slug) : q.eq('id', where.id)).maybeSingle()
  if (!r) return null

  const parts: Part[] = ((r.extra as { parts?: Part[] } | null)?.parts ?? []).length
    ? (r.extra as { parts: Part[] }).parts
    : [{ source: '', name: r.sub || r.brand, srpBrand: r.srp_brand || r.sub || r.brand }]
  const partKey = (source: string | null) => key(source || r.brand)
  const brandKeys = [...new Set(['*', key(r.brand), ...parts.map((p) => partKey(p.source))])]

  const [{ data: items }, { data: specs }, { data: lr }] = await Promise.all([
    sb.from('import_round_items').select('code, barcode, name, grp, source, img, qty, our_price, sort').eq('round_id', r.id).gt('qty', 0).order('sort'),
    sb.from('label_specs').select('*').in('brand', brandKeys),
    sb.from('label_rounds').select('*').eq('round_id', r.id).maybeSingle(),
  ])

  // SRP Calculator prices (our_price_thb by sku) of every part — service role like importServer
  const admin = createAdminClient()
  const { data: srpBrands } = await admin.from('srp_brands').select('id, name').in('name', parts.map((p) => p.srpBrand))
  const srpPrice = new Map<string, number>() // `${partKey}|${code}`
  if (srpBrands?.length) {
    const { data: prods } = await admin.from('srp_products').select('brand_id, sku, our_price_thb')
      .in('brand_id', srpBrands.map((b) => b.id)).eq('is_active', true)
    for (const p of prods ?? []) {
      const b = srpBrands.find((x) => x.id === p.brand_id)
      const part = parts.find((x) => x.srpBrand === b?.name)
      if (part && p.sku && (p.our_price_thb ?? 0) > 0) srpPrice.set(`${partKey(part.source)}|${p.sku.trim()}`, Number(p.our_price_thb))
    }
  }

  // aoo shelf prices (live via aoo MCP, cached 10 min) by barcode or code
  const aoo = await Promise.all([...new Set([r.brand, ...parts.map((p) => p.srpBrand)])].map((b) => aooPrices(b)))
  const aooPrice = (barcode: string | null, code: string) => {
    for (const a of aoo) {
      const p = a.prices[String(barcode ?? '').trim()] ?? a.prices[code.trim().toUpperCase()]
      if (p?.price > 0) return p.price
    }
    return null
  }

  const spec = new Map<string, SpecRow>()
  for (const s of specs ?? []) spec.set(`${s.brand}|${s.scope}|${s.key}`, s)

  const importMonth = lr?.import_month || monthOf(r.arrive)
  const extraPct = Number(lr?.extra_pct ?? 2)
  const defaultSize = lr?.default_size ?? '50x50'

  const lines: LabelLine[] = (items ?? []).map((it) => {
    const part = partKey(it.source)
    const layers: [Layer, SpecRow | undefined][] = [
      ['all', spec.get('*|brand|')],
      ['brand', spec.get(`${key(r.brand)}|brand|`)],
      ['part', part !== key(r.brand) ? spec.get(`${part}|brand|`) : undefined],
      ['group', it.grp ? spec.get(`${part}|group|${it.grp}`) : undefined],
      ['product', spec.get(`${part}|product|${it.code}`)],
    ]
    const values: LabelLine['values'] = {}
    const from: LabelLine['from'] = {}
    for (const f of SPEC_FIELDS) {
      for (const [layer, row] of layers) {
        const v = row?.[f]
        if (v != null && v !== '') { values[f] = v; from[f] = layer }
      }
    }
    if (values.price == null) {
      const p = srpPrice.get(`${part}|${it.code.trim()}`)
      if (p != null) { values.price = p; from.price = 'srp' }
      else if (Number(it.our_price) > 0) { values.price = Number(it.our_price); from.price = 'agreed' }
      else {
        const a = aooPrice(it.barcode, it.code)
        if (a != null) { values.price = a; from.price = 'aoo' }
      }
    }
    if (values.size == null) { values.size = defaultSize; from.size = 'round' }

    const str = (f: SpecField) => (values[f] == null ? '' : String(values[f]))
    const { w, h } = parseSize(str('size'))
    const label: LabelData = {
      code: it.code, header: str('header'), typeTh: str('type_th'), warning: str('warning'), age: str('age'),
      usage: str('usage'), manufacturer: str('manufacturer'), country: str('country'), importMonth,
      importer: str('importer'), address: str('address'), contact: str('contact'),
      price: values.price == null ? null : Number(values.price),
      tisText: str('tis_text'), tisLicense: str('tis_license'), showLicense: values.show_license === true,
      icon03: values.icon_03 === true,
      qrUrl: str('qr_url'), w, h,
    }
    return {
      code: it.code, name: it.name, grp: it.grp ?? '', part, img: it.img, qty: it.qty,
      copies: Math.ceil(it.qty * (1 + extraPct / 100)),
      skip: values.skip === true,
      values, from, missing: values.skip === true ? [] : REQUIRED.filter((f) => values[f] == null || values[f] === ''), label,
    }
  })

  return {
    round: {
      id: r.id, slug: r.slug, brand: r.brand, arrive: r.arrive, status: r.status,
      // "Hape 2026 #5 · ตู้ 2026-C1" like ctrName() on the order-plan page
      name: [
        r.ship_no ? `${r.brand} ${(r.container ?? r.arrive ?? '').slice(0, 4)} #${r.ship_no}`.replace('  ', ' ') : r.title || r.slug,
        r.container ? `ตู้ ${r.container}` : '',
      ].filter(Boolean).join(' · '),
    },
    settings: {
      import_month: importMonth, import_month_set: !!lr?.import_month, extra_pct: extraPct, default_size: defaultSize,
      share_token: lr?.share_token ?? null, shared_at: lr?.shared_at ?? null,
    },
    parts: parts.map((p) => ({ key: partKey(p.source), name: p.name })),
    lines,
    specs: specs ?? [],
  }
}

/** lines of one size, in round order */
export const linesOfSize = (rl: RoundLabels, size: string) =>
  rl.lines.filter((l) => !l.skip && `${l.label.w}x${l.label.h}` === size)

/** sizes used in the round with label + copy counts */
export const sizeSummary = (rl: RoundLabels) => {
  const m = new Map<string, { size: string; lines: number; copies: number }>()
  for (const l of rl.lines) {
    if (l.skip) continue
    const s = `${l.label.w}x${l.label.h}`
    const e = m.get(s) ?? { size: s, lines: 0, copies: 0 }
    e.lines++
    e.copies += l.copies
    m.set(s, e)
  }
  return [...m.values()]
}
