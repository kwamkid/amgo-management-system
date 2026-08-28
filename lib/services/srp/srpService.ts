// lib/services/srp/srpService.ts
//
// ข้อมูลระบบ SRP Calculator — แบรนด์/สินค้า/ช่องทางขาย/สิทธิ์รายคน-รายแบรนด์
// RLS คุมชั้น DB แล้ว (แอดมินเห็นหมด · viewer อ่าน · editor แก้) — โค้ดฝั่งนี้
// query ตรง ๆ ได้เลย แถวที่ไม่มีสิทธิ์จะไม่หลุดมาเอง

import type { ChannelType } from './calculator'
import { createClient } from '@/lib/supabase/client'
import type {
  SrpBrand,
  SrpProduct,
  SrpChannel,
} from './calculator'

const sb = () => createClient()

export interface SrpBrandAccess {
  id: string
  brandId: string
  userId: string
  role: 'viewer' | 'editor'
  userName?: string
}

/* ── mapper ─────────────────────────────────────────────────────────── */

type BrandRow = {
  id: string; name: string; logo_url: string | null; usd_to_thb: number
  eur_to_thb: number; sgd_to_thb: number; vat: number; default_multiplier: number
  platform_markup_pct: number; is_active: boolean
}
const toBrand = (r: BrandRow): SrpBrand => ({
  id: r.id,
  name: r.name,
  logoUrl: r.logo_url,
  usdToThb: Number(r.usd_to_thb),
  eurToThb: Number(r.eur_to_thb),
  sgdToThb: Number(r.sgd_to_thb),
  vat: Number(r.vat),
  defaultMultiplier: Number(r.default_multiplier),
  platformMarkupPct: Number(r.platform_markup_pct),
  isActive: r.is_active,
})

type ProductRow = {
  id: string; brand_id: string; name: string; category: string; sku: string
  image_url: string; fob_usd: number; fob_eur: number; freight_do: number
  import_tax_pct: number; shipping_cost: number; srp_usd: number; srp_eur: number
  srp_sgd: number; platform_markup_pct: number
  multiplier: number; our_price_thb: number; platform_price_thb: number
  notes: string; sort_order: number; is_active: boolean
  last_edited_by: string; last_edited_at: string | null
}
const toProduct = (r: ProductRow): SrpProduct => ({
  id: r.id,
  brandId: r.brand_id,
  name: r.name,
  category: r.category,
  sku: r.sku,
  imageUrl: r.image_url,
  fobUsd: Number(r.fob_usd),
  fobEur: Number(r.fob_eur),
  freightDo: Number(r.freight_do),
  importTaxPct: Number(r.import_tax_pct),
  shippingCost: Number(r.shipping_cost),
  platformMarkupPct: Number(r.platform_markup_pct),
  srpUsd: Number(r.srp_usd),
  srpEur: Number(r.srp_eur),
  srpSgd: Number(r.srp_sgd),
  multiplier: Number(r.multiplier),
  ourPriceThb: Number(r.our_price_thb),
  platformPriceThb: Number(r.platform_price_thb),
  notes: r.notes,
  sortOrder: r.sort_order,
  isActive: r.is_active,
  lastEditedBy: r.last_edited_by,
  lastEditedAt: r.last_edited_at,
})

type ChannelRow = {
  id: string; brand_id: string; type: string; name: string; sort_order: number
  gp_pct: number; pc_pct: number; dc_pct: number; commission_pct: number
  transaction_fee_pct: number; service_fee_pct: number; shipping_thb: number
  promo_pct: number
}
const toChannel = (r: ChannelRow): SrpChannel => ({
  id: r.id,
  brandId: r.brand_id,
  type: r.type as ChannelType,
  name: r.name,
  sortOrder: r.sort_order,
  gpPct: Number(r.gp_pct),
  pcPct: Number(r.pc_pct),
  dcPct: Number(r.dc_pct),
  commissionPct: Number(r.commission_pct),
  transactionFeePct: Number(r.transaction_fee_pct),
  serviceFeePct: Number(r.service_fee_pct),
  shippingThb: Number(r.shipping_thb),
  promoPct: Number(r.promo_pct),
})

/* ── แบรนด์ ─────────────────────────────────────────────────────────── */

export async function getSrpBrands(): Promise<(SrpBrand & { productCount: number })[]> {
  const { data, error } = await sb()
    .from('srp_brands')
    .select('id, name, logo_url, usd_to_thb, eur_to_thb, sgd_to_thb, vat, default_multiplier, platform_markup_pct, is_active, srp_products(count)')
    .order('name')
  if (error) throw error
  return (data ?? []).map((r) => ({
    ...toBrand(r),
    productCount: (r.srp_products?.[0] as { count?: number } | undefined)?.count ?? 0,
  }))
}

