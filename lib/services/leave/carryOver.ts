// lib/services/leave/carryOver.ts
//
// ยกยอดวันลาคงเหลือข้ามปี
//
// ── ต่างจากของเดิมตรงไหน ──────────────────────────────────────────────
// ของเดิมเก็บผลการยกยอดทั้งรอบเป็นเอกสารเดียวใน carryOverLogs
// (results เป็น array ของพนักงานทุกคน) → หาคำตอบว่า "คนนี้เคยได้ยกยอดกี่วัน"
// ต้องโหลดทั้งก้อนมาไล่ในโค้ด
//
// ตารางใหม่เก็บรายคน-รายประเภท (user_id, from_year, to_year, leave_type, days_carried)
// ค้นย้อนหลังรายคนได้ ส่วนสรุปทั้งรอบก็ยังประกอบกลับได้จากเวลาที่ทำ

import { createClient } from '@/lib/supabase/client'
import type {
  CarryOverRules,
  CarryOverResult,
  CarryOverSummary,
  LeaveType,
} from '@/types/leave'
import { LEAVE_TYPES } from './mappers'
import { carryOverDaysFor } from './rules'
import { seedQuota } from './quota'

const sb = () => createClient()

/* ------------------------------------------------------------------ *
 *  ยกยอดให้คนเดียว
 * ------------------------------------------------------------------ */
export async function carryOverQuotaForUser(
  userId: string,
  userName: string,
  fromYear: number,
  toYear: number,
  rules: CarryOverRules,
  executedBy: string,
  baseQuota?: { sick: number; personal: number; vacation: number }
): Promise<CarryOverResult> {
  const blank = { remaining: 0, carriedOver: 0 }
  const fail = (error: string): CarryOverResult => ({
    userId,
    userName,
    fromYear,
    toYear,
    sick: blank,
    personal: blank,
    vacation: blank,
    success: false,
    error,
  })

  try {
    const client = sb()

    const { data: oldRows, error: oldErr } = await client
      .from('leave_quotas')
      .select('leave_type, remaining_days')
      .eq('user_id', userId)
      .eq('year', fromYear)

    if (oldErr) return fail(oldErr.message)
    if (!oldRows?.length) return fail('ไม่พบโควต้าปีเดิม')

    // ปีปลายทางต้องมีแถวก่อน ไม่งั้นไม่รู้จะบวกยอดยกมาใส่อะไร
    await seedQuota(userId, toYear)

    const { data: newRows, error: newErr } = await client
      .from('leave_quotas')
      .select('leave_type, total_days')
      .eq('user_id', userId)
      .eq('year', toYear)

    if (newErr) return fail(newErr.message)

    const carried: Record<LeaveType, { remaining: number; carriedOver: number }> = {
      sick: { ...blank },
      personal: { ...blank },
      vacation: { ...blank },
    }

    const upserts: Record<string, unknown>[] = []
    const logs: Record<string, unknown>[] = []
    const changes: Record<string, { from: number; to: number }> = {}

    for (const type of LEAVE_TYPES) {
      const remaining = Number(
        oldRows.find((r) => r.leave_type === type)?.remaining_days ?? 0
      )
      const days = carryOverDaysFor(remaining, rules[type])
      carried[type] = { remaining, carriedOver: days }

      if (days <= 0) continue

      // baseQuota ที่ผู้เรียกส่งมาชนะค่าตั้งต้นของปีนั้น
      const base =
        baseQuota?.[type] ??
        Number(newRows?.find((r) => r.leave_type === type)?.total_days ?? 0)

      upserts.push({
        user_id: userId,
        year: toYear,
        leave_type: type,
        total_days: base + days,
        updated_by: executedBy,
        updated_at: new Date().toISOString(),
      })

      logs.push({
        user_id: userId,
        from_year: fromYear,
        to_year: toYear,
        leave_type: type,
        days_carried: days,
        note: `ยกยอดจากปี ${fromYear} (เหลือ ${remaining} วัน)`,
        created_by: executedBy,
      })

      changes[type] = { from: base, to: base + days }
    }

    if (!upserts.length) {
      return { userId, userName, fromYear, toYear, ...carried, success: true }
    }

    const { error: upErr } = await client
      .from('leave_quotas')
      .upsert(upserts as never, { onConflict: 'user_id,year,leave_type' })
    if (upErr) return fail(upErr.message)

    const { error: logErr } = await client.from('carry_over_logs').insert(logs as never)
    if (logErr) return fail(logErr.message)

    await client.from('leave_quota_history').insert({
      user_id: userId,
      year: toYear,
      changes,
      reason: `ยกยอดจากปี ${fromYear}`,
      changed_by: executedBy,
      changed_at: new Date().toISOString(),
    })

    return { userId, userName, fromYear, toYear, ...carried, success: true }
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด')
  }
}

