// lib/services/user/mutations.ts
//
// แก้ไขข้อมูลพนักงาน
//
// ── ต่างจากของเดิมตรงไหน ──────────────────────────────────────────────
// 1. สาขาที่เช็คอินได้ย้ายจาก array ในเอกสาร → ตาราง user_allowed_locations
//    (ทำให้ query "ใครเช็คอินสาขานี้ได้บ้าง" ได้จริง)
// 2. เปลี่ยน role ไม่ต้องเรียก /api/users/update-claims เองแล้ว
//    trigger users_sync_role_claim มิเรอร์ลง app_metadata ให้อัตโนมัติ
//    (ของเดิมต้องจำเรียก และหน้าแก้หลายคนพร้อมกันก็ลืมเรียก)
// 3. ลบพนักงานเป็น soft delete เสมอ — ประวัติเช็คอิน/ใบลาอ้างถึงอยู่
//    ลบจริงฐานข้อมูลจะปฏิเสธเอง (foreign key)

import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types/user'
import type { Database } from '@/types/database'

type UserUpdate = Database['public']['Tables']['users']['Update']

const sb = () => createClient()

/** camelCase จากหน้าจอ → ชื่อคอลัมน์จริง */
function toColumns(data: Partial<User> & Record<string, unknown>): UserUpdate {
  const patch: UserUpdate = {}
  const set = <K extends keyof UserUpdate>(k: K, v: UserUpdate[K] | undefined) => {
    if (v !== undefined) patch[k] = v
  }

  set('full_name', data.fullName)
  // ล้างชื่อเล่นให้ว่างได้ด้วย จึงต้องแยกจาก set() ที่มองว่า '' คือค่าที่ใช้ได้
  if (data.nickname !== undefined) {
    patch.nickname = (data.nickname as string).trim() || null
  }
  set('phone', data.phone as string | undefined)

  // แก้ชื่อ = มีคนดูแล้วว่าถูก จึงถือว่ายืนยันแล้ว
  // (ค่าที่ส่งมาตรง ๆ ชนะ เผื่อหน้าจอไหนอยากตั้งเอง)
  set('name_verified', (data.nameVerified as boolean | undefined) ?? (data.fullName !== undefined ? true : undefined))

  set('line_display_name', data.lineDisplayName)
  set('line_picture_url', data.linePictureUrl)
  set('discord_user_id', data.discordUserId ?? undefined)
  set('discord_username', data.discordUsername ?? undefined)
  set('role', data.role)
  set('is_active', data.isActive)
  set('needs_approval', data.needsApproval)
  set('allow_checkin_outside_location', data.allowCheckInOutsideLocation)
  set('invite_link_id', data.inviteLinkId)
  set('invite_link_code', data.inviteLinkCode)

  // allowWorkFromHome กับ wfhEligible คือคอลัมน์เดียวกัน แล้วแต่หน้าจอไหนส่งมา
  const wfh = (data.allowWorkFromHome ?? data.wfhEligible) as boolean | undefined
  set('wfh_eligible', wfh)
  // null = กลับไปตามตำแหน่ง — ต้องเขียน null ลงจริง ไม่ใช่ข้าม
  set('ot_eligible', data.otEligible as boolean | null | undefined)

  // ช่องข้อความที่ล้างว่างได้ — '' เก็บเป็น null
  if (data.nationalId !== undefined) patch.national_id = (data.nationalId as string | null)?.trim() || null
  if (data.address !== undefined) patch.address = (data.address as string | null)?.trim() || null

  if (data.birthDate !== undefined) {
    patch.birth_date =
      data.birthDate instanceof Date
        ? data.birthDate.toISOString().slice(0, 10)
        : ((data.birthDate as string) || null)
  }

  // ฟิลด์ที่ไม่มีในสมัย Firestore — หน้าแก้หลายคนพร้อมกันส่งมา
  set('employment_status', data.employmentStatus as string | undefined)
  set('employment_type', data.employmentType as string | undefined)
  set('company_id', data.companyId as string | undefined)
  set('job_function_id', data.jobFunctionId as string | undefined)
  set('primary_location_id', data.primaryLocationId as string | undefined)
  set('days_per_week', data.daysPerWeek as number | undefined)
  set('payroll_cycle', data.payrollCycle as string | undefined)
  set('requires_checkin', data.requiresCheckin as boolean | undefined)
  set('start_date', data.startDate as string | undefined)
  // กรอกมือ = ยืนยันแล้ว (ค่าเริ่มต้นของคนสมัครใหม่คือวันสมัคร ซึ่งไม่ใช่วันเริ่มงานจริง)
  set('start_date_verified', data.startDateVerified as boolean | undefined)
  set('end_date', data.endDate as string | undefined)
  set('probation_end_date', (data.probationEndDate as string | null | undefined) ?? undefined)
  set('end_reason', data.endReason as string | undefined)

  return patch
}

