// lib/services/leave/requests.ts
//
// ใบลา — ยื่น / ดู / อนุมัติ / ปฏิเสธ / ยกเลิก
//
// ── ต่างจากของเดิมตรงไหน ──────────────────────────────────────────────
// ของเดิมตอนอนุมัติต้อง writeBatch 3 อย่างพร้อมกัน: อัปเดตใบลา · หัก used
// · ต่อท้าย history — ถ้าพลาดขั้นไหนโควต้าเพี้ยนถาวร
//
// ตอนนี้อัปเดตแค่ status อย่างเดียว แล้ว trigger ในฐานข้อมูลจัดการต่อ:
//   leave_requests_sync_days → แตกเป็น leave_days รายวัน
//   leave_days_recalc        → คิด used_days ใหม่จากของจริง
//   checkins_refund_leave    → มาทำงานวันที่ลา คืนโควต้าให้เอง
// ยกเลิกก็เช่นกัน — ลบ leave_days แล้วโควต้าคืนเองโดยไม่ต้องเขียนโค้ดคืน

import { createClient } from '@/lib/supabase/client'
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/types/leave'
import { toLeaveRequest, type LeaveRequestRow } from './mappers'
import { getQuotaForYear } from './quota'

const sb = () => createClient()

/** โควต้าที่ใบลาใบนี้จะกิน (ลาด่วนคิดเป็นเท่า) */
const daysCharged = (totalDays: number, multiplier: number) => totalDays * multiplier

async function assertEnoughQuota(
  userId: string,
  type: LeaveType,
  startDate: Date,
  charge: number
): Promise<void> {
  const quota = await getQuotaForYear(userId, startDate.getFullYear())
  if (!quota) throw new Error('ไม่พบข้อมูลโควต้า')

  if (quota[type].remaining < charge) {
    throw new Error(
      `โควต้าไม่เพียงพอ (เหลือ ${quota[type].remaining} วัน แต่ต้องใช้ ${charge} วัน)`
    )
  }
}

/* ------------------------------------------------------------------ */
export async function createLeaveRequest(
  request: Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const start = new Date(request.startDate)
  const charge = daysCharged(request.totalDays, request.urgentMultiplier)

  await assertEnoughQuota(request.userId, request.type, start, charge)

  const { data, error } = await sb()
    .from('leave_requests')
    .insert({
      user_id: request.userId,
      leave_type: request.type,
      status: 'pending', // RLS บังคับอยู่แล้ว — ยื่นเองอนุมัติเองไม่ได้
      start_date: start.toISOString(),
      end_date: new Date(request.endDate).toISOString(),
      total_days: request.totalDays,
      urgent_multiplier: request.urgentMultiplier,
      reason: request.reason ?? '',
      attachments: request.attachments ?? [],
      user_name: request.userName ?? '',
      user_avatar: request.userAvatar ?? '',
      user_email: request.userEmail ?? '',
    })
    .select('id')
    .single()

  if (error) throw new Error(`ส่งคำขอลาไม่สำเร็จ: ${error.message}`)
  return data.id
}

/* ------------------------------------------------------------------ *
 *  รายการใบลา
 *
 *  ของเดิมสองหน้า (requests · management) ยิง Firestore ตรง ๆ เอง
 *  ทำให้ตัวกรองไม่เหมือนกัน — รวมมาไว้ที่เดียว
 * ------------------------------------------------------------------ */
