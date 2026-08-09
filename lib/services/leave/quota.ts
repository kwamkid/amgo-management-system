// lib/services/leave/quota.ts
//
// โควต้าวันลา
//
// ── ต่างจากของเดิมตรงไหน ──────────────────────────────────────────────
// Firestore เก็บ quotas/{uid}/years/{year} เป็นเอกสารเดียวมี 3 ก้อนซ้อน
// แล้วให้ leaveService.ts คอยบวก used/remaining ให้ตรงกันเอง
// ซึ่งเพี้ยนได้ทุกทางที่ไม่ผ่านฟังก์ชันนั้น
//
// Postgres:
//   · remaining_days เป็น generated column → ไม่มีทางไม่ตรงกับ total - used
//   · used_days คำนวณจาก leave_days โดย trigger → โค้ดไม่ต้องแตะเลย
// เหลือให้ service ทำแค่ "ตั้ง total" กับ "อ่าน"

import { createClient } from '@/lib/supabase/client'
import type { LeaveQuotaYear, LeaveType, QuotaHistory } from '@/types/leave'
import { toQuotaYear, type LeaveQuotaRow } from './mappers'

const sb = () => createClient()

/* ------------------------------------------------------------------ *
 *  อ่านโควต้าของคนเดียว
 *
 *  ของเดิมถ้าไม่มีจะ "สร้างเอกสารศูนย์" ให้อัตโนมัติ — ทำไม่ได้แล้ว
 *  เพราะ RLS ให้เฉพาะ HR เขียน leave_quotas พนักงานทั่วไปจะพัง
 *  คืนก้อนศูนย์ไปเลยแทน (หน้าจอแสดงผลเหมือนเดิม) แล้วให้ HR กด seedQuota
 * ------------------------------------------------------------------ */
export async function getQuotaForYear(
  userId: string,
  year: number
): Promise<LeaveQuotaYear | null> {
  const { data, error } = await sb()
    .from('leave_quotas')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)

  if (error) throw new Error(`ดึงโควต้าไม่สำเร็จ: ${error.message}`)
  return toQuotaYear(userId, year, (data ?? []) as LeaveQuotaRow[])
}

/* ------------------------------------------------------------------ *
 *  อ่านโควต้าหลายคนพร้อมกัน
 *
 *  หน้าจัดการโควต้ามีพนักงาน ~58 คน ของเดิมยิง getQuotaForYear ทีละคน
 *  = 58 query ต่อการเปลี่ยนปี 1 ครั้ง · ตอนนี้ query เดียว
 * ------------------------------------------------------------------ */
export async function getQuotasForYear(
  userIds: string[],
  year: number
): Promise<Map<string, LeaveQuotaYear>> {
  const out = new Map<string, LeaveQuotaYear>()
  if (!userIds.length) return out

  const { data, error } = await sb()
    .from('leave_quotas')
    .select('*')
    .eq('year', year)
    .in('user_id', userIds)

  if (error) throw new Error(`ดึงโควต้าไม่สำเร็จ: ${error.message}`)

  const byUser = new Map<string, LeaveQuotaRow[]>()
  for (const row of (data ?? []) as LeaveQuotaRow[]) {
    const list = byUser.get(row.user_id) ?? []
    list.push(row)
    byUser.set(row.user_id, list)
  }

  // คนที่ยังไม่มีแถวก็ต้องอยู่ในผลลัพธ์ ไม่งั้นหน้าจอหาย
  for (const id of userIds) out.set(id, toQuotaYear(id, year, byUser.get(id) ?? []))
  return out
}

/* ------------------------------------------------------------------ *
 *  ตั้งโควต้า (HR)
 * ------------------------------------------------------------------ */
