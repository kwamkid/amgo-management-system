// lib/services/user/queries.ts
//
// อ่านข้อมูลพนักงาน
//
// ── ต่างจากของเดิมตรงไหน ──────────────────────────────────────────────
// Firestore ค้นข้อความไม่ได้ ของเดิมจึง "ดึงพนักงานทั้งบริษัทมาแล้วกรองในเบราว์เซอร์"
// ทุกครั้งที่พิมพ์ค้นหา · แบ่งหน้าก็ตัด array เอาเอง
// Postgres ค้นด้วย ilike ได้ตรง ๆ และแบ่งหน้าด้วย range()

import { createClient } from '@/lib/supabase/client'
import type { Db } from '@/lib/supabase/db'
import type { User } from '@/types/user'
import { attachLocations, type UserRow, type UserData } from './mappers'

const sb = () => createClient()

/** UserData เป็น superset ของ User — หน้าจอเดิมประกาศตัวแปรเป็น User */
const asUser = (u: UserData) => u as unknown as User

/**
 * พนักงาน + สาขาที่เช็คอินได้ในคำขอเดียว (embed ผ่าน FK) — เดิมดึง users แล้วค่อยดึง
 * user_allowed_locations อีกรอบต่อกันทุกหน้าที่มีรายชื่อพนักงาน (30 ก.ย. 69)
 */
const WITH_LOCS = '*, user_allowed_locations(location_id)'
type RowWithLocs = UserRow & { user_allowed_locations?: { location_id: string }[] | null }

function withLocs(rows: RowWithLocs[]): UserData[] {
  const links = rows.flatMap((r) =>
    (r.user_allowed_locations ?? []).map((l) => ({ user_id: r.id, location_id: l.location_id }))
  )
  const plain = rows.map(({ user_allowed_locations: _drop, ...r }) => r as UserRow)
  return attachLocations(plain, links)
}

/**
 * id → "ชื่อจริง (ชื่อเล่น)" จากโปรไฟล์ปัจจุบัน
 *
 * ไว้ทับชื่อที่ตาราง event (checkins, delivery_points, ...) ถ่าย snapshot
 * เก็บไว้ตอนเกิดเหตุการณ์ — snapshot เป็นชื่อจริงล้วนและไม่อัปเดตตามโปรไฟล์
 * คนอ่านหน้าจอจำกันด้วยชื่อเล่น
 */
export async function getDisplayNames(
  userIds: string[],
  client?: Db
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) return new Map()

  const { data } = await (client ?? sb()).from('users').select('id, full_name, display_name').in('id', ids)
  return new Map((data ?? []).map((u) => [u.id, u.display_name || u.full_name]))
}

/** ช่องที่ยอมให้ค้นหา — ตรงกับที่หน้าจัดการพนักงานบอกผู้ใช้ */
const SEARCH_COLUMNS = ['full_name', 'nickname', 'line_display_name', 'phone', 'discord_username']

/**
 * ตัวคั่นของ .or() คือ ",", "(", ")" — ถ้าคำค้นมีอักขระพวกนี้ตัวกรองจะเพี้ยน
 * (พิมพ์ "(" ในช่องค้นหาแล้ว query พังทั้งอัน) จึงต้องถอดออกก่อน
 * ส่วน % กับ _ เป็นไวลด์การ์ดของ ilike — ถอดด้วยไม่งั้นค้นหาไม่ตรงที่ตั้งใจ
 */
const orFilter = (term: string) => {
  const safe = term.replace(/[,()%_\\]/g, ' ').trim()
  if (!safe) return null
  return SEARCH_COLUMNS.map((c) => `${c}.ilike.%${safe}%`).join(',')
}

/* ------------------------------------------------------------------ *
 *  รายชื่อพนักงาน
 *
 *  คง signature เดิมไว้ทั้งหมด (pageSize, lastDoc, filters) แต่ lastDoc
 *  ตีความเป็น offset แทน document snapshot ของ Firestore
 * ------------------------------------------------------------------ */
