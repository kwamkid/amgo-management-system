'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertMigrationToolsEnabled } from '@/lib/supabase/migration-tools'
import { ENDED_STATUSES, type BulkRow, type SaveResult } from './types'

export async function saveBulk(rows: BulkRow[]): Promise<SaveResult> {
  assertMigrationToolsEnabled()

  const sb = createAdminClient()
  const errors: string[] = []
  let updated = 0
  let salaryRows = 0

  // เงินเดือนปัจจุบันของแต่ละคน — ใช้เทียบว่าเปลี่ยนจริงไหม
  // จะได้ไม่สร้างประวัติซ้ำทุกครั้งที่กดบันทึก
  const { data: current } = await sb
    .from('user_compensation')
    .select('user_id, base_salary, effective_from')
    .order('effective_from', { ascending: false })

  const latestSalary = new Map<string, number>()
  for (const c of current ?? []) {
    if (!latestSalary.has(c.user_id)) latestSalary.set(c.user_id, Number(c.base_salary))
  }

  for (const r of rows) {
    // ออกไปแล้วต้องมีวันสุดท้าย — ฐานข้อมูลบังคับไว้ ดักตรงนี้ก่อนจะได้
    // บอกเป็นภาษาคนแทนที่จะโยน constraint error ดิบ ๆ ใส่หน้าผู้ใช้
    if (ENDED_STATUSES.includes(r.employment_status) && !r.end_date) {
      errors.push(`ต้องใส่วันสุดท้ายที่ทำงานก่อน ถึงจะเปลี่ยนเป็นสถานะออกได้`)
      continue
    }

    const { error } = await sb
      .from('users')
      .update({
        business_unit_id: r.business_unit_id,
        employment_type: r.employment_type,
        employment_status: r.employment_status,
        start_date: r.start_date,
        start_date_verified: r.start_date_verified,
        // ยังทำงานอยู่ = ล้างวันสุดท้ายทิ้ง ไม่งั้นค้างจากตอนเคยตั้งเป็นออก
        end_date: ENDED_STATUSES.includes(r.employment_status) ? r.end_date : null,
        days_per_week: r.days_per_week,
        payroll_cycle: r.payroll_cycle,
      })
      .eq('id', r.id)

    if (error) {
      errors.push(`${r.id.slice(0, 8)}: ${error.message}`)
      continue
    }
    updated++

    // เงินเดือนเก็บแบบมีวันที่มีผล — เปลี่ยนทีก็เพิ่มแถวใหม่ ไม่ทับของเก่า
    if (r.base_salary !== null && r.base_salary !== latestSalary.get(r.id)) {
      const { error: cErr } = await sb.from('user_compensation').insert({
        user_id: r.id,
        effective_from: r.start_date ?? new Date().toISOString().slice(0, 10),
        base_salary: r.base_salary,
        pay_type: r.employment_type,
        note: 'ใส่ตอนย้ายระบบมา Supabase',
      })
      if (cErr) errors.push(`เงินเดือน ${r.id.slice(0, 8)}: ${cErr.message}`)
      else salaryRows++
    }
  }

  revalidatePath('/employees/bulk')
  revalidatePath('/migration')

  return { ok: errors.length === 0, updated, salaryRows, errors }
}
