// lib/services/bot/botHr.ts
//
// HR สำหรับ API บอท (เจ้าของขอผ่าน session AGD 28 ต.ค. 69) — service role จึงตรวจสิทธิ์เอง:
//   superadmin (Jarvis) : ดู/จัดการของทุกคน — สิทธิ์เท่าแอดมินบนเว็บ
//   general    (Edith)  : เห็นแค่ของตัวเอง · ยื่น/ถอนใบลาของตัวเองได้ · อนุมัติไม่ได้ (แม้ตำแหน่งจะเป็น HR)
//
// ใบลาเขียนแค่ status แล้ว trigger ทำต่อเหมือนบนเว็บ (lib/services/leave/requests.ts):
//   leave_requests_sync_days → leave_days → used_days ใหม่ · ยกเลิกแล้วโควต้าคืนเอง
// วันที่ลาเก็บเป็นเที่ยงคืนเวลาไทย (ฟอร์มบนเว็บส่ง local midnight มา) — ห้ามเก็บเป็น UTC midnight
// audit_log.changed_by มาจาก auth.uid() ซึ่ง service role ไม่มี → stampAudit เติมชื่อคนทำให้

import { LEAVE_RULES, LEAVE_TYPE_LABELS, type LeaveType } from '@/types/leave'
import { bangkokDayKey } from '@/lib/services/workingHoursService'
import { buildMessage, recipientsOf, type PushEventInput } from '@/lib/push/events'
import { sendPushToUsers, userIdsByRole } from '@/lib/push/send'
import { personName, type AdminDb, type BotCaller, type BotPerson } from './botApi'
import { isYmd } from './botTasks'

export const LEAVE_TYPES = Object.keys(LEAVE_RULES) as LeaveType[]
export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const
export type LeaveStatus = (typeof LEAVE_STATUSES)[number]

/** ช่วงวันที่ยาวสุดที่ดูเช็คอินได้ต่อครั้ง */
export const MAX_RANGE_DAYS = 62

/** 'YYYY-MM-DD' → เที่ยงคืนเวลาไทย (รูปแบบเดียวกับที่ฟอร์มบนเว็บเก็บ) */
export const bkkMidnight = (ymd: string) => `${ymd}T00:00:00+07:00`

export const dayDiff = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

/** ตรวจ from/to (รวมวันนั้น) — คืนข้อความ error หรือ null */
export function checkRange(from: string, to: string): string | null {
  if (!isYmd(from) || !isYmd(to)) return 'วันที่ต้องเป็น YYYY-MM-DD'
  if (to < from) return 'to ต้องไม่ก่อน from'
  if (dayDiff(from, to) >= MAX_RANGE_DAYS) return `ดูได้ครั้งละไม่เกิน ${MAX_RANGE_DAYS} วัน`
  return null
}

/** เวลาไทย HH:mm จาก timestamp */
export const bkkTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) : null

export const bkkDay = (iso: string) => bangkokDayKey(new Date(iso))

/** general ดูได้แค่ตัวเอง — ขอดูคนอื่นตอบ 403 */
export const canSee = (caller: BotCaller, userId: string) => caller.scope === 'superadmin' || userId === caller.user.id

/** จัดการใบลาของคนอื่นได้ (ดูทั้งหมด · อนุมัติ · ปฏิเสธ) — กติกาเดียวกับหน้า /leaves/management: admin · hr · manager (เจ้าของขอ 30 ต.ค. 69 ให้หน่อย/กอล์ฟอนุมัติผ่าน Edith) */
export const LEAVE_MANAGER_ROLES = ['admin', 'hr', 'manager'] as const
export const canManageLeave = (caller: BotCaller) => caller.scope === 'superadmin' || LEAVE_MANAGER_ROLES.includes(caller.role as (typeof LEAVE_MANAGER_ROLES)[number])

/* ------------------------------------------------------------------ */
/*  ใบลา                                                                */
/* ------------------------------------------------------------------ */

export const LEAVE_COLS =
  'id, user_id, leave_type, status, start_date, end_date, total_days, urgent_multiplier, reason, rejected_reason, ' +
  'cancel_reason, approved_by, approved_at, cancelled_by, cancelled_at, created_at, ' +
  'owner:users!leave_requests_user_id_fkey(id, nickname, full_name, discord_user_id), ' +
  'decider:users!leave_requests_approved_by_fkey(nickname, full_name)'

type NameRow = { nickname: string | null; full_name: string }

export interface LeaveRow {
  id: string
  user_id: string
  leave_type: LeaveType
  status: LeaveStatus
  start_date: string
  end_date: string
  total_days: number
  urgent_multiplier: number
  reason: string | null
  rejected_reason: string | null
  cancel_reason: string | null
  approved_by: string | null
  approved_at: string | null
  cancelled_at: string | null
  created_at: string
  owner: (NameRow & { id: string; discord_user_id: string | null }) | null
  decider: NameRow | null
}