export async function getUsers(
  pageSize = 20,
  lastDoc?: { offset?: number } | number | null,
  filters?: {
    role?: string
    isActive?: boolean
    locationId?: string
    searchTerm?: string
  }
): Promise<{ users: User[]; lastDoc: { offset: number } | null; hasMore: boolean }> {
  const offset =
    typeof lastDoc === 'number' ? lastDoc : (lastDoc?.offset ?? 0)

  const client = sb()

  // กรองตามสาขา = embed ซ้ำอีกชุดแบบ !inner แล้วกรองที่ชุดนั้น — ชุดแรกยังได้สาขาครบทุกสาขา
  // (เดิมต้องยิงหาว่าใครอยู่สาขานั้นก่อน 1 รอบ)
  const select = filters?.locationId
    ? `${WITH_LOCS}, at:user_allowed_locations!inner(location_id)`
    : WITH_LOCS

  let q = client
    .from('users')
    .select(select)
    .is('deleted_at', null)
    .eq('is_system', false) // Dev Admin / Super Admin ไม่ใช่พนักงาน
    // เรียงตามรหัสพนักงาน — เลขน้อย = อยู่มานาน อ่านไล่ง่าย
    .order('employee_code', { ascending: true, nullsFirst: false })
    .range(offset, offset + pageSize) // ขอเกิน 1 แถวเพื่อรู้ว่ายังมีต่อไหม

  if (filters?.role) q = q.eq('role', filters.role)
  if (filters?.isActive !== undefined) q = q.eq('is_active', filters.isActive)
  if (filters?.locationId) q = q.eq('at.location_id', filters.locationId)

  // ค้นในฐานข้อมูล ไม่ใช่ดึงมาทั้งบริษัทแล้วกรองในเบราว์เซอร์
  const filter = filters?.searchTerm ? orFilter(filters.searchTerm) : null
  if (filter) q = q.or(filter)

  const { data, error } = await q
  if (error) throw new Error(`ดึงรายชื่อพนักงานไม่สำเร็จ: ${error.message}`)

  const rows = (data ?? []) as unknown as (RowWithLocs & { at?: unknown })[]
  const hasMore = rows.length > pageSize
  const page = rows.slice(0, pageSize).map(({ at: _at, ...r }) => r as RowWithLocs)

  return {
    users: withLocs(page).map(asUser),
    lastDoc: page.length ? { offset: offset + pageSize } : null,
    hasMore,
  }
}

/* ------------------------------------------------------------------ */
export async function getUser(userId: string): Promise<User | null> {
  if (!userId) return null
  const client = sb()

  const { data: row, error } = await client.from('users').select(WITH_LOCS).eq('id', userId).maybeSingle()

  if (error) throw new Error(`ดึงข้อมูลพนักงานไม่สำเร็จ: ${error.message}`)
  if (!row) return null

  return asUser(withLocs([row as unknown as RowWithLocs])[0])
}

/* ------------------------------------------------------------------ */
export async function searchUsers(searchTerm: string): Promise<User[]> {
  const filter = orFilter(searchTerm)
  if (!filter) return []

  const { data, error } = await sb()
    .from('users')
    .select(WITH_LOCS)
    .is('deleted_at', null)
    .eq('is_system', false)
    .eq('is_active', true)
    .or(filter)
    .order('full_name')
    .limit(100)

  if (error) throw new Error(`ค้นหาพนักงานไม่สำเร็จ: ${error.message}`)
  return withLocs((data ?? []) as unknown as RowWithLocs[]).map(asUser)
}

/* ------------------------------------------------------------------ */
export async function getUsersByLocation(locationId: string): Promise<User[]> {
  const { data, error } = await sb()
    .from('users')
    .select(`${WITH_LOCS}, at:user_allowed_locations!inner(location_id)`)
    .eq('at.location_id', locationId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('full_name')

  if (error) throw new Error(`ดึงพนักงานตามสาขาไม่สำเร็จ: ${error.message}`)
  const rows = (data ?? []) as unknown as (RowWithLocs & { at?: unknown })[]
  return withLocs(rows.map(({ at: _at, ...r }) => r as RowWithLocs)).map(asUser)
}

/* ------------------------------------------------------------------ */
export async function getPendingUsers(): Promise<User[]> {
  const { data, error } = await sb()
    .from('users')
    .select(WITH_LOCS)
    .eq('needs_approval', true)
    .is('deleted_at', null)
    .eq('is_system', false)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`ดึงรายชื่อรออนุมัติไม่สำเร็จ: ${error.message}`)
  return withLocs((data ?? []) as unknown as RowWithLocs[]).map(asUser)
}

/* ------------------------------------------------------------------ *
 *  สถิติ
 *
 *  ของเดิมยิง 3 query แล้วดึงเอกสารทั้งหมดมานับใน JavaScript
 *  ตรงนี้ขอแค่ role กับ 2 คอลัมน์สถานะ แล้วนับ — ไม่ต้องลากข้อมูลทั้งแถว
 * ------------------------------------------------------------------ */
export async function getUserStatistics() {
  const { data, error } = await sb()
    .from('users')
    .select('role, is_active, needs_approval')
    .is('deleted_at', null)
    .eq('is_system', false)

  if (error) throw new Error(`ดึงสถิติพนักงานไม่สำเร็จ: ${error.message}`)

  const rows = data ?? []
  const byRole = { admin: 0, hr: 0, manager: 0, employee: 0, driver: 0 }

  for (const r of rows) {
    if (r.role in byRole) byRole[r.role as keyof typeof byRole]++
  }

  const pending = rows.filter((r) => r.needs_approval).length
  const active = rows.filter((r) => r.is_active).length

  return {
    total: rows.length,
    active,
    pending,
    inactive: rows.length - active - pending,
    byRole,
  }
}
