// lib/services/import/importServer.ts
//
// ฝั่ง server ของหน้าแผนสั่งของ (public/order-plan/index.html — ยกมาจากหน้าในเครื่องเจ้าของทั้งไฟล์)
// แปลงแถวในตาราง ⇄ รูปแบบ plan.json เดิม เพื่อให้หน้าเดิมทำงานได้โดยแทบไม่ต้องแก้
// ใช้ client ของผู้ใช้ (RLS import_access คุมอีกชั้น) — ไม่ใช้ service role ยกเว้นราคา SRP

import { NextResponse } from 'next/server'
import { createServerSupabase, verifiedUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database, Json } from '@/types/database'

type Sb = Awaited<ReturnType<typeof createServerSupabase>>
type RoundRow = Database['public']['Tables']['import_rounds']['Row']
type ItemRow = Database['public']['Tables']['import_round_items']['Row']

export interface ImportCtx {
  sb: Sb
  userId: string
  canEdit: boolean
  seeCost: boolean
  /** null = ทุกแบรนด์ (import_access) · brand manager = แบรนด์ที่มีสิทธิ์ SRP (ตัวเล็ก) */
  brands: string[] | null
}

/**
 * ล็อกอิน + อยู่ใน import_access หรือเป็น brand manager (มีสิทธิ์ SRP ของแบรนด์ · เจ้าของ 30 ต.ค. 69)
 * brand manager = ดูอย่างเดียว ไม่เห็นทุน/FOB · เห็นเฉพาะรอบของแบรนด์ตัวเอง (RLS import_round_visible) — ไม่ผ่านคืน response error
 */
export async function importGuard(): Promise<ImportCtx | NextResponse> {
  const sb = await createServerSupabase()
  const user = await verifiedUser(sb)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await sb.from('import_access').select('can_edit, see_cost').eq('user_id', user.id).maybeSingle()
  if (data) return { sb, userId: user.id, canEdit: data.can_edit, seeCost: data.see_cost, brands: null }
  const { data: mine } = await sb.rpc('import_my_brands')
  if (!mine?.length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { sb, userId: user.id, canEdit: false, seeCost: false, brands: mine }
}

/** brand manager ขอราคาได้เฉพาะแบรนด์ตัวเอง */
export const brandAllowed = (ctx: ImportCtx, brand: string) => !ctx.brands || ctx.brands.includes(brand.toLowerCase())

/** ไม่มีสิทธิ์ดูทุน → ตัดตัวเลขเงินดอลลาร์ในข้อความด้วย (หมายเหตุบางบรรทัดมี "@ $4.28") */
const maskCost = (t: string) => t.replace(/(?:US)?\$\s?[\d,.]+/g, '$…')

/** brand logos from the SRP Calculator (srp_brands.logo_url, public bucket) — name = srp_brand ?? sub ?? brand */
async function brandLogos(): Promise<Map<string, string>> {
  const { data } = await createAdminClient().from('srp_brands').select('name, logo_url')
  return new Map((data ?? []).filter((b) => b.logo_url).map((b) => [b.name.toLowerCase(), b.logo_url as string]))
}
const logoOf = (logos: Map<string, string>, r: Pick<RoundRow, 'srp_brand' | 'sub' | 'brand'>) =>
  logos.get((r.srp_brand || r.sub || r.brand).toLowerCase()) ?? logos.get(r.brand.toLowerCase()) ?? null

type Part = { source: string; name: string; srpBrand: string; sentFile?: string }
/** brands inside one round — extra.parts from the sync; a plain round = just its own brand */
const partsOf = (r: Pick<RoundRow, 'extra' | 'brand' | 'sub' | 'srp_brand'>): Part[] => {
  const p = (r.extra as { parts?: Part[] } | null)?.parts
  return p?.length ? p : [{ source: '', name: r.sub || r.brand, srpBrand: r.srp_brand || r.sub || r.brand }]
}

// ── aoo shelf prices via aoo MCP (tool `stock`, read-only key AOO_MCP_KEY) · 10 min cache per server instance ──
const AOO_MCP_URL = process.env.AOO_MCP_URL || 'https://app.aoocommerce.com/api/mcp'
type AooPrices = { prices: Record<string, { price: number; discount: number }>; error?: string }
const AOO_CACHE = new Map<string, { at: number; v: AooPrices }>()
export async function aooPrices(brand: string): Promise<AooPrices> {
  const hit = AOO_CACHE.get(brand)
  if (hit && Date.now() - hit.at < 600_000) return hit.v
  const key = process.env.AOO_MCP_KEY
  if (!key) return { prices: {}, error: 'ยังไม่ได้ตั้งกุญแจ MCP ของ aoo' }
  try {
    const res = await fetch(AOO_MCP_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'stock', arguments: { brands: [brand], include_zero: true, limit: 2000 } },
      }),
      cache: 'no-store',
    })
    if (!res.ok) return { prices: {}, error: `aoo MCP ${res.status}` }
    const body = (await res.json()) as { result?: { content?: { text?: string }[]; isError?: boolean } }
    const text = body.result?.content?.[0]?.text
    if (!text || body.result?.isError) return { prices: {}, error: text ?? 'aoo MCP ไม่ตอบ' }
    const prices: AooPrices['prices'] = {}
    type StockRow = { sku: string | null; barcode: string | null; price: number | null; discount_price: number | null }
    for (const x of JSON.parse(text) as StockRow[]) {
      if (!(Number(x.price) > 0)) continue
      const p = { price: Number(x.price), discount: Number(x.discount_price) || 0 }
      const sku = String(x.sku || '').trim().toUpperCase().replace(/^00-[A-Z]+-/, '')
      for (const k of [String(x.barcode || '').trim(), sku]) if (k && !prices[k]) prices[k] = p
    }
    const v = { prices }
    AOO_CACHE.set(brand, { at: Date.now(), v })
    return v
  } catch (e) {
    return { prices: {}, error: (e as Error).message }
  }
}