export async function getSrpBrand(id: string): Promise<SrpBrand | null> {
  const { data, error } = await sb()
    .from('srp_brands')
    .select('id, name, logo_url, usd_to_thb, eur_to_thb, sgd_to_thb, vat, default_multiplier, platform_markup_pct, is_active')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? toBrand(data) : null
}

export async function saveSrpBrand(data: {
  id?: string
  name: string
  logoUrl?: string | null
  usdToThb: number
  eurToThb: number
  sgdToThb: number
  vat: number
  defaultMultiplier: number
  platformMarkupPct: number
}): Promise<string> {
  const fields = {
    name: data.name,
    logo_url: data.logoUrl ?? null,
    usd_to_thb: data.usdToThb,
    sgd_to_thb: data.sgdToThb,
    eur_to_thb: data.eurToThb,
    vat: data.vat,
    default_multiplier: data.defaultMultiplier,
    platform_markup_pct: data.platformMarkupPct,
    updated_at: new Date().toISOString(),
  }
  if (data.id) {
    const { error } = await sb().from('srp_brands').update(fields).eq('id', data.id)
    if (error) throw error
    return data.id
  }
  const { data: row, error } = await sb().from('srp_brands').insert(fields).select('id').single()
  if (error) throw error
  return row.id
}

/* ── สินค้า ─────────────────────────────────────────────────────────── */

export async function getSrpProducts(brandId: string): Promise<SrpProduct[]> {
  // สินค้าต่อแบรนด์หลักร้อย — ดึงทีเดียวจบ (ต่ำกว่าเพดาน 1000 ของ PostgREST)
  const { data, error } = await sb()
    .from('srp_products')
    .select('*')
    .eq('brand_id', brandId)
    // ของที่เพิ่งเพิ่ม/เพิ่งนำเข้าอยู่บนสุด (เจ้าของสั่ง 28 ส.ค. 69) — เดิมเรียงตาม
    // sort_order ที่มีแต่ตอนนำเข้า Excel เป็นคนใส่ ไม่มีที่ไหนในเว็บแก้ได้เลย
    // จึงไม่ใช่ลำดับที่ใครตั้งใจจัด · ชื่อเป็นตัวตัดสินเมื่อเพิ่มมาพร้อมกัน
    .order('created_at', { ascending: false })
    .order('name')
  if (error) throw error
  return (data ?? []).map(toProduct)
}

export async function saveSrpProduct(
  data: Partial<SrpProduct> & { brandId: string },
  editorName: string
): Promise<void> {
  const fields = {
    brand_id: data.brandId,
    name: data.name ?? '',
    category: data.category ?? '',
    sku: data.sku ?? '',
    image_url: data.imageUrl ?? '',
    fob_usd: data.fobUsd ?? 0,
    fob_eur: data.fobEur ?? 0,
    freight_do: data.freightDo ?? 0,
    import_tax_pct: data.importTaxPct ?? 0,
    shipping_cost: data.shippingCost ?? 0,
    srp_usd: data.srpUsd ?? 0,
    srp_eur: data.srpEur ?? 0,
    multiplier: data.multiplier ?? 0,
    our_price_thb: data.ourPriceThb ?? 0,
    platform_price_thb: data.platformPriceThb ?? 0,
    notes: data.notes ?? '',
    is_active: data.isActive ?? true,
    last_edited_by: editorName,
    last_edited_at: new Date().toISOString(),
  }
  if (data.id) {
    const { error } = await sb().from('srp_products').update(fields).eq('id', data.id)
    if (error) throw error
  } else {
    const { error } = await sb().from('srp_products').insert(fields)
    if (error) throw error
  }
}

export async function deleteSrpProduct(id: string): Promise<void> {
  const { error } = await sb().from('srp_products').delete().eq('id', id)
  if (error) throw error
}

/** import จาก Excel — จับคู่ด้วย SKU: มีอยู่แล้วอัพเดต ไม่มีสร้างใหม่ */
export async function upsertSrpProductsBySku(
  brandId: string,
  rows: Partial<SrpProduct>[],
  editorName: string
): Promise<{ inserted: number; updated: number }> {
  const existing = await getSrpProducts(brandId)
  const bySku = new Map(existing.filter((p) => p.sku).map((p) => [p.sku, p]))
  let inserted = 0
  let updated = 0
  for (const row of rows) {
    const match = row.sku ? bySku.get(row.sku) : undefined
    await saveSrpProduct({ ...row, id: match?.id, brandId }, editorName)
    if (match) updated++
    else inserted++
  }
  return { inserted, updated }
}

/* ── ช่องทางขาย ─────────────────────────────────────────────────────── */

export async function getSrpChannels(brandId: string): Promise<SrpChannel[]> {
  const { data, error } = await sb()
    .from('srp_brand_channels')
    .select('*')
    .eq('brand_id', brandId)
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map(toChannel)
}