export async function updateQuota(
  userId: string,
  year: number,
  type: LeaveType,
  newTotal: number,
  updatedBy: string,
  reason?: string
): Promise<void> {
  const client = sb()

  const { data: before } = await client
    .from('leave_quotas')
    .select('total_days, used_days')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('leave_type', type)
    .maybeSingle()

  const used = Number(before?.used_days ?? 0)
  if (newTotal < used) {
    throw new Error(`ลดโควต้าต่ำกว่าที่ใช้ไปแล้วไม่ได้ (ใช้ไป ${used} วัน)`)
  }

  const { error } = await client.from('leave_quotas').upsert(
    {
      user_id: userId,
      year,
      leave_type: type,
      total_days: newTotal,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
      // ตั้งใจไม่ส่ง used_days — trigger จาก leave_days เป็นเจ้าของค่านั้น
    },
    { onConflict: 'user_id,year,leave_type' }
  )

  if (error) throw new Error(`บันทึกโควต้าไม่สำเร็จ: ${error.message}`)

  await client.from('leave_quota_history').insert({
    user_id: userId,
    year,
    changes: { [type]: { from: Number(before?.total_days ?? 0), to: newTotal } },
    reason: reason ?? '',
    changed_by: updatedBy,
    changed_at: new Date().toISOString(),
  })
}

/* ------------------------------------------------------------------ *
 *  สร้างโควต้าตั้งต้นจากค่ากลางของปีนั้น (leave_type_defaults)
 *  ปี 2024-2027 ตั้งไว้แล้ว: ป่วย 30 · กิจ 3 · พักร้อน 6 (ตาม พ.ร.บ. คุ้มครองแรงงาน)
 * ------------------------------------------------------------------ */
export async function seedQuota(userId: string, year: number): Promise<number> {
  const { data, error } = await sb().rpc('seed_leave_quota', {
    p_user_id: userId,
    p_year: year,
  })
  if (error) throw new Error(`สร้างโควต้าตั้งต้นไม่สำเร็จ: ${error.message}`)

  // คืน 0 ได้ 2 กรณี: มีแถวอยู่แล้ว หรือ "ปีนั้นยังไม่ได้ตั้งค่าเริ่มต้น"
  // กรณีหลังเงียบสนิทจนนึกว่าสำเร็จ — เช็ค hasQuotaDefaults() ก่อนเรียก
  return data ?? 0
}

/** ปีนั้นตั้งค่าเริ่มต้นไว้หรือยัง — ไม่มีแล้ว seedQuota จะไม่สร้างอะไรเลย */
export async function hasQuotaDefaults(year: number): Promise<boolean> {
  const { count, error } = await sb()
    .from('leave_type_defaults')
    .select('*', { count: 'exact', head: true })
    .eq('year', year)

  if (error) throw new Error(`ตรวจค่าเริ่มต้นไม่สำเร็จ: ${error.message}`)
  return (count ?? 0) > 0
}

/** ค่าโควตาตั้งต้นของปีนั้น */
export async function getQuotaDefaults(
  year: number
): Promise<{ leaveType: LeaveType; days: number; note: string }[]> {
  const { data, error } = await sb()
    .from('leave_type_defaults')
    .select('leave_type, default_days, note')
    .eq('year', year)
    .order('leave_type')

  if (error) throw new Error(`ดึงค่าเริ่มต้นไม่สำเร็จ: ${error.message}`)
  return (data ?? []).map((d) => ({
    leaveType: d.leave_type as LeaveType,
    days: Number(d.default_days),
    note: d.note ?? '',
  }))
}

/**
 * ก๊อปค่าโควตาตั้งต้นไปปีถัดไป
 *
 * ปีใหม่ต้องตั้งค่าไว้ล่วงหน้าตั้งแต่ปลายปีก่อน ไม่ใช่รอให้ถึงวันที่ 1 ม.ค.
 * แล้วค่อยมารู้ว่าไม่มีโควตา — ตัวนี้ทำให้ HR กดทีเดียวจบ แล้วค่อยไปแก้ทีหลัง
 * ถ้าปีนั้นตัวเลขต่างจากปีก่อน
 */
