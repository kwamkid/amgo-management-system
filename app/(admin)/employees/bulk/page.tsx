// ใส่ข้อมูลพนักงานทีละหลายคน — หน่วยงาน · เงินเดือน · วันเริ่มงาน
// ใช้ช่วงย้ายระบบ ลบทิ้งได้เมื่อทำ RLS เสร็จ (Phase 6)

import { createAdminClient } from '@/lib/supabase/admin'
import { migrationToolsEnabled } from '@/lib/supabase/migration-tools'
import BulkEditTable, { type Person, type Unit } from './BulkEditTable'
import { PageHeader } from '@/components/shared'
import { Table2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function BulkEditPage() {
  if (!migrationToolsEnabled()) {
    return (
      <div className="max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">หน้านี้ปิดอยู่</p>
        <p className="mt-1">
          เป็นเครื่องมือช่วงย้ายระบบ เขียนข้อมูลได้โดยไม่ผ่าน RLS
          ต้องตั้ง <code className="font-mono">ENABLE_MIGRATION_TOOLS=true</code> ใน{' '}
          <code className="font-mono">.env.local</code> แล้ว restart dev server ก่อน
        </p>
      </div>
    )
  }

  const sb = createAdminClient()

  const [usersRes, unitsRes, compRes] = await Promise.all([
    sb
      .from('users')
      .select(
        'id, full_name, role, business_unit_id, employment_type, employment_status, start_date, start_date_verified, end_date, days_per_week, payroll_cycle'
      )
      .is('deleted_at', null)
      .order('full_name'),
    sb
      .from('business_units')
      .select('id, name, payroll_cycle, default_days_per_week, companies(code)')
      .eq('is_active', true)
      .order('name'),
    sb
      .from('user_compensation')
      .select('user_id, base_salary, effective_from')
      .order('effective_from', { ascending: false }),
  ])

  // เงินเดือนล่าสุดของแต่ละคน (ตารางเก็บเป็นประวัติ หลายแถวต่อคน)
  const salary = new Map<string, number>()
  for (const c of compRes.data ?? []) {
    if (!salary.has(c.user_id)) salary.set(c.user_id, Number(c.base_salary))
  }

  const units: Unit[] = (unitsRes.data ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    company: ((u as any).companies?.code as string) ?? '',
    payroll_cycle: u.payroll_cycle,
    default_days_per_week: u.default_days_per_week,
  }))

  const people: Person[] = (usersRes.data ?? []).map((u) => ({
    id: u.id,
    full_name: u.full_name,
    role: u.role,
    business_unit_id: u.business_unit_id,
    employment_type: (u.employment_type as 'monthly' | 'daily') ?? 'monthly',
    employment_status: (u.employment_status as Person['employment_status']) ?? 'active',
    start_date: u.start_date,
    start_date_verified: u.start_date_verified,
    end_date: u.end_date,
    days_per_week: u.days_per_week,
    payroll_cycle: u.payroll_cycle,
    base_salary: salary.get(u.id) ?? null,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="ใส่ข้อมูลพนักงานหลายคน"
        description="ติ๊กเลือกหลายคนแล้วตั้งค่าทีเดียว · แถวสีส้มคือที่แก้แล้วยังไม่บันทึก"
        icon={Table2}
        backHref="/employees"
      />

      <BulkEditTable people={people} units={units} />
    </div>
  )
}
