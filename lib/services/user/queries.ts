// lib/services/user/queries.ts
//
// อ่านข้อมูลพนักงาน
//
// ── ต่างจากของเดิมตรงไหน ──────────────────────────────────────────────
// Firestore ค้นข้อความไม่ได้ ของเดิมจึง "ดึงพนักงานทั้งบริษัทมาแล้วกรองในเบราว์เซอร์"
// ทุกครั้งที่พิมพ์ค้นหา · แบ่งหน้าก็ตัด array เอาเอง
// Postgres ค้นด้วย ilike ได้ตรง ๆ และแบ่งหน้าด้วย range()

import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types/user'
import { attachLocations, mapUser, type UserRow, type UserData } from './mappers'

const sb = () => createClient()

/** UserData เป็น superset ของ User — หน้าจอเดิมประกาศตัวแปรเป็น User */
const asUser = (u: UserData) => u as unknown as User

async function locationsFor(userIds: string[]) {
  if (!userIds.length) return []
  const { data } = await sb()
    .from('user_allowed_locations')
    .select('user_id, location_id')
    .in('user_id', userIds)
  return data ?? []
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

  // กรองตามสาขาต้องรู้ก่อนว่าใครอยู่สาขานั้น (อยู่คนละตาราง)
  let idsAtLocation: string[] | null = null
  if (filters?.locationId) {
    const { data } = await client
      .from('user_allowed_locations')
      .select('user_id')
      .eq('location_id', filters.locationId)
    idsAtLocation = (data ?? []).map((r) => r.user_id)
    if (!idsAtLocation.length) return { users: [], lastDoc: null, hasMore: false }
  }

  let q = client
    .from('users')
    .select('*')
    .is('deleted_at', null)
    .eq('is_system', false) // Dev Admin / Super Admin ไม่ใช่พนักงาน
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize) // ขอเกิน 1 แถวเพื่อรู้ว่ายังมีต่อไหม

  if (filters?.role) q = q.eq('role', filters.role)
  if (filters?.isActive !== undefined) q = q.eq('is_active', filters.isActive)
  if (idsAtLocation) q = q.in('id', idsAtLocation)

  // ค้นในฐานข้อมูล ไม่ใช่ดึงมาทั้งบริษัทแล้วกรองในเบราว์เซอร์
  const filter = filters?.searchTerm ? orFilter(filters.searchTerm) : null
  if (filter) q = q.or(filter)

  const { data, error } = await q
  if (error) throw new Error(`ดึงรายชื่อพนักงานไม่สำเร็จ: ${error.message}`)

  const rows = (data ?? []) as UserRow[]
  const hasMore = rows.length > pageSize
  const page = rows.slice(0, pageSize)

  const links = await locationsFor(page.map((r) => r.id))

  return {
    users: attachLocations(page, links).map(asUser),
    lastDoc: page.length ? { offset: offset + pageSize } : null,
    hasMore,
  }
}

/* ------------------------------------------------------------------ */
export async function getUser(userId: string): Promise<User | null> {
  if (!userId) return null
  const client = sb()

  const [{ data: row, error }, { data: locs }] = await Promise.all([
    client.from('users').select('*').eq('id', userId).maybeSingle(),
    client.from('user_allowed_locations').select('location_id').eq('user_id', userId),
  ])

  if (error) throw new Error(`ดึงข้อมูลพนักงานไม่สำเร็จ: ${error.message}`)
  if (!row) return null

  return asUser(mapUser(row as UserRow, (locs ?? []).map((l) => l.location_id)))
}

/* ------------------------------------------------------------------ */
export async function searchUsers(searchTerm: string): Promise<User[]> {
  const filter = orFilter(searchTerm)
  if (!filter) return []

  const { data, error } = await sb()
    .from('users')
    .select('*')
    .is('deleted_at', null)
    .eq('is_system', false)
    .eq('is_active', true)
    .or(filter)
    .order('full_name')
    .limit(100)

  if (error) throw new Error(`ค้นหาพนักงานไม่สำเร็จ: ${error.message}`)

  const rows = (data ?? []) as UserRow[]
  return attachLocations(rows, await locationsFor(rows.map((r) => r.id))).map(asUser)
}

/* ------------------------------------------------------------------ */
export async function getUsersByLocation(locationId: string): Promise<User[]> {
  const client = sb()

  const { data: links } = await client
    .from('user_allowed_locations')
    .select('user_id, location_id')
    .eq('location_id', locationId)

  const ids = (links ?? []).map((l) => l.user_id)
  if (!ids.length) return []

  const { data, error } = await client
    .from('users')
    .select('*')
    .in('id', ids)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('full_name')

  if (error) throw new Error(`ดึงพนักงานตามสาขาไม่สำเร็จ: ${error.message}`)
  return attachLocations((data ?? []) as UserRow[], links ?? []).map(asUser)
}

/* ------------------------------------------------------------------ */
export async function getPendingUsers(): Promise<User[]> {
  const { data, error } = await sb()
    .from('users')
    .select('*')
    .eq('needs_approval', true)
    .is('deleted_at', null)
    .eq('is_system', false)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`ดึงรายชื่อรออนุมัติไม่สำเร็จ: ${error.message}`)

  const rows = (data ?? []) as UserRow[]
  return attachLocations(rows, await locationsFor(rows.map((r) => r.id))).map(asUser)
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
