// lib/services/bot/botApi.ts
//
// API ของบอทแชท (/api/bot/...) — Hermes Agent ใน Discord อ่าน/จัดการงานของทีม (เจ้าของขอ 28 ต.ค. 69)
//
// กุญแจ: bot_api_keys (เก็บแค่ sha256) · ส่งมาทาง  Authorization: Bearer amgo_bot_…  หรือ  x-api-key
//   ไม่รับกุญแจจาก query string (หลุดลง log ง่าย)
// scope:
//   superadmin (Jarvis — เจ้าของคนเดียว) → สิทธิ์แอดมิน · ลงชื่อเป็น acts_as ของกุญแจ
//   general    (Edith — พนักงานทุกคน)   → ต้องส่ง X-Discord-User-Id ของคนที่คุยด้วย
//              → หา users.discord_user_id แล้วใช้สิทธิ์ของคนนั้นตรง ๆ · ไม่พบ/ไม่ผูก = 403
//
// ⚠️ API ใช้ service role (ข้าม RLS) — กติกาสิทธิ์ของงานถูกเขียนซ้ำที่ lib/services/bot/botTasks.ts
//    ให้ตรงกับ policy + trigger ใน migration tasks (20261027075204 → 20261028014843)
//    แก้กติกาใน DB เมื่อไหร่ ต้องตามมาแก้ที่นี่ด้วย

