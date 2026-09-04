// lib/services/scheduleSwapService.ts
//
// ใบสลับวันหยุด — "วันหยุดวันนี้ขอมาทำงาน แล้วไปหยุดวันอื่นแทน"
//
// ── ทำไมต้องมี (เจ้าของสั่ง 16 ส.ค. 69) ──────────────────────────────
// ของจริงเกิดเดือนละ ~15 ครั้ง ทั้ง PC หน้าร้านและพนักงานทั่วไป แต่ของเดิม
// ไม่มีใบ — รายงานหักลบให้เงียบ ๆ (เช็คอินตรงวันหยุดประจำ = ได้เครดิต 1
// เอาไปล้างวันขาดใบไหนก็ได้) ทำให้ไม่รู้ว่าวันไหนคู่กับวันไหน ไม่มีที่เขียน
// เหตุผล และเครดิตไปกลบวันขาดจริง ๆ ที่ไม่เกี่ยวกันได้
//
// ── กติกาที่เจ้าของเคาะ ──────────────────────────────────────────────
//   · พนักงานยื่นเอง แล้ว HR อนุมัติ (เหมือนใบลา)
//   · ต้องระบุทั้งวันมาทำงานและวันหยุดชดเชยตอนยื่น — ไม่มีเครดิตค้าง
//     (ยื่นย้อนหลังได้ ทำงานวันหยุดไปแล้วค่อยมายื่นก็ได้ ขอแค่รู้ทั้งคู่)
//   · ทั้งสองวันต้องอยู่ในงวดจ่ายเดียวกัน ไม่งั้นวันทำงานกับวันหยุดชดเชย
//     ไปคนละงวด แก้ย้อนหลังไม่ได้เพราะงวดก่อนตัดยอดไปแล้ว
//
// พออนุมัติ trigger ในฐานข้อมูลเขียน schedule_exceptions ให้ 2 แถว
// รายงาน/ตารางวัน/การนับวันขาด จึงไม่ต้องรู้จักใบนี้เลย

import { createClient } from '@/lib/supabase/client'
import type { Db } from '@/lib/supabase/db'
import { format } from 'date-fns'
import { resolveCycle, type CycleCode } from './payrollCycle'
import { checkSwap } from './scheduleSwapRules'
import { pushNotify } from '@/lib/push/notify'

export { checkSwap } from './scheduleSwapRules'
export type { SwapCheckInput } from './scheduleSwapRules'

const sb = () => createClient()

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')

export type SwapStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface ScheduleSwap {
  id: string
  userId: string
  userName: string
  /** วันหยุดประจำที่ขอมาทำงาน */
  workedDate: string
  /** วันทำงานปกติที่ขอไปหยุดแทน */
  offDate: string
  reason: string
  status: SwapStatus
  approvedBy: string | null
  approvedAt: string | null
  rejectedReason: string | null
  createdAt: string
}

interface SwapRow {
  id: string
  user_id: string
  user_name: string | null
  worked_date: string
  off_date: string
  reason: string | null
  status: string
  approved_by: string | null
  approved_at: string | null
  rejected_reason: string | null
  created_at: string
}

const toSwap = (r: SwapRow): ScheduleSwap => ({
  id: r.id,
  userId: r.user_id,
  userName: r.user_name ?? '',
  workedDate: r.worked_date,
  offDate: r.off_date,
  reason: r.reason ?? '',
  status: r.status as SwapStatus,
  approvedBy: r.approved_by,
  approvedAt: r.approved_at,
  rejectedReason: r.rejected_reason,
  createdAt: r.created_at,
})

/* ------------------------------------------------------------------ */
/** รอบจ่ายของคนนี้ — ต้องรู้ก่อนถึงจะตรวจเรื่องงวดได้ */
export async function getUserCycle(userId: string, db?: Db): Promise<CycleCode> {
  const { data } = await (db ?? sb())
    .from('users')
    .select('payroll_cycle, job_functions(payroll_cycle)')
    .eq('id', userId)
    .single()

  const jfRaw = data?.job_functions
  const jf = (Array.isArray(jfRaw) ? jfRaw[0] : jfRaw) as { payroll_cycle: string | null } | null
  return resolveCycle(data?.payroll_cycle, jf?.payroll_cycle)
}

/** ตารางบอกว่าวันนั้นควรเป็นอะไรสำหรับคนนี้ */
export async function expectedMode(userId: string, date: Date, db?: Db): Promise<string | null> {
  const { data, error } = await (db ?? sb()).rpc('expected_work_mode', {
    p_user_id: userId,
    p_date: ymd(date),
  })
  if (error) return null
  return (data as string | null) ?? null
}

/** ยื่นใบของวันนั้นไปแล้วหรือยัง — ใช้ตัดสินว่าต้องเด้งถามซ้ำไหม */
export async function hasSwapFor(userId: string, workedDate: Date): Promise<boolean> {
  const { data } = await sb()
    .from('schedule_swaps')
    .select('id')
    .eq('user_id', userId)
    .eq('worked_date', ymd(workedDate))
    .in('status', ['pending', 'approved'])
    .limit(1)
  return (data ?? []).length > 0
}

