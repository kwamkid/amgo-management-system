// lib/services/inviteService.ts
//
// ลิงก์เชิญพนักงานใหม่ บน Supabase
// ของเดิมที่ใช้ Firestore ลบทิ้งแล้ว — ย้อนดูได้ใน git history
//
// ── ต่างจากของเดิมตรงไหน ──────────────────────────────────────────────
// 1. รหัสซ้ำกันไม่ได้ด้วย unique constraint — ของเดิมวน "สุ่มแล้วเช็ค"
//    ซึ่งสองคนกดสร้างพร้อมกันก็ยังได้รหัสซ้ำ
// 2. การนับจำนวนครั้งที่ใช้ทำใน SQL คำสั่งเดียว (consume_invite_link)
//    ของเดิมอ่าน-บวก-เขียน ทำให้ลิงก์จำกัด 1 ครั้งถูกใช้ได้ 2 คนถ้ากดพร้อมกัน

import { createClient } from '@/lib/supabase/client'
import type {
  InviteLink,
  CreateInviteLinkData,
  UpdateInviteLinkData,
} from '@/types/invite'
import type { Database } from '@/types/database'

type InviteRow = Database['public']['Tables']['invite_links']['Row']

const sb = () => createClient()

function toLink(r: InviteRow): InviteLink {
  return {
    id: r.id,
    code: r.code,
    createdBy: r.created_by ?? '',
    createdByName: r.created_by_name || undefined,
    defaultRole: r.default_role as InviteLink['defaultRole'],
    defaultLocationIds: r.default_location_ids ?? [],
    allowCheckInOutsideLocation: r.allow_checkin_outside_location,
    requireApproval: r.require_approval,
    maxUses: r.max_uses ?? undefined,
    usedCount: r.used_count,
    expiresAt: r.expires_at ? new Date(r.expires_at) : undefined,
    isActive: r.is_active,
    note: r.note || undefined,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

/* ------------------------------------------------------------------ */
export const generateInviteCode = (): string => {
  // ตัด 0 O 1 I ออก — คนอ่านผิดกันประจำเวลาบอกรหัสทางโทรศัพท์
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export const isCodeExists = async (code: string): Promise<boolean> => {
  const { data, error } = await sb()
    .from('invite_links')
    .select('id')
    .eq('code', code.toUpperCase())
    .limit(1)

  if (error) throw new Error(`ตรวจรหัสซ้ำไม่สำเร็จ: ${error.message}`)
  return !!data?.length
}

/* ------------------------------------------------------------------ */
export const getInviteLinks = async (activeOnly = false): Promise<InviteLink[]> => {
  let q = sb().from('invite_links').select('*').order('created_at', { ascending: false })
  if (activeOnly) q = q.eq('is_active', true)

  const { data, error } = await q
  if (error) throw new Error(`ดึงลิงก์เชิญไม่สำเร็จ: ${error.message}`)
  return (data ?? []).map(toLink)
}

export const getInviteLink = async (linkId: string): Promise<InviteLink | null> => {
  const { data, error } = await sb()
    .from('invite_links')
    .select('*')
    .eq('id', linkId)
    .maybeSingle()

  if (error) throw new Error(`ดึงลิงก์เชิญไม่สำเร็จ: ${error.message}`)
  return data ? toLink(data) : null
}

export const getInviteLinkByCode = async (code: string): Promise<InviteLink | null> => {
  const { data, error } = await sb()
    .from('invite_links')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new Error(`ดึงลิงก์เชิญไม่สำเร็จ: ${error.message}`)
  return data ? toLink(data) : null
}

/* ------------------------------------------------------------------ */
export const createInviteLink = async (
  data: CreateInviteLinkData,
  createdBy: string,
  createdByName?: string
): Promise<string> => {
  const client = sb()

  // ลองสูงสุด 5 ครั้ง — ชนกันเองก็ให้ unique constraint ตัดสิน ไม่ใช่ query เช็คก่อน
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = (data.code || generateInviteCode()).toUpperCase()

    const { data: row, error } = await client
      .from('invite_links')
      .insert({
        code,
        created_by: createdBy,
        created_by_name: createdByName ?? '',
        default_role: data.defaultRole,
        default_location_ids: data.defaultLocationIds ?? [],
        allow_checkin_outside_location: data.allowCheckInOutsideLocation ?? false,
        require_approval: data.requireApproval !== false,
        max_uses: data.maxUses ?? null,
        used_count: 0,
        expires_at: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
        note: data.note ?? '',
        is_active: true,
      })
      .select('id')
      .single()

    if (!error) return row.id

    // รหัสซ้ำ — ถ้าผู้ใช้กำหนดเองก็บอกไปตรง ๆ ถ้าสุ่มมาก็สุ่มใหม่
    if (error.code === '23505') {
      if (data.code) throw new Error('รหัสนี้ถูกใช้ไปแล้ว')
      continue
    }
    throw new Error(`สร้างลิงก์เชิญไม่สำเร็จ: ${error.message}`)
  }

  throw new Error('สุ่มรหัสไม่ซ้ำไม่ได้ ลองใหม่อีกครั้ง')
}

/* ------------------------------------------------------------------ */
export const updateInviteLink = async (
  linkId: string,
  data: UpdateInviteLinkData
): Promise<void> => {
  const patch: Database['public']['Tables']['invite_links']['Update'] = {}

  if (data.isActive !== undefined) patch.is_active = data.isActive
  if (data.maxUses !== undefined) patch.max_uses = data.maxUses
  if (data.note !== undefined) patch.note = data.note
  if (data.expiresAt !== undefined) {
    patch.expires_at = data.expiresAt ? new Date(data.expiresAt).toISOString() : null
  }

  if (!Object.keys(patch).length) return

  const { error } = await sb().from('invite_links').update(patch).eq('id', linkId)
  if (error) throw new Error(`แก้ไขลิงก์เชิญไม่สำเร็จ: ${error.message}`)
}

/** ปิดใช้งาน — ไม่ลบจริง เพราะพนักงานที่สมัครมาแล้วยังอ้าง invite_link_id อยู่ */
export const deleteInviteLink = async (linkId: string): Promise<void> => {
  const { error } = await sb()
    .from('invite_links')
    .update({ is_active: false })
    .eq('id', linkId)

  if (error) throw new Error(`ปิดลิงก์เชิญไม่สำเร็จ: ${error.message}`)
}

/**
 * นับว่าใช้ไปแล้ว 1 ครั้ง
 *
 * ⚠️ ฝั่งเบราว์เซอร์ใช้ตัวนี้ไม่ได้ (RLS ให้เฉพาะ HR เขียน) — ตอนสมัครจริง
 *    ต้องผ่าน /api/auth/register ที่เรียก consume_invite_link ด้วยสิทธิ์ server
 *    ตัวนี้เหลือไว้ให้หน้า HR กดนับเองในกรณีพิเศษ
 */
export const useInviteLink = async (linkId: string): Promise<void> => {
  const client = sb()

  const { data: current } = await client
    .from('invite_links')
    .select('used_count')
    .eq('id', linkId)
    .single()

  const { error } = await client
    .from('invite_links')
    .update({ used_count: (current?.used_count ?? 0) + 1 })
    .eq('id', linkId)

  if (error) throw new Error(`นับการใช้งานไม่สำเร็จ: ${error.message}`)
}

/* ------------------------------------------------------------------ */
export const validateInviteLink = async (
  code: string
): Promise<{ valid: boolean; link?: InviteLink; error?: string }> => {
  try {
    const link = await getInviteLinkByCode(code)
    if (!link) return { valid: false, error: 'ลิงก์ไม่ถูกต้องหรือถูกปิดใช้งานแล้ว' }

    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return { valid: false, error: 'ลิงก์หมดอายุแล้ว' }
    }
    if (link.maxUses && link.usedCount >= link.maxUses) {
      return { valid: false, error: 'ลิงก์ถูกใช้งานครบจำนวนแล้ว' }
    }

    return { valid: true, link }
  } catch (error) {
    console.error('ตรวจสอบลิงก์เชิญไม่สำเร็จ:', error)
    return { valid: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบลิงก์' }
  }
}

/* ------------------------------------------------------------------ */
export const getInviteLinkStats = async (linkId: string) => {
  const link = await getInviteLink(linkId)
  if (!link) return null

  const { data, error } = await sb()
    .from('users')
    .select('id, full_name, line_display_name, is_active, needs_approval, created_at')
    .eq('invite_link_id', linkId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`ดึงสถิติลิงก์เชิญไม่สำเร็จ: ${error.message}`)

  const users = data ?? []
  return {
    link,
    totalUses: link.usedCount,
    activeUsers: users.filter((u) => u.is_active).length,
    pendingUsers: users.filter((u) => u.needs_approval).length,
    users,
  }
}