import { createHash, randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

const PREFIX = 'amgo_bot_'

export const hashBotKey = (key: string) => createHash('sha256').update(key).digest('hex')

/** กุญแจใหม่ — คืนตัวเต็ม (โชว์ครั้งเดียว) + hash ไว้เก็บ (scripts/mint-bot-key.mjs ใช้สูตรเดียวกัน) */
export function newBotKey() {
  const key = PREFIX + randomBytes(24).toString('base64url')
  return { key, hash: hashBotKey(key), prefix: key.slice(0, PREFIX.length + 4) }
}

export type AdminDb = ReturnType<typeof createAdminClient>

/**
 * bot_api_keys / bot_set_task_due ยังไม่อยู่ใน types/database.ts (types:gen ไม่มีสิทธิ์ — migration 20261028023731 apply แล้ว)
 * — หลัง apply + npm run types:gen แล้วเลิกใช้ตัวนี้ได้
 */
export const untyped = (sb: AdminDb) => sb as unknown as SupabaseClient

/** คนในทีม (ย่อ) — ใช้ทั้งผู้เรียก ผู้รับผิดชอบ และคนสร้าง */
export interface BotPerson {
  id: string
  name: string
  discordId: string | null
}

export interface BotCaller {
  keyId: string
  scope: 'superadmin' | 'general'
  /** ผู้ใช้ที่บอทกำลังทำแทน — superadmin = acts_as · general = เจ้าของ Discord id */
  user: BotPerson
  isAdmin: boolean
  /** role ใน amgo ของคนที่บอททำแทน (superadmin = admin) */
  role: string
  sb: AdminDb
}

export const personName = (u: { nickname: string | null; full_name: string }) => u.nickname || u.full_name

const USER_COLS = 'id, nickname, full_name, discord_user_id, role, is_active, deleted_at'

type UserRow = {
  id: string
  nickname: string | null
  full_name: string
  discord_user_id: string | null
  role: string
  is_active: boolean
  deleted_at: string | null
}

const toPerson = (u: UserRow): BotPerson => ({ id: u.id, name: personName(u), discordId: u.discord_user_id })

export const DISCORD_ID = /^\d{15,22}$/
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** ตรวจกุญแจ + หาผู้ใช้ที่บอททำแทน — คืน caller หรือ Response error */
export async function authBotApi(request: NextRequest): Promise<{ caller: BotCaller } | { error: NextResponse }> {
  const auth = request.headers.get('authorization')
  const key = (auth?.startsWith('Bearer ') ? auth.slice(7) : request.headers.get('x-api-key'))?.trim()
  if (!key?.startsWith(PREFIX) || key.length > 100) return { error: apiError(401, 'API key ไม่ถูกต้องหรือถูกเพิกถอนแล้ว') }

  const sb = createAdminClient()
  const { data: k } = await untyped(sb)
    .from('bot_api_keys')
    .select('id, scope, acts_as, last_used_at')
    .eq('key_hash', hashBotKey(key))
    .is('revoked_at', null)
    .maybeSingle<{ id: string; scope: 'superadmin' | 'general'; acts_as: string | null; last_used_at: string | null }>()
  if (!k) return { error: apiError(401, 'API key ไม่ถูกต้องหรือถูกเพิกถอนแล้ว') }

  // บันทึกว่าใช้ล่าสุดเมื่อไหร่ — ไม่เกินนาทีละครั้ง
  if (!k.last_used_at || Date.now() - new Date(k.last_used_at).getTime() > 60_000)
    await untyped(sb).from('bot_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', k.id)

  let row: UserRow | null = null
  if (k.scope === 'superadmin') {
    const { data } = await sb.from('users').select(USER_COLS).eq('id', k.acts_as!).maybeSingle()
    row = data
    if (!row) return { error: apiError(500, 'กุญแจ superadmin ผูกกับผู้ใช้ที่ไม่มีอยู่แล้ว') }
    return { caller: { keyId: k.id, scope: k.scope, user: toPerson(row), isAdmin: true, role: 'admin', sb } }
  }

  const discordId = request.headers.get('x-discord-user-id')?.trim()
  if (!discordId || !DISCORD_ID.test(discordId))
    return { error: apiError(403, 'ต้องส่ง header X-Discord-User-Id ของคนที่คุยกับบอท') }
  const { data } = await sb
    .from('users')
    .select(USER_COLS)
    .eq('discord_user_id', discordId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  row = data
  if (!row) return { error: apiError(403, 'Discord นี้ยังไม่ได้ผูกกับบัญชีพนักงานใน amgo') }
  return { caller: { keyId: k.id, scope: k.scope, user: toPerson(row), isAdmin: row.role === 'admin', role: row.role, sb } }
}

/**
 * หาคนจากค่าที่บอทส่งมา: 'me' · Discord id (ตัวเลข) · user id (uuid)
 * คืน { found, missing } — missing = ค่าที่หาไม่เจอ (ให้ตอบ 400 พร้อมรายชื่อ)
 */
export async function resolvePeople(sb: AdminDb, refs: string[], me: BotPerson): Promise<{ found: BotPerson[]; missing: string[] }> {
  const clean = [...new Set(refs.map((r) => String(r).trim()).filter(Boolean))]
  const discordIds = clean.filter((r) => DISCORD_ID.test(r))
  const userIds = clean.filter((r) => UUID.test(r))
  const rows: UserRow[] = []
  if (discordIds.length) {
    const { data } = await sb.from('users').select(USER_COLS).in('discord_user_id', discordIds).eq('is_active', true).is('deleted_at', null)
    rows.push(...(data ?? []))
  }
  if (userIds.length) {
    const { data } = await sb.from('users').select(USER_COLS).in('id', userIds).eq('is_active', true).is('deleted_at', null)
    rows.push(...(data ?? []))
  }
  const found = new Map<string, BotPerson>()
  const missing: string[] = []
  for (const r of clean) {
    if (r === 'me') {
      found.set(me.id, me)
      continue
    }
    const u = rows.find((x) => x.id === r || x.discord_user_id === r)
    if (u) found.set(u.id, toPerson(u))
    else missing.push(r)
  }
  return { found: [...found.values()], missing }
}

/** บอทเรียกจาก server (VPS) — ไม่ต้องเปิด CORS ให้เบราว์เซอร์ */
export function apiJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export const apiError = (status: number, error: string) => apiJson({ error }, status)

/** body JSON — พังหรือไม่ใช่ object = null */
export async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  const b = await request.json().catch(() => null)
  return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : null
}
