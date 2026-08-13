// ใส่ข้อมูลพนักงานทีละหลายคน — หน่วยงาน · เงินเดือน · วันเริ่มงาน
//
// ── เคยปิดไว้ ตอนนี้เปิดใช้จริงแล้ว ────────────────────────────────────
// ตอนแรกหน้านี้เขียนข้อมูลด้วย secret key ที่ข้าม RLS ได้ทั้งหมด จึงต้อง
// ล็อกด้วย env flag ไว้ก่อน (ENABLE_MIGRATION_TOOLS)
//
// พอ RLS เสร็จแล้วก็ไม่ต้องใช้ secret key อีก — HR เขียน users กับ
// user_compensation ได้อยู่แล้วผ่าน session ตัวเอง (policy users_manage /
// user_compensation_manage) ซึ่ง "ปลอดภัยกว่าเดิม" เพราะ:
//   · ฐานข้อมูลเป็นคนตัดสินสิทธิ์ ไม่ใช่ env flag
//   · คนที่ไม่ใช่ HR เขียนไม่ผ่านแม้จะเข้าหน้านี้มาได้
//   · การแก้ทุกครั้งมีชื่อคนแก้ใน audit_log (secret key ไม่มีชื่อ)

import { redirect } from 'next/navigation'
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server'
import BulkEditTable, {
  type Company,
  type JobFunction,
  type Person,
} from './BulkEditTable'

export const dynamic = 'force-dynamic'

export default async function BulkEditPage() {
  const me = await getCurrentUser()
  if (!me) redirect('/login')

  if (!['hr', 'admin'].includes(me.profile.role)) {
    return (
      <div className="max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">ไม่มีสิทธิ์เข้าหน้านี้</p>
        <p className="mt-1">หน้านี้แก้ข้อมูลพนักงานและเงินเดือน เปิดให้เฉพาะฝ่ายบุคคลกับผู้ดูแลระบบ</p>
      </div>
    )
  }

  // ใช้ session ของ HR — RLS กรองให้เอง ไม่ต้องใช้ secret key
  const sb = await createServerSupabase()

  const [usersRes, companiesRes, functionsRes, compRes] = await Promise.all([
    sb
      .from('users')
      .select(
        'id, full_name, nickname, name_verified, line_display_name, role, company_id, job_function_id, employment_type, employment_status, start_date, start_date_verified, end_date, days_per_week, payroll_cycle, allow_checkin_outside_location, wfh_eligible'
      )
      .is('deleted_at', null)
      .eq('is_system', false)
      .order('full_name'),
    sb.from('companies').select('id, code, name_th').order('code'),
    sb
      .from('job_functions')
      .select('id, name_th, payroll_cycle, default_days_per_week')
      .eq('is_active', true)
      .order('sort_order'),
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

  const companies: Company[] = (companiesRes.data ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name_th,
  }))

  const functions: JobFunction[] = (functionsRes.data ?? []).map((f) => ({
    id: f.id,
    name: f.name_th,
    payroll_cycle: f.payroll_cycle,
    default_days_per_week: f.default_days_per_week,
  }))

  const people: Person[] = (usersRes.data ?? []).map((u) => ({
    id: u.id,
    full_name: u.full_name,
    nickname: u.nickname,
    name_verified: u.name_verified,
    allow_checkin_outside_location: u.allow_checkin_outside_location ?? false,
    wfh_eligible: u.wfh_eligible ?? false,
    line_display_name: u.line_display_name,
    role: u.role,
    company_id: u.company_id,
    job_function_id: u.job_function_id,
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
    // ⚠️ PageHeader ต้องถูกเรียกจากฝั่ง client — ไอคอนของ lucide เป็นฟังก์ชัน
    //    ส่งข้ามจาก server component ไม่ได้ (Next โยน "Functions cannot be
    //    passed directly to Client Components") หน้านี้จึงให้ BulkEditTable
    //    ซึ่งเป็น client component เป็นคนวางหัวข้อเอง
    <BulkEditTable people={people} companies={companies} functions={functions} />
  )
}
