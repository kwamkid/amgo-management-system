// lib/services/import/importService.ts
//
// สั่งของนำเข้า — แผนสั่งของรายตู้ ย้ายมาจากหน้า order-plan ในเครื่องเจ้าของ (29 ต.ค. 69)
// RLS คุมชั้น DB (เฉพาะคนใน import_access) โค้ดฝั่งนี้ query ตรงได้เลย
// รอบ/รายการถูกสร้างโดย sync จาก builder ฝั่ง AGD · หน้าเว็บแก้แค่ qty กับสถานะ

import { createClient } from '@/lib/supabase/client'

const sb = () => createClient()

export type ImportRoundStatus = 'draft' | 'approved' | 'sent'

export interface ImportRound {
  id: string
  slug: string
  brand: string
  sub: string
  round: string
  title: string
  container: string | null
  status: ImportRoundStatus
  currency: string
  fx: number | null
  incoterm: string | null
  containers: Record<string, number>
  arrive: string | null
  updatedAt: string
  itemCount: number
}

type RoundRow = {
  id: string
  slug: string
  brand: string
  sub: string
  round: string
  title: string
  container: string | null
  status: string
  currency: string
  fx: number | null
  incoterm: string | null
  containers: unknown
  arrive: string | null
  updated_at: string
  import_round_items: { count: number }[]
}

export async function getRounds(): Promise<ImportRound[]> {
  const { data, error } = await sb()
    .from('import_rounds')
    .select('id, slug, brand, sub, round, title, container, status, currency, fx, incoterm, containers, arrive, updated_at, import_round_items(count)')
    .order('container', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as RoundRow[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    brand: r.brand,
    sub: r.sub,
    round: r.round,
    title: r.title,
    container: r.container,
    status: r.status as ImportRoundStatus,
    currency: r.currency,
    fx: r.fx,
    incoterm: r.incoterm,
    containers: (r.containers ?? {}) as Record<string, number>,
    arrive: r.arrive,
    updatedAt: r.updated_at,
    itemCount: r.import_round_items?.[0]?.count ?? 0,
  }))
}

/** แท็บของตู้เดียวกัน — แบรนด์หลักก่อน แล้วแบรนด์ย่อยเรียงตามชื่อ */
export function sortTabs(rounds: ImportRound[]): ImportRound[] {
  return [...rounds].sort((a, b) => (a.sub ? 1 : 0) - (b.sub ? 1 : 0) || a.sub.localeCompare(b.sub))
}

/** จัดกลุ่มตามตู้ — ตู้ใหม่ก่อน · ไม่มีตู้ = กลุ่มท้าย */
export function groupByContainer(rounds: ImportRound[]): { container: string | null; rounds: ImportRound[] }[] {
  const map = new Map<string | null, ImportRound[]>()
  for (const r of rounds) map.set(r.container, [...(map.get(r.container) ?? []), r])
  return [...map.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b.localeCompare(a)))
    .map(([container, list]) => ({ container, rounds: sortTabs(list) }))
}