export async function saveSrpChannel(data: Partial<SrpChannel> & { brandId: string }): Promise<void> {
  const fields = {
    brand_id: data.brandId,
    type: data.type ?? 'offline',
    name: data.name ?? '',
    sort_order: data.sortOrder ?? 0,
    gp_pct: data.gpPct ?? 0,
    pc_pct: data.pcPct ?? 0,
    dc_pct: data.dcPct ?? 0,
    commission_pct: data.commissionPct ?? 0,
    transaction_fee_pct: data.transactionFeePct ?? 0,
    service_fee_pct: data.serviceFeePct ?? 0,
    shipping_thb: data.shippingThb ?? 0,
    promo_pct: data.promoPct ?? 0,
  }
  if (data.id) {
    const { error } = await sb().from('srp_brand_channels').update(fields).eq('id', data.id)
    if (error) throw error
  } else {
    const { error } = await sb().from('srp_brand_channels').insert(fields)
    if (error) throw error
  }
}

/* ── ประวัติการแก้ไขสินค้า (trigger ฝั่ง DB เป็นคนเขียน) ────────────── */

export interface SrpHistoryEntry {
  id: string
  productId: string
  /** ชื่อสินค้า ณ ตอนนี้ — ไม่ใช่ชื่อ ณ ตอนที่แก้ */
  productName: string
  /** ชื่อคอลัมน์จริงใน srp_products หรือ 'created' */
  field: string
  oldValue: string | null
  newValue: string | null
  editedBy: string
  createdAt: string
}

/**
 * ประวัติล่าสุดของแบรนด์ (ใส่ productId = เฉพาะสินค้าตัวนั้น)
 *
 * จำกัดจำนวนไว้เพราะแก้ราคาทั้งแบรนด์ทีเดียวได้เป็นร้อยบรรทัด — หน้าจอดูย้อนหลัง
 * ไม่ได้ไว้ทำรายงาน ถ้าต้องขุดจริงค่อยดูจากฐานข้อมูล
 */
export async function getSrpHistory(
  brandId: string,
  productId?: string,
  limit = 300
): Promise<SrpHistoryEntry[]> {
  let q = sb()
    .from('srp_product_history')
    .select('id, product_id, field, old_value, new_value, edited_by, created_at, srp_products(name)')
    .eq('brand_id', brandId)
  if (productId) q = q.eq('product_id', productId)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: (r.srp_products as { name?: string } | null)?.name ?? '(ลบไปแล้ว)',
    field: r.field,
    oldValue: r.old_value,
    newValue: r.new_value,
    editedBy: r.edited_by,
    createdAt: r.created_at,
  }))
}

export async function deleteSrpChannel(id: string): Promise<void> {
  const { error } = await sb().from('srp_brand_channels').delete().eq('id', id)
  if (error) throw error
}

/* ── สิทธิ์รายคน-รายแบรนด์ (แอดมินจัดการ) ───────────────────────────── */

export async function getSrpBrandAccess(brandId: string): Promise<SrpBrandAccess[]> {
  // ⚠️ ตารางนี้ชี้ไป users 2 ทาง (user_id + granted_by) — ต้องระบุชื่อ FK ให้ชัด
  // ไม่งั้น PostgREST ตอบ error "more than one relationship found" ทั้ง query
  const { data, error } = await sb()
    .from('srp_brand_access')
    .select('id, brand_id, user_id, role, users!srp_brand_access_user_id_fkey(display_name)')
    .eq('brand_id', brandId)
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    brandId: r.brand_id,
    userId: r.user_id,
    role: r.role as 'viewer' | 'editor',
    userName: (r.users as { display_name?: string } | null)?.display_name ?? '',
  }))
}

export async function grantSrpAccess(
  brandId: string,
  userId: string,
  role: 'viewer' | 'editor',
  grantedBy: string
): Promise<void> {
  const { error } = await sb()
    .from('srp_brand_access')
    .upsert(
      { brand_id: brandId, user_id: userId, role, granted_by: grantedBy },
      { onConflict: 'brand_id,user_id' }
    )
  if (error) throw error
}

export async function revokeSrpAccess(id: string): Promise<void> {
  const { error } = await sb().from('srp_brand_access').delete().eq('id', id)
  if (error) throw error
}

/* ── รูปภาพ ─────────────────────────────────────────────────────────── */

/** อัพโหลดรูปเข้า bucket srp-images คืน public URL */
export async function uploadSrpImage(file: File, folder: string): Promise<string> {
  const client = sb()
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await client.storage.from('srp-images').upload(path, file, { upsert: true })
  if (error) throw error
  return client.storage.from('srp-images').getPublicUrl(path).data.publicUrl
}