export async function copyQuotaDefaults(
  fromYear: number,
  toYear: number,
  updatedBy: string
): Promise<number> {
  const source = await getQuotaDefaults(fromYear)
  if (!source.length) throw new Error(`ปี ${fromYear} ยังไม่ได้ตั้งค่าเริ่มต้น`)

  const { data, error } = await sb()
    .from('leave_type_defaults')
    .upsert(
      source.map((d) => ({
        year: toYear,
        leave_type: d.leaveType,
        default_days: d.days,
        note: `คัดลอกจากปี ${fromYear}`,
        updated_by: updatedBy,
      })),
      { onConflict: 'year,leave_type', ignoreDuplicates: true }
    )
    .select('leave_type')

  if (error) throw new Error(`คัดลอกค่าเริ่มต้นไม่สำเร็จ: ${error.message}`)
  return data?.length ?? 0
}

/** สร้างโควต้าตั้งต้นให้หลายคน — ใช้ตอนเปิดปีใหม่ */
export async function seedQuotaForUsers(
  userIds: string[],
  year: number
): Promise<{ seeded: number; failed: string[] }> {
  let seeded = 0
  const failed: string[] = []

  for (const id of userIds) {
    try {
      seeded += await seedQuota(id, year)
    } catch {
      failed.push(id)
    }
  }
  return { seeded, failed }
}

/* ------------------------------------------------------------------ *
 *  ใครยังไม่มีโควต้าปีนี้บ้าง
 *
 *  ของเดิมวน getDoc ทีละคนเพราะ Firestore in query จำกัด 30 ตัว — query เดียวพอ
 *  "มีโควต้า" = ตั้ง total มากกว่า 0 อย่างน้อย 1 ประเภท
 *  (แถวที่ total เป็น 0 ทั้งหมด มีค่าเท่ากับยังไม่ได้ตั้ง)
 * ------------------------------------------------------------------ */
export async function checkQuotaExistsForYear(
  year: number,
  userIds: string[]
): Promise<{ hasQuota: boolean; usersWithQuota: number; usersWithoutQuota: string[] }> {
  if (!userIds.length) return { hasQuota: false, usersWithQuota: 0, usersWithoutQuota: [] }

  const { data, error } = await sb()
    .from('leave_quotas')
    .select('user_id')
    .eq('year', year)
    .in('user_id', userIds)
    .gt('total_days', 0)

  if (error) throw new Error(`ตรวจโควต้าไม่สำเร็จ: ${error.message}`)

  const withQuota = new Set((data ?? []).map((r) => r.user_id))
  return {
    hasQuota: withQuota.size > 0,
    usersWithQuota: withQuota.size,
    usersWithoutQuota: userIds.filter((id) => !withQuota.has(id)),
  }
}

/* ------------------------------------------------------------------ *
 *  ประวัติการแก้โควต้า
 *
 *  ของเดิมฝัง array ไว้ในเอกสารโควต้า ทำให้ทุกครั้งที่โหลดหน้าโควต้า
 *  ต้องลากประวัติทั้งหมดมาด้วยทั้งที่ไม่ได้แสดง — แยกตารางแล้วดึงเมื่อต้องการ
 * ------------------------------------------------------------------ */
export async function getQuotaHistory(userId: string, year: number): Promise<QuotaHistory[]> {
  const { data, error } = await sb()
    .from('leave_quota_history')
    .select('changes, reason, changed_by, changed_at')
    .eq('user_id', userId)
    .eq('year', year)
    .order('changed_at', { ascending: false })

  if (error) throw new Error(`ดึงประวัติโควต้าไม่สำเร็จ: ${error.message}`)

  return (data ?? []).map((r) => ({
    changedBy: r.changed_by ?? 'system',
    changedAt: new Date(r.changed_at),
    changes: r.changes as QuotaHistory['changes'],
    reason: r.reason || undefined,
  }))
}