/* ------------------------------------------------------------------ */
export async function createSwap(params: {
  userId: string
  userName: string
  workedDate: Date
  offDate: Date
  reason: string
}): Promise<string> {
  const cycle = await getUserCycle(params.userId)
  const [workedDateMode, offDateMode] = await Promise.all([
    expectedMode(params.userId, params.workedDate),
    expectedMode(params.userId, params.offDate),
  ])

  const problem = checkSwap({
    cycle,
    workedDate: params.workedDate,
    offDate: params.offDate,
    workedDateMode,
    offDateMode,
  })
  if (problem) throw new Error(problem)

  const { data, error } = await sb()
    .from('schedule_swaps')
    .insert({
      user_id: params.userId,
      user_name: params.userName,
      worked_date: ymd(params.workedDate),
      off_date: ymd(params.offDate),
      reason: params.reason.trim(),
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    // unique index กันใบซ้อนวันเดียวกัน — บอกเป็นภาษาคนแทนข้อความ Postgres
    if (error.code === '23505') {
      throw new Error('มีใบสลับวันหยุดที่ใช้วันนี้อยู่แล้ว — ดูในประวัติของคุณ')
    }
    throw new Error(`ยื่นใบสลับวันหยุดไม่สำเร็จ: ${error.message}`)
  }
  // push ถึงคนอนุมัติ — ยิงแล้วไม่รอ
  pushNotify({ event: 'swap_request', workedDate: ymd(params.workedDate), offDate: ymd(params.offDate) })
  return data.id
}

/* ------------------------------------------------------------------ */
export async function approveSwap(id: string, approvedBy: string): Promise<void> {
  const { data, error } = await sb()
    .from('schedule_swaps')
    .update({ status: 'approved', approved_by: approvedBy, approved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending') // กันกดซ้ำ/กดชนกัน
    .select('user_id, worked_date, off_date')
    .maybeSingle() // ไม่มีแถว = มีคนกดไปก่อนแล้ว → ไม่ต้องแจ้งซ้ำ
  if (error) throw new Error(`อนุมัติไม่สำเร็จ: ${error.message}`)
  if (data) pushNotify({ event: 'swap_approved', targetUserId: data.user_id, workedDate: data.worked_date, offDate: data.off_date })
}

export async function rejectSwap(id: string, approvedBy: string, reason: string): Promise<void> {
  const { data, error } = await sb()
    .from('schedule_swaps')
    .update({
      status: 'rejected',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      rejected_reason: reason.trim(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('user_id, worked_date, off_date')
    .maybeSingle()
  if (error) throw new Error(`ปฏิเสธไม่สำเร็จ: ${error.message}`)
  if (data) pushNotify({ event: 'swap_rejected', targetUserId: data.user_id, workedDate: data.worked_date, offDate: data.off_date, reason: reason.trim() })
}

/** ยกเลิกใบของตัวเอง — อนุมัติไปแล้วก็ยกเลิกได้ trigger จะคืนตารางให้เอง */
export async function cancelSwap(id: string): Promise<void> {
  const { error } = await sb()
    .from('schedule_swaps')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .in('status', ['pending', 'approved'])
  if (error) throw new Error(`ยกเลิกไม่สำเร็จ: ${error.message}`)
}

/* ------------------------------------------------------------------ */
export async function listMySwaps(userId: string): Promise<ScheduleSwap[]> {
  const { data, error } = await sb()
    .from('schedule_swaps')
    .select('*')
    .eq('user_id', userId)
    .order('worked_date', { ascending: false })
  if (error) throw new Error(`ดึงใบสลับวันหยุดไม่สำเร็จ: ${error.message}`)
  return (data ?? []).map((r) => toSwap(r as SwapRow))
}

export async function listSwaps(status?: SwapStatus): Promise<ScheduleSwap[]> {
  let q = sb().from('schedule_swaps').select('*').order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw new Error(`ดึงใบสลับวันหยุดไม่สำเร็จ: ${error.message}`)

  const swaps = (data ?? []).map((r) => toSwap(r as SwapRow))
  // ชื่อ snapshot ตอนยื่น ทับด้วย "ชื่อจริง (ชื่อเล่น)" ปัจจุบันตามกติกาชื่อเล่นทุกที่
  const { getDisplayNames } = await import('./user/queries')
  const names = await getDisplayNames(swaps.map((s) => s.userId))
  return swaps.map((s) => ({ ...s, userName: names.get(s.userId) || s.userName }))
}

/**
 * คนที่มาเช็คอินตรงวันหยุดประจำแต่ยังไม่มีใบสลับ — ของเดิมรายงานหักลบให้เงียบ ๆ
 * ตอนนี้เอาขึ้นมาให้เห็นว่ามีใครค้างบ้าง จะได้ตามให้ยื่นใบ
 */
export async function listUnfiledSwapDays(from: Date, to: Date): Promise<
  { userId: string; userName: string; workDate: string }[]
> {
  const client = sb()
  const [checkins, offDays, swaps] = await Promise.all([
    client
      .from('checkins')
      .select('user_id, user_name, work_date, total_hours')
      .gte('work_date', ymd(from))
      .lte('work_date', ymd(to))
      .gt('total_hours', 0),
    client.from('user_work_schedules').select('user_id, day_of_week').eq('work_mode', 'off'),
    client.from('schedule_swaps').select('user_id, worked_date').in('status', ['pending', 'approved']),
  ])

  const offSet = new Set((offDays.data ?? []).map((o) => `${o.user_id}|${o.day_of_week}`))
  const filed = new Set((swaps.data ?? []).map((s) => `${s.user_id}|${s.worked_date}`))

  const seen = new Set<string>()
  const out: { userId: string; userName: string; workDate: string }[] = []
  for (const c of checkins.data ?? []) {
    const dow = new Date(`${c.work_date}T00:00:00`).getDay()
    if (!offSet.has(`${c.user_id}|${dow}`)) continue
    if (filed.has(`${c.user_id}|${c.work_date}`)) continue
    const key = `${c.user_id}|${c.work_date}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ userId: c.user_id, userName: c.user_name ?? '', workDate: c.work_date })
  }

  const { getDisplayNames } = await import('./user/queries')
  const names = await getDisplayNames(out.map((o) => o.userId))
  return out.map((o) => ({ ...o, userName: names.get(o.userId) || o.userName }))
}
