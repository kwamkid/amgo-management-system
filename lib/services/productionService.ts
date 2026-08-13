// lib/services/productionService.ts
//
// ระบบผลิต ADAY FRESH — สูตรน้ำ (ต่อ 1 ลิตร) + บันทึก batch พร้อม yield
//
// ตั้งใจไม่มีสต็อก/ต้นทุน/จัดซื้อ — บทเรียนจาก joolz-factory เดิม
// batch เก็บ snapshot ส่วนผสมทั้ง "ตามสูตร" และ "ใช้จริง" — แก้สูตรทีหลัง
// ประวัติเก่าไม่เปลี่ยน
//
// yield % = ลิตรที่กรอกได้จริง ÷ กก.วัตถุดิบหลักที่ใช้จริง × 100
// (วัตถุดิบหลัก = ส่วนผสมที่ติ๊ก is_yield_base ในสูตร เช่น ส้ม — หน่วยต้องเป็น kg/g)

import { createClient } from '@/lib/supabase/client'
import { getDisplayNames } from '@/lib/services/user/queries'

const sb = () => createClient()

export type RecipeUnit = 'g' | 'kg' | 'ml' | 'l' | 'pcs'

export const UNIT_TH: Record<RecipeUnit, string> = {
  g: 'กรัม',
  kg: 'กก.',
  ml: 'มล.',
  l: 'ลิตร',
  pcs: 'ชิ้น',
}

export interface RecipeItem {
  id?: string
  name: string
  qtyPerLiter: number
  unit: RecipeUnit
  isYieldBase: boolean
}

export type RecipeType = 'fixed' | 'brix'

export interface Recipe {
  id: string
  name: string
  note: string
  isActive: boolean
  updatedAt: string
  /** fixed = ส่วนผสมต่อ 1 ลิตร · brix = วัดค่าน้ำคั้นก่อนแล้วคำนวณของที่เติม */
  recipeType: RecipeType
  /** เป้าความหวานของน้ำขาย (สูตร brix) */
  targetBrix: number | null
  /** ความหวานน้ำเชื่อมที่ใช้เติม (สูตร brix) */
  syrupBrix: number
  /** ขั้นตอนการทำ — ข้อความ fix แสดงในหน้าผสม */
  steps: string
  /** fixed: ต่อ 1 ลิตร · brix: ของที่เติมต่อลิตรน้ำสุดท้าย (เช่น เกลือ) */
  items: RecipeItem[]
}

/**
 * คำนวณของที่ต้องเติมจากค่า Brix ที่วัดได้ (สมดุลความหวานมาตรฐาน)
 * - หวานเกินเป้า → เติมน้ำเปล่าเจือจาง
 * - หวานไม่ถึงเป้า → เติมน้ำเชื่อม (ความหวาน syrupBrix)
 * ตัวเลขเป็นค่าประมาณ (Brix เป็น % โดยน้ำหนัก แต่หน้างานตวงเป็นลิตร)
 */
export function brixMix(juiceLiters: number, juiceBrix: number, targetBrix: number, syrupBrix: number) {
  const r2 = (n: number) => Math.round(n * 100) / 100
  if (juiceLiters <= 0 || juiceBrix <= 0 || targetBrix <= 0) {
    return { waterLiters: 0, syrupLiters: 0, totalLiters: r2(juiceLiters) }
  }
  let waterLiters = 0
  let syrupLiters = 0
  if (juiceBrix > targetBrix) {
    waterLiters = (juiceLiters * (juiceBrix - targetBrix)) / targetBrix
  } else if (juiceBrix < targetBrix && syrupBrix > targetBrix) {
    syrupLiters = (juiceLiters * (targetBrix - juiceBrix)) / (syrupBrix - targetBrix)
  }
  return {
    waterLiters: r2(waterLiters),
    syrupLiters: r2(syrupLiters),
    totalLiters: r2(juiceLiters + waterLiters + syrupLiters),
  }
}

export interface BottleSize {
  id: string
  label: string
  ml: number
  isActive: boolean
}

export interface BatchItemInput {
  name: string
  unit: string
  plannedQty: number
  actualQty: number
  isYieldBase: boolean
}

export interface BatchBottleInput {
  label: string
  ml: number
  count: number
}

export interface ProductionBatch {
  id: string
  batchDate: string
  createdAt: string
  recipeId: string | null
  recipeName: string
  litersPlanned: number
  outputMl: number
  yieldBaseKg: number | null
  yieldPercent: number | null
  /** ค่าที่วัดตอนผสม (สูตร brix) */
  juiceLiters: number | null
  juiceBrix: number | null
  madeBy: string | null
  madeByName: string
  note: string
  items: BatchItemInput[]
  bottles: BatchBottleInput[]
}