export async function getLeaveRequests(
  filters?: {
    userId?: string
    managerId?: string
    status?: LeaveStatus
    type?: LeaveType
    startDate?: Date
    endDate?: Date
  },
  limit = 500
): Promise<LeaveRequest[]> {
  let q = sb()
    .from('leave_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filters?.userId) q = q.eq('user_id', filters.userId)
  if (filters?.status) q = q.eq('status', filters.status)
  if (filters?.type) q = q.eq('leave_type', filters.type)
  // ทับช่วงกัน ไม่ใช่อยู่ในช่วง — ใบลาคร่อมเดือนต้องขึ้นในรายงานทั้งสองเดือน
  if (filters?.endDate) q = q.lte('start_date', new Date(filters.endDate).toISOString())
  if (filters?.startDate) q = q.gte('end_date', new Date(filters.startDate).toISOString())

  // managerId: ตารางไม่มีคอลัมน์นี้ (สายบังคับบัญชาอยู่ที่ user_settings)
  // รับพารามิเตอร์ไว้ให้ผู้เรียกเดิมไม่พัง แต่ไม่ได้ใช้กรอง

  const { data, error } = await q
  if (error) throw new Error(`ดึงรายการลาไม่สำเร็จ: ${error.message}`)

  // ทับ userName (snapshot ชื่อจริงตอนยื่นใบลา) ด้วย "ชื่อจริง (ชื่อเล่น)" ปัจจุบัน
  const requests = ((data ?? []) as LeaveRequestRow[]).map(toLeaveRequest)
  const { getDisplayNames } = await import('../user/queries')
  const names = await getDisplayNames(requests.map((r) => r.userId))
  return requests.map((r) => ({ ...r, userName: names.get(r.userId) || r.userName }))
}

/** ใบลาใบเดียว */
export async function getLeaveRequest(leaveId: string): Promise<LeaveRequest | null> {
  const { data, error } = await sb()
    .from('leave_requests')
    .select('*')
    .eq('id', leaveId)
    .maybeSingle()

  if (error) throw new Error(`ดึงใบลาไม่สำเร็จ: ${error.message}`)
  return data ? toLeaveRequest(data as LeaveRequestRow) : null
}

/* ------------------------------------------------------------------ */
export async function approveLeaveRequest(
  leaveId: string,
  approvedBy: string
): Promise<void> {
  const leave = await getLeaveRequest(leaveId)
  if (!leave) throw new Error('ไม่พบคำขอลา')
  if (leave.status !== 'pending') throw new Error('คำขอลานี้ได้รับการดำเนินการแล้ว')

  await assertEnoughQuota(
    leave.userId,
    leave.type,
    leave.startDate,
    daysCharged(leave.totalDays, leave.urgentMultiplier)
  )

  const { error } = await sb()
    .from('leave_requests')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('id', leaveId)
    .eq('status', 'pending') // กันสองคนกดอนุมัติพร้อมกัน

  if (error) throw new Error(`อนุมัติไม่สำเร็จ: ${error.message}`)
}

/* ------------------------------------------------------------------ */
export async function rejectLeaveRequest(
  leaveId: string,
  rejectedBy: string,
  reason: string
): Promise<void> {
  const { error } = await sb()
    .from('leave_requests')
    .update({
      status: 'rejected',
      approved_by: rejectedBy, // คนที่ตัดสิน ไม่ว่าผลจะเป็นอนุมัติหรือไม่
      approved_at: new Date().toISOString(),
      rejected_reason: reason,
    })
    .eq('id', leaveId)
    .eq('status', 'pending')

  if (error) throw new Error(`ปฏิเสธไม่สำเร็จ: ${error.message}`)
}

/* ------------------------------------------------------------------ *
 *  พนักงานถอนใบลาของตัวเอง — ได้เฉพาะที่ยังไม่อนุมัติ (RLS บังคับซ้ำอีกชั้น)
 * ------------------------------------------------------------------ */
export async function cancelLeaveRequest(
  leaveId: string,
  cancelledBy: string,
  cancelReason?: string
): Promise<void> {
  const { data, error } = await sb()
    .from('leave_requests')
    .update({
      status: 'cancelled',
      cancelled_by: cancelledBy,
      cancelled_at: new Date().toISOString(),
      cancel_reason: cancelReason || 'ยกเลิกโดยผู้ใช้',
    })
    .eq('id', leaveId)
    .eq('status', 'pending')
    .select('id')

  if (error) throw new Error(`ยกเลิกไม่สำเร็จ: ${error.message}`)
  if (!data?.length) {
    throw new Error('ไม่สามารถยกเลิกคำขอที่อนุมัติแล้วหรือถูกปฏิเสธแล้ว')
  }
}

/* ------------------------------------------------------------------ *
 *  HR ยกเลิกใบที่อนุมัติไปแล้ว
 *
 *  ของเดิมต้องคำนวณ used ใหม่แล้วเขียนคืนเอง พร้อมต่อท้าย history
 *  ตอนนี้แค่เปลี่ยนสถานะ — trigger ลบ leave_days แล้วโควต้าคืนเอง
 *  ส่วนร่องรอยว่าใครทำอะไรอยู่ใน audit_log อยู่แล้ว (trg_audit)
 * ------------------------------------------------------------------ */
export async function cancelApprovedLeaveRequest(
  leaveId: string,
  cancelledBy: string,
  cancelReason: string
): Promise<void> {
  const { data, error } = await sb()
    .from('leave_requests')
    .update({
      status: 'cancelled',
      cancelled_by: cancelledBy,
      cancelled_at: new Date().toISOString(),
      cancel_reason: cancelReason,
    })
    .eq('id', leaveId)
    .eq('status', 'approved')
    .select('id')

  if (error) throw new Error(`ยกเลิกไม่สำเร็จ: ${error.message}`)
  if (!data?.length) throw new Error('สามารถยกเลิกได้เฉพาะคำขอที่อนุมัติแล้วเท่านั้น')
}
