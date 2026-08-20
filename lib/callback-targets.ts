// lib/callback-targets.ts
//
// อ่านปลายทาง "ลูกค้าให้ติดต่อกลับ" จากฐานข้อมูล
//
// ⚠️ ทำไมต้อง cast: `types/database.ts` ถูก generate จาก Supabase CLI ซึ่งยัง
// ไม่รู้จักตาราง callback_targets/_members (รัน `npm run types:gen` แล้วติด
// Unauthorized — เครื่องนี้ยังไม่ได้ล็อกอิน CLI) · รวม cast ไว้ที่ไฟล์นี้ที่เดียว
// พอ regen types ได้เมื่อไหร่ ลบ cast ทิ้งแล้วใช้ client ตรง ๆ ได้เลย

import type { createAdminClient } from '@/lib/supabase/admin'

export interface CallbackTarget {
  id: string
  label: string
}

export interface CallbackPerson {
  discord_user_id: string | null
  nickname: string | null
}

type Admin = ReturnType<typeof createAdminClient>
/** ช่องทางเดียวที่ยอมให้หลบ type ของตารางใหม่ */
const loose = (sb: Admin) => sb as unknown as {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: unknown): any
      order(col: string): Promise<{ data: unknown[] | null; error: { message: string } | null }>
    }
  }
}

/** เมนูทั้งหมดที่ยังเปิดใช้ เรียงตามที่ตั้งไว้ */
export async function listTargets(sb: Admin) {
  const { data, error } = await loose(sb)
    .from('callback_targets')
    .select('id, label')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []) as CallbackTarget[]
}

/** หาปลายทางจาก id หรือจากชื่อเมนู — Shortcut ส่งมาได้ทั้งสองแบบ */
export async function findTarget(sb: Admin, opts: { id?: string; label?: string }) {
  const base = loose(sb).from('callback_targets').select('id, label').eq('is_active', true)
  const { data } = await (opts.id ? base.eq('id', opts.id) : base.eq('label', opts.label ?? ''))
    .maybeSingle()
  return (data as CallbackTarget | null) ?? null
}

/** คนที่ต้อง mention ของปลายทางนั้น — ตัดคนที่ยังไม่ผูก Discord ออก */
export async function membersOf(sb: Admin, targetId: string) {
  const { data } = await loose(sb)
    .from('callback_target_members')
    .select('users(discord_user_id, nickname)')
    .eq('target_id', targetId)
  return ((data ?? []) as { users: CallbackPerson | null }[])
    .map((r) => r.users)
    .filter((u): u is CallbackPerson => !!u?.discord_user_id)
}