export function toBotLeave(r: LeaveRow) {
  return {
    id: r.id,
    person: r.owner ? { id: r.owner.id, name: personName(r.owner), discordId: r.owner.discord_user_id } : { id: r.user_id },
    type: r.leave_type,
    typeLabel: LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type,
    status: r.status,
    start: bkkDay(r.start_date),
    end: bkkDay(r.end_date),
    days: Number(r.total_days),
    /** โควต้าที่หักจริง (ลาด่วน = เท่า) */
    charged: Number(r.total_days) * Number(r.urgent_multiplier),
    urgent: Number(r.urgent_multiplier) > 1,
    reason: r.reason || null,
    decidedBy: r.decider ? personName(r.decider) : null,
    decidedAt: r.approved_at,
    rejectedReason: r.rejected_reason,
    cancelReason: r.cancel_reason,
    createdAt: r.created_at,
  }
}

export async function getLeaveRow(sb: AdminDb, id: string): Promise<LeaveRow | null> {
  const { data } = await sb.from('leave_requests').select(LEAVE_COLS).eq('id', id).maybeSingle()
  return data as unknown as LeaveRow | null
}

/** โควต้าคงเหลือของประเภทนั้นในปีของวันเริ่มลา — ไม่มีแถว = ยังไม่ได้ตั้งโควต้า */
export async function remainingQuota(sb: AdminDb, userId: string, type: LeaveType, year: number): Promise<number | null> {
  const { data } = await sb
    .from('leave_quotas')
    .select('remaining_days')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('leave_type', type)
    .maybeSingle()
  return data ? Number(data.remaining_days) : null
}

/** ตรวจโควต้าก่อนยื่น/อนุมัติ — คืนข้อความ error หรือ null (สูตรเดียวกับ assertEnoughQuota บนเว็บ) */
export async function quotaError(sb: AdminDb, userId: string, type: LeaveType, startYmd: string, charge: number) {
  const left = await remainingQuota(sb, userId, type, Number(startYmd.slice(0, 4)))
  if (left === null) return 'ไม่พบข้อมูลโควต้าปีนี้ — ให้ HR ตั้งโควต้าก่อน'
  if (left < charge) return `โควต้า${LEAVE_TYPE_LABELS[type]}ไม่พอ (เหลือ ${left} วัน แต่ต้องใช้ ${charge} วัน)`
  return null
}

/**
 * ลาด่วน: แจ้งล่วงหน้าไม่ถึงกำหนด → หักโควต้าเป็นเท่า (ฟอร์มบนเว็บติ๊กให้เองแบบเดียวกัน)
 * ป่วย/วันที่ย้อนหลังที่ประเภทนั้นไม่ยอม → error
 */
export function leaveCharge(type: LeaveType, startYmd: string, today: string, urgent: boolean, allowBackdate: boolean) {
  const rule = LEAVE_RULES[type]
  const ahead = dayDiff(today, startYmd)
  if (ahead < 0 && !rule.allowBackdate && !allowBackdate) return { error: `${LEAVE_TYPE_LABELS[type]}ย้อนหลังไม่ได้` }
  const late = rule.advanceNotice > 0 && ahead < rule.advanceNotice
  const multiplier = urgent || late ? rule.urgentMultiplier : 1
  return { multiplier, autoUrgent: late && !urgent }
}

/** ใบที่ยังมีผล (รอ/อนุมัติ) ซ้อนช่วงวันนี้ไหม */
export async function overlapping(sb: AdminDb, userId: string, startYmd: string, endYmd: string) {
  const { data } = await sb
    .from('leave_requests')
    .select('id, start_date, end_date, status')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved'])
    .lte('start_date', bkkMidnight(endYmd))
    .gte('end_date', bkkMidnight(startYmd))
    .limit(1)
  return data?.[0] ?? null
}

/* ------------------------------------------------------------------ */
/*  ร่องรอย + แจ้งเตือน                                                */
/* ------------------------------------------------------------------ */

/** เติมชื่อคนทำให้แถว audit ที่ trigger เพิ่งเขียน (service role → changed_by ว่าง) */
export async function stampAudit(sb: AdminDb, table: string, recordId: string, actorId: string) {
  await sb
    .from('audit_log')
    .update({ changed_by: actorId })
    .eq('table_name', table)
    .eq('record_id', recordId)
    .is('changed_by', null)
    .gte('changed_at', new Date(Date.now() - 60_000).toISOString())
}

/** push แบบเดียวกับ /api/push/notify — คนทำเรื่องเองไม่ได้รับ · พลาดไม่ทำให้คำขอล้ม */
export async function pushLeaveEvent(actor: BotPerson, input: Omit<PushEventInput, 'actorName'>) {
  try {
    const full: PushEventInput = { ...input, actorName: actor.name }
    const to = recipientsOf(full)
    if (!to) return
    const ids = ('userIds' in to ? to.userIds : await userIdsByRole(to.roles)).filter((id) => id !== actor.id)
    await sendPushToUsers(ids, buildMessage(full))
  } catch (e) {
    console.error('[bot] push ใบลาไม่สำเร็จ:', e)
  }
}