const ctnsOf = (qty: number, pack: number | null) => (pack ? Math.ceil(qty / pack) : 0)
const yearOf = (r: Pick<RoundRow, 'container' | 'arrive' | 'created_at'>) =>
  r.container?.match(/^(20\d\d)/)?.[1] ?? (r.arrive ?? r.created_at).slice(0, 4)

/** รายการรอบ — รูปแบบเดียวกับ /api/rounds ของ serve.mjs (path = slug) */
export async function listRounds(sb: Sb, seeCost = true) {
  const { data: rounds, error } = await sb.from('import_rounds').select('*')
  if (error) throw error
  const { data: ordered, error: e2 } = await sb
    .from('import_round_items')
    .select('round_id, qty, fob, case_pack, cbm, source')
    .gt('qty', 0)
  if (e2) throw e2
  const logos = await brandLogos()
  return (rounds ?? [])
    .map((r) => {
      const ord = (ordered ?? []).filter((i) => i.round_id === r.id)
      return {
        path: r.slug,
        brand: r.brand,
        sub: r.sub,
        round: r.round,
        title: r.title || r.slug,
        status: r.status,
        year: yearOf(r),
        currency: r.currency,
        updated: r.updated_at,
        lines: ord.length,
        pcs: ord.reduce((s, i) => s + i.qty, 0),
        fob: seeCost ? ord.reduce((s, i) => s + i.qty * (i.fob ?? 0), 0) : null,
        fx: seeCost ? r.fx ?? 0 : null,
        container: r.container ?? '',
        shipNo: r.ship_no,
        logo: logoOf(logos, r),
        // one order form can hold several brands (Hape + J'adore) — per-brand totals for the card
        parts: partsOf(r).map((p) => {
          const o = ord.filter((i) => i.source === p.source)
          return {
            ...p,
            logo: logos.get(p.srpBrand.toLowerCase()) ?? null,
            lines: o.length,
            pcs: o.reduce((s, i) => s + i.qty, 0),
            fob: seeCost ? o.reduce((s, i) => s + i.qty * (i.fob ?? 0), 0) : null,
            cbm: o.reduce((s, i) => s + ctnsOf(i.qty, i.case_pack) * (i.cbm ?? 0), 0),
          }
        }),
        containers: r.containers,
        ctns: ord.reduce((s, i) => s + ctnsOf(i.qty, i.case_pack), 0),
        cbm: ord.reduce((s, i) => s + ctnsOf(i.qty, i.case_pack) * (i.cbm ?? 0), 0),
        noCbm: ord.filter((i) => !i.cbm).length,
      }
    })
    // newest first · inside one container the main brand before sub-brands (same order as the page's tabs)
    .sort((a, b) => (b.year + b.round).localeCompare(a.year + a.round) || (a.sub ? 1 : 0) - (b.sub ? 1 : 0) || a.sub.localeCompare(b.sub))
}