/** แปลงปริมาณเป็น กก. สำหรับคิด yield — หน่วยที่ไม่ใช่น้ำหนักไม่นับ */
export const toKg = (qty: number, unit: string): number =>
  unit === 'kg' ? qty : unit === 'g' ? qty / 1000 : 0

/**
 * แตกขั้นตอนการทำเป็นรายขั้น — บรรทัดละขั้น ระบบใส่หมายเลขให้ตอนแสดงผลเสมอ
 * (เจ้าของสั่ง: บังคับ number bullet) ถ้าผู้ใช้พิมพ์ "1." / "2)" มาเอง ตัดทิ้งกันเลขซ้ำ
 */
export const stepLines = (steps: string): string[] =>
  steps
    .split('\n')
    .map((l) => l.trim().replace(/^\d+\s*[.)]\s*/, ''))
    .filter(Boolean)

/** เลือกหน่วยให้อ่านง่าย — 30000 g กลายเป็น 30 kg, 1500 ml เป็น 1.5 l */
export function smartQty(qty: number, unit: RecipeUnit): { qty: number; unit: RecipeUnit } {
  if (unit === 'g' && qty >= 1000) return { qty: Math.round((qty / 1000) * 100) / 100, unit: 'kg' }
  if (unit === 'ml' && qty >= 1000) return { qty: Math.round((qty / 1000) * 100) / 100, unit: 'l' }
  return { qty: Math.round(qty * 100) / 100, unit }
}

// ── สูตร ─────────────────────────────────────────────────────────────

export async function getRecipes(includeInactive = false): Promise<Recipe[]> {
  let q = sb()
    .from('production_recipes')
    .select('id, name, note, is_active, updated_at, recipe_type, target_brix, syrup_brix, steps, production_recipe_items(id, name, qty_per_liter, unit, is_yield_base, sort_order)')
    .order('sort_order')
    .order('name')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    note: r.note,
    isActive: r.is_active,
    updatedAt: r.updated_at,
    recipeType: (r.recipe_type as RecipeType) ?? 'fixed',
    targetBrix: r.target_brix === null ? null : Number(r.target_brix),
    syrupBrix: Number(r.syrup_brix ?? 65),
    steps: r.steps ?? '',
    items: [...r.production_recipe_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        id: i.id,
        name: i.name,
        qtyPerLiter: Number(i.qty_per_liter),
        unit: i.unit as RecipeUnit,
        isYieldBase: i.is_yield_base,
      })),
  }))
}

/** สร้าง/แก้สูตร — แทนที่รายการส่วนผสมทั้งชุด */
export async function saveRecipe(data: {
  id?: string
  name: string
  note: string
  recipeType: RecipeType
  targetBrix: number | null
  syrupBrix: number
  steps: string
  items: RecipeItem[]
  updatedBy: string
}): Promise<string> {
  const client = sb()
  const fields = {
    name: data.name,
    note: data.note,
    recipe_type: data.recipeType,
    target_brix: data.recipeType === 'brix' ? data.targetBrix : null,
    syrup_brix: data.syrupBrix,
    steps: data.steps,
    updated_by: data.updatedBy,
  }
  let recipeId = data.id
  if (recipeId) {
    const { error } = await client
      .from('production_recipes')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', recipeId)
    if (error) throw error
    const { error: delErr } = await client.from('production_recipe_items').delete().eq('recipe_id', recipeId)
    if (delErr) throw delErr
  } else {
    const { data: row, error } = await client
      .from('production_recipes')
      .insert(fields)
      .select('id')
      .single()
    if (error) throw error
    recipeId = row.id
  }
  if (data.items.length > 0) {
    const { error } = await client.from('production_recipe_items').insert(
      data.items.map((i, idx) => ({
        recipe_id: recipeId!,
        name: i.name,
        qty_per_liter: i.qtyPerLiter,
        unit: i.unit,
        is_yield_base: i.isYieldBase,
        sort_order: idx,
      }))
    )
    if (error) throw error
  }
  return recipeId!
}

/** ปิด/เปิดสูตร — ไม่ลบจริง ประวัติ batch ยังอ้างถึงได้ */
export async function setRecipeActive(id: string, active: boolean): Promise<void> {
  const { error } = await sb().from('production_recipes').update({ is_active: active }).eq('id', id)
  if (error) throw error
}

// ── ขนาดขวด ──────────────────────────────────────────────────────────

export async function getBottleSizes(includeInactive = false): Promise<BottleSize[]> {
  let q = sb().from('production_bottle_sizes').select('id, label, ml, is_active').order('sort_order').order('ml')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r) => ({ id: r.id, label: r.label, ml: r.ml, isActive: r.is_active }))
}

export async function saveBottleSize(data: { id?: string; label: string; ml: number }): Promise<void> {
  const client = sb()
  if (data.id) {
    const { error } = await client
      .from('production_bottle_sizes')
      .update({ label: data.label, ml: data.ml })
      .eq('id', data.id)
    if (error) throw error
  } else {
    const { error } = await client.from('production_bottle_sizes').insert({ label: data.label, ml: data.ml })
    if (error) throw error
  }
}

