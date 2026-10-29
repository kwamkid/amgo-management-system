// lib/services/import/importServer.ts
//
// ฝั่ง server ของหน้าแผนสั่งของ (public/order-plan/index.html — ยกมาจากหน้าในเครื่องเจ้าของทั้งไฟล์)
// แปลงแถวในตาราง ⇄ รูปแบบ plan.json เดิม เพื่อให้หน้าเดิมทำงานได้โดยแทบไม่ต้องแก้
// ใช้ client ของผู้ใช้ (RLS import_access คุมอีกชั้น) — ไม่ใช้ service role ยกเว้นราคา SRP

import { NextResponse } from 'next/server'
import { createServerSupabase, verifiedUser } from '@/lib/supabase/server'
import type { Database, Json } from '@/types/database'

type Sb = Awaited<ReturnType<typeof createServerSupabase>>
type RoundRow = Database['public']['Tables']['import_rounds']['Row']
type ItemRow = Database['public']['Tables']['import_round_items']['Row']

export interface ImportCtx {
  sb: Sb
  userId: string
  canEdit: boolean
  seeCost: boolean
}

/** ล็อกอิน + อยู่ใน import_access — ไม่ผ่านคืน response error */
export async function importGuard(): Promise<ImportCtx | NextResponse> {
  const sb = await createServerSupabase()
  const user = await verifiedUser(sb)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await sb.from('import_access').select('can_edit, see_cost').eq('user_id', user.id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { sb, userId: user.id, canEdit: data.can_edit, seeCost: data.see_cost }
}

const ctnsOf = (qty: number, pack: number | null) => (pack ? Math.ceil(qty / pack) : 0)
const yearOf = (r: Pick<RoundRow, 'container' | 'arrive' | 'created_at'>) =>
  r.container?.match(/^(20\d\d)/)?.[1] ?? (r.arrive ?? r.created_at).slice(0, 4)

/** รายการรอบ — รูปแบบเดียวกับ /api/rounds ของ serve.mjs (path = slug) */
export async function listRounds(sb: Sb) {
  const { data: rounds, error } = await sb.from('import_rounds').select('*')
  if (error) throw error
  const { data: ordered, error: e2 } = await sb
    .from('import_round_items')
    .select('round_id, qty, fob, case_pack, cbm')
    .gt('qty', 0)
  if (e2) throw e2
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
        fob: ord.reduce((s, i) => s + i.qty * (i.fob ?? 0), 0),
        fx: r.fx ?? 0,
        container: r.container ?? '',
        shipNo: r.ship_no,
        containers: r.containers,
        ctns: ord.reduce((s, i) => s + ctnsOf(i.qty, i.case_pack), 0),
        cbm: ord.reduce((s, i) => s + ctnsOf(i.qty, i.case_pack) * (i.cbm ?? 0), 0),
        noCbm: ord.filter((i) => !i.cbm).length,
      }
    })
    .sort((a, b) => (b.year + b.round).localeCompare(a.year + a.round))
}

async function loadRound(sb: Sb, slug: string) {
  const { data: round, error } = await sb.from('import_rounds').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  if (!round) return null
  const items: ItemRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error: e2 } = await sb
      .from('import_round_items')
      .select('*')
      .eq('round_id', round.id)
      .order('sort')
      .range(from, from + 999)
    if (e2) throw e2
    items.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return { round, items }
}

/** รอบเดียวในรูปแบบ plan.json · รูปใน bucket แปลงเป็นลิงก์ชั่วคราว (6 ชม.) */
export async function getPlan(sb: Sb, slug: string) {
  const loaded = await loadRound(sb, slug)
  if (!loaded) return null
  const { round: r, items } = loaded

  const keys = items.map((i) => i.img).filter((k): k is string => !!k && !/^https?:/.test(k))
  const signed = new Map<string, string>()
  if (keys.length) {
    const { data } = await sb.storage.from('import-images').createSignedUrls(keys, 6 * 3600)
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }

  const extra = (r.extra && typeof r.extra === 'object' && !Array.isArray(r.extra) ? r.extra : {}) as Record<string, Json>
  return {
    ...extra,
    brand: r.brand,
    sub: r.sub,
    srpBrand: r.srp_brand ?? undefined,
    round: r.round,
    title: r.title,
    container: r.container ?? '',
    shipNo: r.ship_no ?? undefined,
    status: r.status,
    currency: r.currency,
    fx: r.fx,
    incoterm: r.incoterm ?? undefined,
    containers: r.containers,
    overMonths: r.over_months ?? undefined,
    arrive: r.arrive ?? undefined,
    leadMonths: r.lead_months ?? undefined,
    notes: r.notes ?? undefined,
    updated: r.updated_at,
    items: items.map((i) => ({
      ...((i.extra && typeof i.extra === 'object' && !Array.isArray(i.extra) ? i.extra : {}) as Record<string, Json>),
      code: i.code,
      barcode: i.barcode ?? '',
      name: i.name,
      group: i.grp ?? '',
      sub: i.sub ?? '',
      channel: i.channel ?? '',
      tags: i.tags,
      remark: i.remark ?? '',
      img: i.img ? (/^https?:/.test(i.img) ? i.img : signed.get(i.img) ?? '') : '',
      fob: i.fob,
      srp: i.srp,
      ourPrice: i.our_price,
      ourPriceSrc: i.our_price_src ?? '',
      qty: i.qty,
      suggested: i.suggested,
      edited: !!i.qty_edited_at,
      note: i.note ?? '',
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
  const loaded = await loadRound(sb, slug)
  if (!loaded) return 0
  const { round, items } = loaded

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
