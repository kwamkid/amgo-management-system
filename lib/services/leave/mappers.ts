// lib/services/leave/mappers.ts
//
// แปลงแถว Postgres (snake_case, long format) → รูปแบบที่หน้าจอเดิมใช้
// (camelCase, โควต้าซ้อนเป็น 3 ก้อน) — หน้าจอจึงไม่ต้องแก้ตอนย้ายฐานข้อมูล

import type { LeaveRequest, LeaveQuotaYear, LeaveType, LeaveStatus } from '@/types/leave'
import type { Database } from '@/types/database'

export type LeaveRequestRow = Database['public']['Tables']['leave_requests']['Row']
export type LeaveQuotaRow = Database['public']['Tables']['leave_quotas']['Row']

export const LEAVE_TYPES: LeaveType[] = ['sick', 'personal', 'vacation']

export function toLeaveRequest(r: LeaveRequestRow): LeaveRequest {
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    userEmail: r.user_email || undefined,
    userAvatar: r.user_avatar || undefined,

    type: r.leave_type as LeaveType,
    status: r.status as LeaveStatus,

    startDate: new Date(r.start_date),
    endDate: new Date(r.end_date),
    totalDays: Number(r.total_days),
    urgentMultiplier: Number(r.urgent_multiplier),

    reason: r.reason,
    attachments: r.attachments ?? [],

    approvedBy: r.approved_by ?? undefined,
    approvedAt: r.approved_at ? new Date(r.approved_at) : undefined,
    rejectedReason: r.rejected_reason ?? undefined,

    cancelledBy: r.cancelled_by ?? undefined,
    cancelledAt: r.cancelled_at ? new Date(r.cancelled_at) : undefined,
    cancelReason: r.cancel_reason ?? undefined,

    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

/**
 * รวม 3 แถว (sick/personal/vacation) เป็นก้อนเดียวแบบที่หน้าจอเดิมคาดหวัง
 *
 * ประเภทไหนไม่มีแถว = ยังไม่ตั้งโควต้า → คืน 0 ไม่ใช่ throw
 * remaining ไม่ได้คำนวณเอง — Postgres เก็บเป็น generated column (total - used)
 * จึงไม่มีทางเพี้ยนเหมือนของเดิมที่ให้โค้ดคอยบวกลบ
 */
export function toQuotaYear(
  userId: string,
  year: number,
  rows: LeaveQuotaRow[]
): LeaveQuotaYear {
  const pick = (type: LeaveType) => {
    const row = rows.find((r) => r.leave_type === type)
    return {
      total: Number(row?.total_days ?? 0),
      used: Number(row?.used_days ?? 0),
      remaining: Number(row?.remaining_days ?? 0),
    }
  }

  const latest = rows
    .map((r) => r.updated_at)
    .sort()
    .at(-1)

  return {
    userId,
    year,
    sick: pick('sick'),
    personal: pick('personal'),
    vacation: pick('vacation'),
    updatedBy: rows.find((r) => r.updated_by)?.updated_by ?? 'system',
    updatedAt: latest ? new Date(latest) : new Date(),
    // ประวัติอยู่คนละตารางแล้ว (leave_quota_history) — ดึงแยกด้วย getQuotaHistory()
    // ของเดิมฝังมาในเอกสารเดียวกันทำให้โหลดหน้าโควต้าลากมาทั้งกอง
    history: [],
  }
}