export async function setBottleSizeActive(id: string, active: boolean): Promise<void> {
  const { error } = await sb().from('production_bottle_sizes').update({ is_active: active }).eq('id', id)
  if (error) throw error
}

// ── บันทึกการผลิต ────────────────────────────────────────────────────

export async function createBatch(data: {
  batchDate: string
  recipeId: string
  recipeName: string
  litersPlanned: number
  note: string
  madeBy: string
  items: BatchItemInput[]
  bottles: BatchBottleInput[]
  /** สูตร brix: กก.ผลไม้ที่ใช้จริง (กรอกตรง) — สูตร fixed คิดจาก item ที่ติ๊กแทน */
  yieldBaseKg?: number
  juiceLiters?: number
  juiceBrix?: number
}): Promise<void> {
  const client = sb()
  const outputMl = data.bottles.reduce((s, b) => s + b.ml * b.count, 0)
  const yieldBaseKg =
    data.yieldBaseKg ??
    data.items.filter((i) => i.isYieldBase).reduce((s, i) => s + toKg(i.actualQty, i.unit), 0)
  const yieldPercent = yieldBaseKg > 0 ? Math.round((outputMl / 1000 / yieldBaseKg) * 1000) / 10 : null

  const { data: batch, error } = await client
    .from('production_batches')
    .insert({
      batch_date: data.batchDate,
      recipe_id: data.recipeId,
      recipe_name: data.recipeName,
      liters_planned: data.litersPlanned,
      output_ml: outputMl,
      yield_base_kg: yieldBaseKg > 0 ? yieldBaseKg : null,
      yield_percent: yieldPercent,
      juice_liters: data.juiceLiters ?? null,
      juice_brix: data.juiceBrix ?? null,
      made_by: data.madeBy,
      note: data.note,
    })
    .select('id')
    .single()
  if (error) throw error

  if (data.items.length > 0) {
    const { error: itemErr } = await client.from('production_batch_items').insert(
      data.items.map((i, idx) => ({
        batch_id: batch.id,
        name: i.name,
        unit: i.unit,
        planned_qty: i.plannedQty,
        actual_qty: i.actualQty,
        is_yield_base: i.isYieldBase,
        sort_order: idx,
      }))
    )
    if (itemErr) throw itemErr
  }

  const bottles = data.bottles.filter((b) => b.count > 0)
  if (bottles.length > 0) {
    const { error: bottleErr } = await client.from('production_batch_bottles').insert(
      bottles.map((b) => ({ batch_id: batch.id, label: b.label, ml: b.ml, count: b.count }))
    )
    if (bottleErr) throw bottleErr
  }
}

export async function getBatches(start: string, end: string): Promise<ProductionBatch[]> {
  const { data, error } = await sb()
    .from('production_batches')
    .select('id, batch_date, created_at, recipe_id, recipe_name, liters_planned, output_ml, yield_base_kg, yield_percent, juice_liters, juice_brix, made_by, note, production_batch_items(name, unit, planned_qty, actual_qty, is_yield_base, sort_order), production_batch_bottles(label, ml, count)')
    .gte('batch_date', start)
    .lte('batch_date', end)
    .order('batch_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = data ?? []
  const names = await getDisplayNames(rows.map((r) => r.made_by).filter((id): id is string => !!id))
  return rows.map((r) => ({
    id: r.id,
    batchDate: r.batch_date,
    createdAt: r.created_at,
    recipeId: r.recipe_id,
    recipeName: r.recipe_name,
    litersPlanned: Number(r.liters_planned),
    outputMl: r.output_ml,
    yieldBaseKg: r.yield_base_kg === null ? null : Number(r.yield_base_kg),
    yieldPercent: r.yield_percent === null ? null : Number(r.yield_percent),
    juiceLiters: r.juice_liters === null ? null : Number(r.juice_liters),
    juiceBrix: r.juice_brix === null ? null : Number(r.juice_brix),
    madeBy: r.made_by,
    madeByName: (r.made_by && names.get(r.made_by)) || '—',
    note: r.note,
    items: [...r.production_batch_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        name: i.name,
        unit: i.unit,
        plannedQty: Number(i.planned_qty),
        actualQty: Number(i.actual_qty),
        isYieldBase: i.is_yield_base,
      })),
    bottles: r.production_batch_bottles.map((b) => ({ label: b.label, ml: b.ml, count: b.count })),
  }))
}

/** ลบ batch ที่บันทึกผิด — UI เปิดให้เฉพาะแอดมิน */
export async function deleteBatch(id: string): Promise<void> {
  const { error } = await sb().from('production_batches').delete().eq('id', id)
  if (error) throw error
}