/* ------------------------------------------------------------------ *
 *  ยกยอดให้ทุกคน
 *
 *  ของเดิมวนทีละคนแบบรอให้เสร็จก่อนค่อยทำคนถัดไป — 58 คนใช้เวลานาน
 *  ทำทีละกลุ่ม 8 คนแทน เร็วขึ้นแต่ยังไม่ถล่มฐานข้อมูล
 * ------------------------------------------------------------------ */
export async function carryOverQuotaForAllUsers(
  users: Array<{ id: string; fullName: string }>,
  fromYear: number,
  toYear: number,
  rules: CarryOverRules,
  executedBy: string,
  baseQuota?: { sick: number; personal: number; vacation: number }
): Promise<CarryOverSummary> {
  const results: CarryOverResult[] = []
  const BATCH = 8

  for (let i = 0; i < users.length; i += BATCH) {
    const batch = users.slice(i, i + BATCH)
    const done = await Promise.all(
      batch.map((u) =>
        carryOverQuotaForUser(u.id, u.fullName, fromYear, toYear, rules, executedBy, baseQuota)
      )
    )
    results.push(...done)
  }

  return {
    totalUsers: users.length,
    successCount: results.filter((r) => r.success).length,
    failedCount: results.filter((r) => !r.success).length,
    results,
    executedBy,
    executedAt: new Date(),
  }
}

/* ------------------------------------------------------------------ *
 *  ประวัติการยกยอด — ประกอบกลับเป็นรายรอบจากแถวรายคน
 * ------------------------------------------------------------------ */
type CarryOverRun = {
  fromYear: number
  toYear: number
  executedAt: Date
  executedBy: string
  successCount: number
  totalDays: number
}

async function loadRuns(filter?: { toYear?: number; fromYear?: number }) {
  let q = sb()
    .from('carry_over_logs')
    .select('from_year, to_year, user_id, days_carried, created_by, created_at')
    .order('created_at', { ascending: false })
    .limit(2000)

  if (filter?.toYear) q = q.eq('to_year', filter.toYear)
  if (filter?.fromYear) q = q.eq('from_year', filter.fromYear)

  const { data, error } = await q
  if (error) throw new Error(`ดึงประวัติการยกยอดไม่สำเร็จ: ${error.message}`)
  return data ?? []
}

/** ชื่อคนสั่งยกยอด — เก็บเป็น id แต่หน้าจอโชว์ชื่อ */
async function nameOf(userId: string | null): Promise<string> {
  if (!userId) return 'ระบบ'
  const { data } = await sb().from('users').select('full_name').eq('id', userId).maybeSingle()
  return data?.full_name ?? userId
}

type RunAccum = {
  fromYear: number
  toYear: number
  executedAt: Date
  createdBy: string | null
  users: Set<string>
  totalDays: number
}

function groupRuns(rows: Awaited<ReturnType<typeof loadRuns>>): RunAccum[] {
  const runs = new Map<string, RunAccum>()

  for (const r of rows) {
    // กดยกยอด 1 ครั้งเขียนหลายแถวในเวลาไล่เลี่ยกัน — นาทีเดียวกันถือเป็นรอบเดียว
    const bucket = `${r.from_year}→${r.to_year}@${r.created_at.slice(0, 16)}`
    const run = runs.get(bucket)

    if (run) {
      run.users.add(r.user_id)
      run.totalDays += Number(r.days_carried)
    } else {
      runs.set(bucket, {
        fromYear: r.from_year,
        toYear: r.to_year,
        executedAt: new Date(r.created_at),
        createdBy: r.created_by,
        users: new Set([r.user_id]),
        totalDays: Number(r.days_carried),
      })
    }
  }

  return [...runs.values()]
}

async function toRun(a: RunAccum): Promise<CarryOverRun> {
  return {
    fromYear: a.fromYear,
    toYear: a.toYear,
    executedAt: a.executedAt,
    executedBy: await nameOf(a.createdBy),
    successCount: a.users.size,
    totalDays: a.totalDays,
  }
}

export async function getCarryOverLogs(year?: number): Promise<CarryOverRun[]> {
  const rows = await loadRuns(year ? { toYear: year } : undefined)
  return Promise.all(groupRuns(rows).slice(0, 10).map(toRun))
}

/** เคยยกยอดจากปีนี้ไปปีนั้นแล้วหรือยัง — กันกดซ้ำ */
export async function checkCarryOverExists(
  fromYear: number,
  toYear: number
): Promise<{ exists: boolean; lastCarryOver: CarryOverRun | null }> {
  const rows = await loadRuns({ fromYear, toYear })
  if (!rows.length) return { exists: false, lastCarryOver: null }

  return { exists: true, lastCarryOver: await toRun(groupRuns(rows)[0]) }
}