/**
 * รอบเดียวในรูปแบบ plan.json + ทุกอย่างที่หน้าต้องใช้ในคำขอเดียว (เจ้าของ 30 ต.ค. 69: "rpc, server load ได้เลย")
 * RPC import_plan = รอบ + รายการ + โลโก้ + ราคา SRP ทุกแบรนด์ในรอบ (1 รอบเน็ตไป DB) · ราคา aoo มาจากแคช
 */
export async function getPlan(sb: Sb, slug: string, ctx: Pick<ImportCtx, 'canEdit' | 'seeCost'> = { canEdit: true, seeCost: true }) {
  const { data, error } = await sb.rpc('import_plan', { p_slug: slug })
  if (error) throw error
  if (!data) return null
  const d = data as unknown as {
    round: RoundRow
    items: ItemRow[]
    logos: Record<string, string>
    srp: { brand: string; id: string; usdToThb: number; eurToThb: number; prices: Record<string, unknown> }[]
    srpBrands: string[]
    mates: string[]
  }
  const r = d.round
  const items = d.items
  const logos = new Map(Object.entries(d.logos))
  const parts = partsOf(r).map((p) => ({ ...p, logo: logos.get(p.srpBrand.toLowerCase()) ?? null }))
  const aooP = aooPrices(r.brand)

  // product pictures are public (bucket import-images is public since 30 Oct 2026) — stable URLs the browser can cache
  const pub = (key: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/import-images/${key}`
  const missing = d.srpBrands.filter((b) => !d.srp.some((x) => x.brand === b))

  const extra = (r.extra && typeof r.extra === 'object' && !Array.isArray(r.extra) ? r.extra : {}) as Record<string, Json>
  const cost = ctx.seeCost
  return {
    ...extra,
    // หน้าใช้ซ่อนคอลัมน์ทุน/ยอดเงิน และล็อกช่องจำนวน (ตัวเลขทุนถูกตัดที่นี่แล้ว ไม่ถึงเบราว์เซอร์)
    _seeCost: cost,
    _canEdit: ctx.canEdit,
    brand: r.brand,
    sub: r.sub,
    srpBrand: r.srp_brand ?? undefined,
    round: r.round,
    title: r.title,
    container: r.container ?? '',
    shipNo: r.ship_no ?? undefined,
    logo: logoOf(logos, r),
    parts,
    srpBrands: d.srpBrands,
    // prices the page used to fetch itself (same shapes as /api/import/srp and /api/import/aoo-prices)
    _srp: {
      brand: d.srp[0]?.brand ?? null,
      link: d.srp[0] ? `/srp/${d.srp[0].id}` : '/srp',
      prices: Object.assign({}, ...d.srp.map((x) => x.prices)),
      error: missing.length ? `ไม่พบแบรนด์ "${missing.join('", "')}" ใน SRP Calculator` : undefined,
    },
    _aoo: await aooP,
    _mates: d.mates,
    status: r.status,
    currency: r.currency,
    fx: cost ? r.fx : null,
    incoterm: r.incoterm ?? undefined,
    containers: r.containers,
    overMonths: r.over_months ?? undefined,
    arrive: r.arrive ?? undefined,
    leadMonths: r.lead_months ?? undefined,
    notes: r.notes ? (cost ? r.notes : maskCost(r.notes)) : undefined,
    updated: r.updated_at,
    items: items.map((i) => ({
      ...((i.extra && typeof i.extra === 'object' && !Array.isArray(i.extra) ? i.extra : {}) as Record<string, Json>),
      code: i.code,
      source: i.source,
      barcode: i.barcode ?? '',
      name: i.name,
      group: i.grp ?? '',
      sub: i.sub ?? '',
      channel: i.channel ?? '',
      tags: i.tags,
      remark: cost ? i.remark ?? '' : maskCost(i.remark ?? ''),
      img: i.img ? (/^https?:/.test(i.img) ? i.img : pub(i.img)) : '',
      fob: cost ? i.fob : null,
      srp: i.srp,
      ourPrice: i.our_price,
      ourPriceSrc: i.our_price_src ?? '',
      qty: i.qty,
      suggested: i.suggested,
      edited: !!i.qty_edited_at,
      note: cost ? i.note ?? '' : maskCost(i.note ?? ''),
      blocked: i.blocked ?? '',
      casePack: i.case_pack,
      qtyPdq: i.qty_pdq,
      pdqPerCase: i.pdq_per_case,
      pdqDim: i.pdq_dim ?? '',
      ctn: i.ctn,
      cbm: i.cbm,
      nw: i.nw,
      gw: i.gw,
      stock: i.stock,
      incoming: i.incoming,
      avg: i.avg,
    })),
  }
}

interface PlanIn {
  status?: string
  fx?: number
  items?: { code: string; qty?: number; edited?: boolean }[]
}

/**
 * บันทึกจากหน้า — หน้าเดิมส่ง plan ทั้งก้อนมา (PUT) เก็บเฉพาะที่หน้าแก้ได้:
 * สถานะ · อัตราแลกเปลี่ยน · จำนวนสั่ง · edited=false (กดใช้ค่าแนะนำ) = ไม่นับเป็นที่แก้เอง
 */
export async function savePlan(sb: Sb, slug: string, body: PlanIn) {
  const { data: round, error: rErr } = await sb.from('import_rounds').select('*').eq('slug', slug).maybeSingle()
  if (rErr) throw rErr
  if (!round) return 0
  // the page sends only the lines it changed — read just those
  const codes = (body.items ?? []).map((i) => String(i.code))
  const items: ItemRow[] = []
  for (let k = 0; k < codes.length; k += 200) {
    const { data, error } = await sb
      .from('import_round_items')
      .select('*')
      .eq('round_id', round.id)
      .in('code', codes.slice(k, k + 200))
    if (error) throw error
    items.push(...(data ?? []))
  }

  const patch: Database['public']['Tables']['import_rounds']['Update'] = {}
  if (body.status && ['draft', 'approved', 'sent'].includes(body.status) && body.status !== round.status)
    patch.status = body.status
  if (typeof body.fx === 'number' && body.fx > 0 && body.fx !== round.fx) patch.fx = body.fx
  if (Object.keys(patch).length) {
    const { error } = await sb.from('import_rounds').update(patch).eq('id', round.id)
    if (error) throw error
  }

  const byCode = new Map(items.map((i) => [i.code, i]))
  let changed = 0
  for (const it of body.items ?? []) {
    const cur = byCode.get(String(it.code))
    if (!cur) continue
    const qty = Math.max(0, Math.round(Number(it.qty) || 0))
    // ห้ามสั่ง (เลิกผลิต / มีรุ่นใหม่แทน — .claude/rules/domains/import-do-not-order.md) หน้าเดิมก็ปิดช่องไว้
    if (cur.blocked && qty > 0) continue
    if (qty !== cur.qty) {
      const { error } = await sb.from('import_round_items').update({ qty }).eq('id', cur.id)
      if (error) throw error
      changed++
    }
    // ใช้ค่าแนะนำ = builder คิดให้ต่อได้ (trigger ประทับเวลาเมื่อ qty เปลี่ยน — ล้างทีหลัง)
    if (it.edited === false && (qty !== cur.qty || cur.qty_edited_at)) {
      const { error } = await sb
        .from('import_round_items')
        .update({ qty_edited_at: null, qty_edited_by: null })
        .eq('id', cur.id)
      if (error) throw error
    }
  }
  return changed + Object.keys(patch).length
}