/* ------------------------------------------------------------------ */
export async function updateUser(
  userId: string,
  data: Partial<User> & Record<string, unknown>
): Promise<void> {
  const patch = toColumns(data)

  if (Object.keys(patch).length) {
    const { error } = await sb().from('users').update(patch).eq('id', userId)
    if (error) throw new Error(`บันทึกข้อมูลพนักงานไม่สำเร็จ: ${error.message}`)
  }

  if (data.allowedLocationIds !== undefined) {
    await updateUserLocations(userId, data.allowedLocationIds ?? [])
  }
}

/* ------------------------------------------------------------------ */
export async function approveUser(userId: string, approvedBy: string): Promise<void> {
  const { error } = await sb()
    .from('users')
    .update({
      is_active: true,
      needs_approval: false,
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) throw new Error(`อนุมัติพนักงานไม่สำเร็จ: ${error.message}`)
}

/**
 * ให้กลับมาเป็นพนักงานอีกครั้ง — ยกเลิกการสิ้นสุดการเป็นพนักงาน
 *
 * ใช้ตอนกดผิด หรือคนที่ลาออกแล้วกลับมาทำงานใหม่
 * ต้องล้าง end_date ด้วย ไม่งั้น attendance_summary จะตัดรายงานไว้ที่วันนั้น
 * แล้วเช็คอินหลังจากนั้นจะไม่โผล่ในรายงานเลย
 *
 * is_active เปิดให้เองโดย trigger trg_sync_is_active ตาม employment_status
 */
export async function reactivateUser(userId: string): Promise<void> {
  const { error } = await sb()
    .from('users')
    .update({
      employment_status: 'active',
      end_date: null,
      end_reason: null,
    })
    .eq('id', userId)

  if (error) throw new Error(`ให้กลับมาทำงานไม่สำเร็จ: ${error.message}`)
}

export async function deactivateUser(userId: string): Promise<void> {
  const { error } = await sb().from('users').update({ is_active: false }).eq('id', userId)
  if (error) throw new Error(`ระงับการใช้งานไม่สำเร็จ: ${error.message}`)
}

/* ------------------------------------------------------------------ *
 *  เปลี่ยนสิทธิ์
 *
 *  trigger มิเรอร์ลง app_metadata ให้แล้ว แต่ JWT ที่ออกไปก่อนหน้ายังถือค่าเดิม
 *  จนกว่าจะ refresh — คนที่กำลังเปิดเว็บอยู่ต้องรอ หรือออกแล้วเข้าใหม่
 * ------------------------------------------------------------------ */
export async function updateUserRole(userId: string, role: string): Promise<void> {
  const { error } = await sb().from('users').update({ role }).eq('id', userId)
  if (error) throw new Error(`เปลี่ยนสิทธิ์ไม่สำเร็จ: ${error.message}`)
}

/** ชื่อเดิมที่หน้าจอเรียก — ตอนนี้ทำอย่างเดียวกันเพราะ claim ตามเองแล้ว */
export const updateUserRoleWithClaims = updateUserRole

/** ของเดิมยิง API ไปอัปเดต custom claims บน Firebase — ฐานข้อมูลทำให้แล้ว */
export async function refreshUserClaims(_userId: string): Promise<void> {
  // เก็บฟังก์ชันไว้ให้ผู้เรียกเดิมไม่พัง — ไม่ต้องทำอะไร
}

/* ------------------------------------------------------------------ *
 *  สาขาที่เช็คอินได้
 * ------------------------------------------------------------------ */
export async function updateUserLocations(
  userId: string,
  locationIds: string[]
): Promise<void> {
  const client = sb()

  const { error: delErr } = await client
    .from('user_allowed_locations')
    .delete()
    .eq('user_id', userId)
  if (delErr) throw new Error(`ล้างสาขาเดิมไม่สำเร็จ: ${delErr.message}`)

  if (!locationIds.length) return

  const { error } = await client
    .from('user_allowed_locations')
    .insert(locationIds.map((location_id) => ({ user_id: userId, location_id })))

  if (error) throw new Error(`บันทึกสาขาไม่สำเร็จ: ${error.message}`)
}

/* ------------------------------------------------------------------ *
 *  ลบ
 * ------------------------------------------------------------------ */
export async function softDeleteUser(userId: string): Promise<void> {
  const { error } = await sb()
    .from('users')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw new Error(`ลบพนักงานไม่สำเร็จ: ${error.message}`)
}

export async function restoreUser(userId: string): Promise<void> {
  const { error } = await sb()
    .from('users')
    .update({ is_active: true, deleted_at: null })
    .eq('id', userId)

  if (error) throw new Error(`กู้คืนพนักงานไม่สำเร็จ: ${error.message}`)
}

/**
 * ลบถาวร
 *
 * ⚠️ ต้องทำฝั่ง server เพราะต้องลบบัญชีใน auth ด้วย ซึ่ง client ทำไม่ได้
 *    ถ้ามีประวัติเช็คอิน/ใบลาอ้างถึง ฐานข้อมูลจะปฏิเสธ — ใช้ softDeleteUser แทน
 */
export async function deleteUser(userId: string): Promise<void> {
  const res = await fetch('/api/users/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'ลบพนักงานไม่สำเร็จ')
  }
}
